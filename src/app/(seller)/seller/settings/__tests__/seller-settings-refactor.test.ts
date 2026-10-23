import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn().mockResolvedValue({ id: "seller-123", email: "seller@webgran.test", name: "Vendedor Teste", role: "seller" }),
  getCurrentStore: vi.fn().mockResolvedValue({ id: "store-123", name: "Minha Loja", ownerId: "seller-123", telegramNotificationId: "7112951709" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockUsers: Record<string, any> = {};
const mockStores: Record<string, any> = {};

vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return mockUsers["seller-123"] || null;
        }),
      },
      telegramBots: {
        findMany: vi.fn().mockResolvedValue([
          { id: "bot-db-id", botId: "999888777", storeId: "store-123" },
        ]),
      },
    },
    update: vi.fn().mockImplementation((table: any) => ({
      set: vi.fn().mockImplementation((values: any) => ({
        where: vi.fn().mockImplementation(async () => {
          if (values.password) {
            mockUsers["seller-123"].password = values.password;
          }
          if (values.name) {
            mockUsers["seller-123"].name = values.name;
          }
          if (values.avatarUrl !== undefined) {
            mockUsers["seller-123"].avatarUrl = values.avatarUrl;
          }
          if (values.telegramNotificationId !== undefined) {
            mockStores["store-123"].telegramNotificationId = values.telegramNotificationId;
          }
          return { rowCount: 1 };
        }),
      })),
    })),
  },
}));

import bcrypt from "bcryptjs";
import {
  updateSellerProfileAction,
  changePasswordAction,
  saveSellerNotificationPreferenceAction
} from "../actions";

