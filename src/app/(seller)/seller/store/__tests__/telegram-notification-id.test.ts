import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveTelegramNotificationIdAction } from "../actions";
import { db } from "@/db";

let dbStoresStore: Record<string, any> = {};

vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn().mockResolvedValue({ id: "seller-123", email: "seller@test.com" }),
  getCurrentStore: vi.fn().mockImplementation(async () => {
    return dbStoresStore["seller-123"] || null;
  }),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      telegramBots: {
        findMany: vi.fn().mockResolvedValue([
          { id: "bot-1", botId: "987654321", storeId: "store-123" }
        ])
      }
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async () => {
          if (dbStoresStore["seller-123"]) {
            dbStoresStore["seller-123"].telegramNotificationId = "7112951709";
          }
          return [{ id: "store-123" }];
        }),
      }),
    }),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("saveTelegramNotificationIdAction Unit Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbStoresStore = {
      "seller-123": {
        id: "store-123",
        ownerId: "seller-123",
        telegramNotificationId: null,
      },
    };
  });

  it("saves a valid numeric Telegram ID successfully", async () => {
    const res = await saveTelegramNotificationIdAction(" 7112951709 ");

    expect(res.success).toBe(true);
    expect(res.telegramNotificationId).toBe("7112951709");
    expect(dbStoresStore["seller-123"].telegramNotificationId).toBe("7112951709");
  });

  it("rejects non-numeric Telegram ID", async () => {
    await expect(saveTelegramNotificationIdAction("abc12345")).rejects.toThrow(
      "O Telegram ID deve conter apenas números"
    );
  });

  it("rejects Telegram ID when it matches a bot ID from the store", async () => {
    await expect(saveTelegramNotificationIdAction("987654321")).rejects.toThrow(
      "pertence ao bot da sua loja"
    );
  });

  it("clears Telegram ID when empty string is passed", async () => {
    dbStoresStore["seller-123"].telegramNotificationId = "7112951709";

    const res = await saveTelegramNotificationIdAction("   ");

    expect(res.success).toBe(true);
    expect(res.telegramNotificationId).toBe("");
  });
});
