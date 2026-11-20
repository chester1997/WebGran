import { describe, it, expect, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/db", () => ({ db: { execute: (...args: unknown[]) => execute(...args) } }));

import { CustomerBlockService, isMissingTableError } from "../customer-block-service";

const missingTable = Object.assign(new Error('relation "customer_blocks" does not exist'), { code: "42P01" });

describe("CustomerBlockService", () => {
  beforeEach(() => execute.mockReset());

  it("reports a blocked Telegram user", async () => {
    execute.mockResolvedValueOnce({ rows: [{ blocked: true }] });
    await expect(CustomerBlockService.isTelegramUserBlocked("store-1", 123)).resolves.toBe(true);
  });

  it("ignores rows without the blocked marker", async () => {
    execute.mockResolvedValueOnce([{ id: "something-else" }]);
    await expect(CustomerBlockService.isTelegramUserBlocked("store-1", "123")).resolves.toBe(false);
  });

  it("reports a non-blocked Telegram user", async () => {
    execute.mockResolvedValueOnce({ rows: [] });
    await expect(CustomerBlockService.isTelegramUserBlocked("store-1", "123")).resolves.toBe(false);
  });

  it("fails open when the table does not exist yet", async () => {
    execute.mockRejectedValueOnce(missingTable);
    await expect(CustomerBlockService.isTelegramUserBlocked("store-1", "123")).resolves.toBe(false);
    execute.mockRejectedValueOnce(missingTable);
    await expect(CustomerBlockService.isCustomerIdBlocked("store-1", "cust-1")).resolves.toBe(false);
  });

  it("fails open on any other database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockRejectedValueOnce(new Error("connection reset"));
    await expect(CustomerBlockService.isTelegramUserBlocked("store-1", "123")).resolves.toBe(false);
  });

  it("does not query without store or user", async () => {
    await expect(CustomerBlockService.isTelegramUserBlocked(null, "123")).resolves.toBe(false);
    await expect(CustomerBlockService.isTelegramUserBlocked("store-1", undefined)).resolves.toBe(false);
    await expect(CustomerBlockService.isCustomerIdBlocked("store-1", null)).resolves.toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("lists blocks and flags when the table is missing", async () => {
    execute.mockResolvedValueOnce({ rows: [{ telegram_user_id: 99, reason: "golpe", blocked_at: "2026-11-20T10:00:00Z" }] });
    const ok = await CustomerBlockService.listBlocks("store-1");
    expect(ok.available).toBe(true);
    expect(ok.blocks).toEqual([{ telegramUserId: "99", reason: "golpe", blockedAt: "2026-11-20T10:00:00.000Z" }]);

    execute.mockRejectedValueOnce(missingTable);
    await expect(CustomerBlockService.listBlocks("store-1")).resolves.toEqual({ available: false, blocks: [] });
  });

  it("propagates errors on block so the action can report them", async () => {
    execute.mockRejectedValueOnce(missingTable);
    await expect(
      CustomerBlockService.block({ storeId: "s", telegramUserId: "1", blockedBy: "u" })
    ).rejects.toThrow();
  });

  it("detects missing-table errors", () => {
    expect(isMissingTableError(missingTable)).toBe(true);
    expect(isMissingTableError({ cause: { code: "42P01" } })).toBe(true);
    expect(isMissingTableError(new Error("timeout"))).toBe(false);
  });
});
