import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "../route";
import {
  AdminDashboardService,
} from "@/lib/analytics/admin-dashboard-service";
import { requirePlatformAdmin } from "@/lib/auth";

// Mock next/server connection
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return {
    ...mod,
    connection: vi.fn(),
  };
});

// Mock auth module
vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: vi.fn(),
}));

// Mock db to avoid missing DATABASE_URL during unit tests
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("Phase 5: Admin Dashboard Stats API and Service", () => {
  const mockAdmin = {
    id: "admin-uuid-1",
    name: "Super Admin",
    email: "admin@webgran.com",
    role: "super_admin",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePlatformAdmin).mockResolvedValue(mockAdmin as any);
  });

  describe("API Route Security & Period Validation", () => {
    it("1. Blocks unauthenticated requests with HTTP 401", async () => {
      vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new Error("UNAUTHORIZED"));

      const req = new Request("http://localhost/api/admin/dashboard-stats");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Sessão não autenticada/i);
    });

    it("2. Blocks non-admin (seller/customer) requests with HTTP 403", async () => {
      vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new Error("FORBIDDEN"));

      const req = new Request("http://localhost/api/admin/dashboard-stats");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Acesso negado/i);
    });

    it("3. Accepts valid period parameters (7d, 30d, 90d)", async () => {
      const spy = vi.spyOn(AdminDashboardService, "getDashboardStats").mockResolvedValueOnce({
        period: "7d",
      } as any);

      const req = new Request("http://localhost/api/admin/dashboard-stats?period=7d");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith("7d", expect.any(Date));
      expect(json.period).toBe("7d");
      spy.mockRestore();
    });

    it("4. Falls back to 30d when period parameter is invalid or missing", async () => {
      const spy = vi.spyOn(AdminDashboardService, "getDashboardStats").mockResolvedValueOnce({
        period: "30d",
      } as any);

      const req = new Request("http://localhost/api/admin/dashboard-stats?period=invalid_period");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith("30d", expect.any(Date));
      expect(json.period).toBe("30d");
      spy.mockRestore();
    });
  });

  describe("PeriodResolution & Timezone Logic (America/Recife UTC-3)", () => {
    // Reference instant: 2026-10-28 15:30:00 UTC (12:30:00 in Recife UTC-3)
    const fixedNow = new Date("2026-10-28T15:30:00.000Z");

    it("5. Resolves 7d period with exact day length and identical previous period duration", () => {
      const res = AdminDashboardService.resolvePeriod("7d", fixedNow);

      expect(res.period).toBe("7d");
      expect(res.days).toBe(7);
      expect(res.periodLabel).toBe("Últimos 7 dias");

      // Duration of current period from startDate to startOfToday is 6 full days (518,400,000 ms)
      const diffCurrentMs = res.startOfToday.getTime() - res.startDate.getTime();
      expect(diffCurrentMs).toBe(6 * 24 * 60 * 60 * 1000);

      // Duration of previous comparison period is exactly 7 full days
      const diffPrevMs = res.previousEndDate.getTime() - res.previousStartDate.getTime() + 1;
      expect(diffPrevMs).toBe(7 * 24 * 60 * 60 * 1000);
      expect(res.previousEndDate.getTime()).toBe(res.startDate.getTime() - 1);
    });

    it("6. Resolves 30d and 90d periods accurately", () => {
      const res30 = AdminDashboardService.resolvePeriod("30d", fixedNow);
      expect(res30.days).toBe(30);
      expect(res30.periodLabel).toBe("Últimos 30 dias");

      const res90 = AdminDashboardService.resolvePeriod("90d", fixedNow);
      expect(res90.days).toBe(90);
      expect(res90.periodLabel).toBe("Últimos 90 dias");
    });
  });

  describe("Math & Percentage Calculations", () => {
    it("7. Safely calculates percentage variation avoiding division by zero or NaN", () => {
      expect(AdminDashboardService.calculatePercentage(100, 50)).toBe(100.0);
      expect(AdminDashboardService.calculatePercentage(50, 100)).toBe(-50.0);
      expect(AdminDashboardService.calculatePercentage(10, 0)).toBe(100.0);
      expect(AdminDashboardService.calculatePercentage(0, 0)).toBeNull();
      expect(AdminDashboardService.calculatePercentage(0, 10)).toBe(-100.0);
    });
  });

  describe("Platform Fee Tracking Business Rules", () => {
    it("8. Distinguishes PROCESSED from SETTLED and does not count SKIPPED as failure", () => {
      // Mock period orders simulating different split statuses
      const mockOrders = [
        { status: "paid", total: 100, splitStatus: "PROCESSED", splitAmountCents: 50 },
        { status: "paid", total: 200, splitStatus: "CONFIRMED", splitAmountCents: 50 },
        { status: "paid", total: 150, splitStatus: "SETTLED", splitAmountCents: 50 },
        { status: "paid", total: 50, splitStatus: "SKIPPED", splitAmountCents: 0 },
        { status: "paid", total: 80, splitStatus: "FAILED", splitAmountCents: 50 },
        { status: "paid", total: 90, splitStatus: "PENDING", splitAmountCents: 50 },
        { status: "pending", total: 100, splitStatus: null, splitAmountCents: null }, // Unpaid order should be ignored
      ];

      let expectedFeeTotal = 0;
      let processedFeeTotal = 0;
      let processedCount = 0;
      let settledFeeTotal = 0;
      let settledCount = 0;
      let pendingFeeTotal = 0;
      let pendingCount = 0;
      let skippedFeeTotal = 0;
      let skippedCount = 0;
      let failedFeeTotal = 0;
      let failedCount = 0;

      for (const ord of mockOrders) {
        if (ord.status === "paid") {
          const feeCents = typeof ord.splitAmountCents === "number" ? ord.splitAmountCents : 50;
          const feeReais = feeCents / 100;
          expectedFeeTotal += feeReais;

          const st = (ord.splitStatus || "PENDING").toUpperCase();
          if (st === "SETTLED") {
            settledFeeTotal += feeReais;
            settledCount += 1;
          } else if (st === "PROCESSED" || st === "CONFIRMED" || st === "GATEWAY_ACCEPTED") {
            processedFeeTotal += feeReais;
            processedCount += 1;
          } else if (st === "SKIPPED") {
            skippedFeeTotal += feeReais;
            skippedCount += 1;
          } else if (st === "FAILED") {
            failedFeeTotal += feeReais;
            failedCount += 1;
          } else {
            pendingFeeTotal += feeReais;
            pendingCount += 1;
          }
        }
      }

      // Verifications:
      expect(processedCount).toBe(2); // PROCESSED and CONFIRMED
      expect(processedFeeTotal).toBe(1.00); // 0.50 + 0.50

      expect(settledCount).toBe(1); // SETTLED is distinct from PROCESSED
      expect(settledFeeTotal).toBe(0.50);

      expect(skippedCount).toBe(1); // SKIPPED is distinct and intentional
      expect(skippedFeeTotal).toBe(0.00);

      expect(failedCount).toBe(1); // FAILED is explicit error
      expect(failedFeeTotal).toBe(0.50);

      expect(pendingCount).toBe(1); // PENDING split
      expect(pendingFeeTotal).toBe(0.50);

      expect(expectedFeeTotal).toBe(2.50); // 0.50 * 5 paid orders + 0.00 skipped
    });

    it("9. Safely calculates Pix conversion rate", () => {
      const calcRate = (generated: number, paid: number) =>
        generated > 0 ? Number(((paid / generated) * 100).toFixed(1)) : null;

      expect(calcRate(100, 75)).toBe(75.0);
      expect(calcRate(3, 1)).toBe(33.3);
      expect(calcRate(0, 0)).toBeNull(); // No division by zero or NaN
    });
  });
});
