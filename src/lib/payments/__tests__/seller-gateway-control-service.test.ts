import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbRecords: any[] = [];

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => mockDbRecords),
        }),
        then: (resolve: any) => resolve(mockDbRecords),
        [Symbol.iterator]: function* () {
          yield* mockDbRecords;
        },
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

import { SellerGatewayControlService } from "../seller-gateway-control-service";

describe("SellerGatewayControlService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbRecords.length = 0;
  });

  it("should return default controls for pushinpay, mercadopago and syncpay when db is empty", async () => {
    const controls = await SellerGatewayControlService.getAllControls();

    expect(controls).toBeDefined();
    expect(controls.length).toBeGreaterThanOrEqual(3);

    const pushinpay = controls.find((c) => c.gateway === "pushinpay");
    expect(pushinpay).toBeDefined();
    expect(pushinpay?.allowNewConnections).toBe(true);
    expect(pushinpay?.allowNewPayments).toBe(true);

    const mp = controls.find((c) => c.gateway === "mercadopago");
    expect(mp).toBeDefined();
    expect(mp?.allowNewConnections).toBe(true);
    expect(mp?.allowNewPayments).toBe(true);

    const syncpay = controls.find((c) => c.gateway === "syncpay");
    expect(syncpay).toBeDefined();
    expect(syncpay?.allowNewConnections).toBe(false);
    expect(syncpay?.allowNewPayments).toBe(false);
  });

  it("should evaluate isPaymentAllowed correctly with fallbacks", async () => {
    const pushinPayAllowed = await SellerGatewayControlService.isPaymentAllowed("pushinpay");
    expect(pushinPayAllowed).toBe(true);

    const mpAllowed = await SellerGatewayControlService.isPaymentAllowed("mercadopago");
    expect(mpAllowed).toBe(true);

    const syncPayAllowed = await SellerGatewayControlService.isPaymentAllowed("syncpay");
    expect(syncPayAllowed).toBe(false);
  });

  it("should evaluate isConnectionAllowed correctly with fallbacks", async () => {
    const pushinPayConn = await SellerGatewayControlService.isConnectionAllowed("pushinpay");
    expect(pushinPayConn).toBe(true);

    const mpConn = await SellerGatewayControlService.isConnectionAllowed("mercadopago");
    expect(mpConn).toBe(true);

    const syncPayConn = await SellerGatewayControlService.isConnectionAllowed("syncpay");
    expect(syncPayConn).toBe(false);
  });
});