describe("Seller Settings & Profile Reformulation Suite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const hashedPassword = await bcrypt.hash("OldPassword123!", 10);
    mockUsers["seller-123"] = {
      id: "seller-123",
      name: "Vendedor Original",
      email: "seller@webgran.test",
      password: hashedPassword,
      avatarUrl: "https://cdn.webgran.online/profiles/avatar.webp",
      createdAt: new Date("2026-01-15T12:00:00Z"),
      updatedAt: new Date("2026-01-15T12:00:00Z"),
    };
    mockStores["store-123"] = {
      id: "store-123",
      ownerId: "seller-123",
      name: "Minha Loja",
      telegramNotificationId: "7112951709",
    };
  });

  describe("1. Profile & Avatar Updating", () => {
    it("updates seller name successfully", async () => {
      const res = await updateSellerProfileAction({
        name: "Novo Nome Vendedor",
        avatarUrl: "https://cdn.webgran.online/profiles/new-avatar.webp",
      });

      expect(res.success).toBe(true);
      expect(mockUsers["seller-123"].name).toBe("Novo Nome Vendedor");
      expect(mockUsers["seller-123"].avatarUrl).toBe("https://cdn.webgran.online/profiles/new-avatar.webp");
    });

    it("rejects empty name", async () => {
      await expect(
        updateSellerProfileAction({ name: "   " })
      ).rejects.toThrow("O nome é obrigatório.");
    });

    it("allows removing avatar by setting it to null", async () => {
      const res = await updateSellerProfileAction({
        name: "Vendedor Sem Foto",
        avatarUrl: null,
      });

      expect(res.success).toBe(true);
      expect(mockUsers["seller-123"].avatarUrl).toBeNull();
    });
  });

  describe("2. Password Change Security & Validation", () => {
    it("rejects if any field is missing", async () => {
      await expect(
        changePasswordAction({
          currentPassword: "",
          newPassword: "NewSecretPassword123!",
          confirmPassword: "NewSecretPassword123!",
        })
      ).rejects.toThrow("Todos os campos de senha são obrigatórios.");

      await expect(
        changePasswordAction({
          currentPassword: "OldPassword123!",
          newPassword: "",
          confirmPassword: "NewSecretPassword123!",
        })
      ).rejects.toThrow("Todos os campos de senha são obrigatórios.");
    });

    it("enforces minimum password length of 6 characters", async () => {
      await expect(
        changePasswordAction({
          currentPassword: "OldPassword123!",
          newPassword: "12345",
          confirmPassword: "12345",
        })
      ).rejects.toThrow("A nova senha deve ter no mínimo 6 caracteres.");
    });

    it("rejects when confirmation does not match", async () => {
      await expect(
        changePasswordAction({
          currentPassword: "OldPassword123!",
          newPassword: "Password123!",
          confirmPassword: "DifferentPassword123!",
        })
      ).rejects.toThrow("A confirmação da nova senha não confere.");
    });

    it("rejects when new password is identical to current password", async () => {
      await expect(
        changePasswordAction({
          currentPassword: "OldPassword123!",
          newPassword: "OldPassword123!",
          confirmPassword: "OldPassword123!",
        })
      ).rejects.toThrow("A nova senha não pode ser igual à senha atual.");
    });

    it("fails when current password is wrong", async () => {
      await expect(
        changePasswordAction({
          currentPassword: "WrongPassword999!",
          newPassword: "NewPassword123!",
          confirmPassword: "NewPassword123!",
        })
      ).rejects.toThrow("A senha atual informada está incorreta.");
    });

    it("successfully hashes and updates password when current password is valid", async () => {
      const res = await changePasswordAction({
        currentPassword: "OldPassword123!",
        newPassword: "BrandNewSecurePassword456!",
        confirmPassword: "BrandNewSecurePassword456!",
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe("Senha alterada com sucesso!");

      // Verify that the stored password is a valid bcrypt hash of the new password
      const newHash = mockUsers["seller-123"].password;
      expect(newHash).not.toBe("BrandNewSecurePassword456!");
      expect(await bcrypt.compare("BrandNewSecurePassword456!", newHash)).toBe(true);
      expect(await bcrypt.compare("OldPassword123!", newHash)).toBe(false);
    });
  });

  describe("3. Seller Notification Preferences Backend", () => {
    it("saves valid telegram ID for sale notifications", async () => {
      const res = await saveSellerNotificationPreferenceAction({
        telegramNotificationId: "888777666",
      });

      expect(res.success).toBe(true);
      expect(res.telegramNotificationId).toBe("888777666");
      expect(mockStores["store-123"].telegramNotificationId).toBe("888777666");
    });

    it("disables notification by clearing telegram ID when null is passed", async () => {
      const res = await saveSellerNotificationPreferenceAction({
        telegramNotificationId: null,
      });

      expect(res.success).toBe(true);
      expect(res.telegramNotificationId).toBeNull();
      expect(mockStores["store-123"].telegramNotificationId).toBeNull();
    });

    it("rejects non-numeric telegram IDs", async () => {
      await expect(
        saveSellerNotificationPreferenceAction({
          telegramNotificationId: "abc_invalid_id",
        })
      ).rejects.toThrow("O Telegram ID deve conter apenas números (ex: 123456789).");
    });

    it("rejects telegram ID matching store bot ID to prevent circular bot messaging", async () => {
      await expect(
        saveSellerNotificationPreferenceAction({
          telegramNotificationId: "999888777",
        })
      ).rejects.toThrow("pertence ao bot da sua loja");
    });
  });

  describe("4. File Content Magic Bytes Security Verification", () => {
    it("detects valid image magic bytes correctly", () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
      const jpgHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const webpHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
      const exeHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]); // MZ DOS/PE header

      const checkValidImage = (buf: Buffer) => {
        const isPng = buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
        const isJpg = buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
        const isWebp = buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
        return isPng || isJpg || isWebp;
      };

      expect(checkValidImage(pngHeader)).toBe(true);
      expect(checkValidImage(jpgHeader)).toBe(true);
      expect(checkValidImage(webpHeader)).toBe(true);
      expect(checkValidImage(exeHeader)).toBe(false);
    });
  });
});
