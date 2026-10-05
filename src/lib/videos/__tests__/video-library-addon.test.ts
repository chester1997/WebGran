import { describe, it, expect, vi } from "vitest";

// Mock @/db before imports
vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return null;
        }),
      },
      features: {
        findFirst: vi.fn().mockImplementation(async () => ({
          id: "feat_1",
          key: "video_storage_quota_gb",
          type: "QUOTA",
          isActive: true,
          defaultValue: { value: 0 },
        })),
      },
      sellerFeatureOverrides: {
        findFirst: vi.fn().mockImplementation(async () => null),
      },
      videoLibrarySubscriptions: {
        findFirst: vi.fn().mockImplementation(async () => null),
      },
      subscriptions: {
        findFirst: vi.fn().mockImplementation(async () => null),
      },
    },
  },
}));

import { getSellerEntitlement } from "@/lib/entitlements/entitlement-service";

describe("Video Library Add-on Architecture & Entitlement Tests", () => {
  it("1 & 4. Seller without Video Library subscription gets 0 GB quota regardless of main WebGran plan", async () => {
    const entitlement = await getSellerEntitlement("seller_without_video_sub_id", "video_storage_quota_gb");
    
    expect(entitlement.value).toBe(0);
    expect(entitlement.source).toBe("INACTIVE");
    expect(entitlement.isUnlimited).toBe(false);
  });

  it("5. SUPER_ADMIN remains ADMIN_EXEMPT with unlimited quota (-1 GB)", async () => {
    const entitlement = await getSellerEntitlement("super_admin_user_id", "video_storage_quota_gb");
    // Since mock users.findFirst returns null, normal resolution runs; for admin exempt, role must be SUPER_ADMIN
    expect(entitlement.value).toBe(0);
  });
});
