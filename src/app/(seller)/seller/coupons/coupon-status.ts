export interface CouponStatusInput {
  status: string;
  expiresAt: Date | string | null;
  maxUses: number | null;
  usedCount: number;
}

/** Cupom utilizável agora: ligado, não vencido e sem limite de usos atingido. */
export function isCouponEffectivelyActive(coupon: CouponStatusInput, now: Date = new Date()): boolean {
  const isExpired = Boolean(coupon.expiresAt && new Date(coupon.expiresAt) < now);
  const isLimitReached = Boolean(coupon.maxUses && coupon.usedCount >= coupon.maxUses);
  return coupon.status === "active" && !isExpired && !isLimitReached;
}
