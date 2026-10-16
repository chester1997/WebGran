process.env.DATABASE_URL = "postgresql://mock:mock@localhost:5432/mock";

import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    query: {
      orders: {
        findMany: vi.fn(),
      },
    },
  },
}));

import {
  generatePerformanceSeries,
  generateLast7DaysPerformance,
  resolvePeriodDateRange,
  CommercialMetricsService,
} from "../commercial-metrics-service";
import {
  getSaoPauloParts,
  getSaoPauloDateKey,
  getSaoPauloDateLabel,
  getSaoPauloStartOfDay,
} from "../timezone-utils";


describe("WebGran Commercial Metrics & Performance Timezone Suite", () => {
  // Reference date: 2026-10-16 12:00:00 BRT -> 2026-10-16 15:00:00 UTC
  const referenceDate = new Date("2026-10-16T15:00:00.000Z");

  describe("Period Point Count & Formatting", () => {
    it("should generate exactly 7 points for 7D period", () => {
      const points = generatePerformanceSeries([], "7D", referenceDate);
      expect(points).toHaveLength(7);
      expect(points[6].dateKey).toBe("2026-10-16");
      expect(points[0].dateKey).toBe("2026-10-10");
    });

    it("should generate exactly 30 points for 30D period", () => {
      const points = generatePerformanceSeries([], "30D", referenceDate);
      expect(points).toHaveLength(30);
      expect(points[29].dateKey).toBe("2026-10-16");
      expect(points[0].dateKey).toBe("2026-09-17");
    });

    it("should generate exactly 90 points for 90D period", () => {
      const points = generatePerformanceSeries([], "90D", referenceDate);
      expect(points).toHaveLength(90);
      expect(points[89].dateKey).toBe("2026-10-16");
    });

    it("should generate 12 points for TODAY period (2-hour buckets)", () => {
      const points = generatePerformanceSeries([], "TODAY", referenceDate);
      expect(points).toHaveLength(12);
      expect(points[0].dateLabel).toBe("00:00");
      expect(points[11].dateLabel).toBe("22:00");
    });

    it("should generate 12 points for 12M period (months)", () => {
      const points = generatePerformanceSeries([], "12M", referenceDate);
      expect(points).toHaveLength(12);
      expect(points[11].dateKey).toBe("2026-10");
    });
  });

  describe("Timezone Accuracy (Problem 2 Verification)", () => {
    it("assigns orders at 23:06 BRT on 15/10 to 15/10 and NOT 16/10", () => {
      // 15/10 at 23:06 BRT is 16/10 at 02:06 UTC
      const lateNightOrderDate = new Date("2026-10-16T02:06:03.213Z");

      // Verify timezone helper directly first
      const parts = getSaoPauloParts(lateNightOrderDate);
      expect(parts.day).toBe(15);
      expect(parts.month).toBe(10);
      expect(parts.year).toBe(2026);
      expect(parts.hour).toBe(23);
      expect(parts.minute).toBe(6);

      const key = getSaoPauloDateKey(lateNightOrderDate);
      expect(key).toBe("2026-10-15");

      const label = getSaoPauloDateLabel(lateNightOrderDate);
      expect(label).toBe("15/10");

      // Test within generatePerformanceSeries
      const orders = [
        {
          status: "paid",
          total: 150.0,
          paidAt: lateNightOrderDate,
          createdAt: lateNightOrderDate,
        },
        {
          status: "paid",
          total: 250.0,
          paidAt: new Date("2026-10-16T02:15:00.000Z"), // 23:15 BRT on 15/10
          createdAt: new Date("2026-10-16T02:15:00.000Z"),
        },
      ];

      const points = generatePerformanceSeries(orders, "7D", referenceDate);

      const day15Point = points.find((p) => p.dateKey === "2026-10-15");
      const day16Point = points.find((p) => p.dateKey === "2026-10-16");

      expect(day15Point).toBeDefined();
      expect(day15Point?.revenue).toBe(400.0);
      expect(day15Point?.salesCount).toBe(2);

      expect(day16Point).toBeDefined();
      expect(day16Point?.revenue).toBe(0);
      expect(day16Point?.salesCount).toBe(0);
    });

    it("excludes pending and canceled orders from performance series", () => {
      const orders = [
        {
          status: "pending",
          total: 500.0,
          createdAt: new Date("2026-10-15T15:00:00.000Z"),
        },
        {
          status: "canceled",
          total: 300.0,
          createdAt: new Date("2026-10-15T15:00:00.000Z"),
        },
        {
          status: "paid",
          total: 100.0,
          paidAt: new Date("2026-10-15T15:00:00.000Z"),
          createdAt: new Date("2026-10-15T15:00:00.000Z"),
        },
      ];

      const points = generatePerformanceSeries(orders, "7D", referenceDate);
      const day15Point = points.find((p) => p.dateKey === "2026-10-15");

      expect(day15Point?.revenue).toBe(100.0);
      expect(day15Point?.salesCount).toBe(1);
    });
  });

  describe("CommercialMetricsService.calculateMetrics dynamic period series", () => {
    it("returns both performanceSeries and last7DaysPerformance with correct counts", () => {
      const sampleOrders = [
        {
          id: "ord-1",
          storeId: "store-123",
          status: "paid",
          total: "97.00",
          paidAt: new Date("2026-10-15T22:00:00.000Z"),
          createdAt: new Date("2026-10-15T22:00:00.000Z"),
        },
      ];

      const result30D = CommercialMetricsService.calculateMetrics(sampleOrders, {
        period: "30D",
        referenceDate,
      });

      expect(result30D.performanceSeries).toHaveLength(30);
      expect(result30D.last7DaysPerformance).toHaveLength(7);
      expect(result30D.approvedSales.total).toBe(97.0);

      const result7D = CommercialMetricsService.calculateMetrics(sampleOrders, {
        period: "7D",
        referenceDate,
      });

      expect(result7D.performanceSeries).toHaveLength(7);
    });
  });
});
