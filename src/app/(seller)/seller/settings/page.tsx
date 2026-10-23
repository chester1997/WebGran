import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PlatformCommissionService } from "@/lib/commission/platform-commission-service";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  await connection();
  const seller = await requireSeller();
  const store = await getCurrentStore();

  let userRecord: any = null;
  try {
    userRecord = await db.query.users.findFirst({
      where: eq(users.id, seller.id),
    });
  } catch (err) {
    console.error("Error fetching user profile record:", err);
  }

  // Fetch real transaction fee from Single Source of Truth
  let transactionFee = {
    isAvailable: false,
    formattedFee: "IndisponÃ­vel",
    feeReais: 0,
    feeCents: 0,
  };

  try {
    const commission = await PlatformCommissionService.getCurrentCommission();
    transactionFee = {
      isAvailable: true,
      formattedFee: commission.formattedFee,
      feeReais: commission.feeReais,
      feeCents: commission.feeCents,
    };
  } catch (err) {
    console.error("Error fetching platform commission in SettingsPage:", err);
    transactionFee = {
      isAvailable: false,
      formattedFee: "IndisponÃ­vel",
      feeReais: 0,
      feeCents: 0,
    };
  }

  return (
    <SettingsClient
      storeName={store?.name || "Minha Loja"}
      storeId={store?.id || null}
      storeTelegramNotificationId={store?.telegramNotificationId || null}
      transactionFee={transactionFee}
      sellerProfile={{
        id: seller.id,
        name: userRecord?.name || seller.name || "Vendedor",
        email: seller.email || "",
        avatarUrl: userRecord?.avatarUrl || null,
        role: userRecord?.role || seller.role || "seller",
        createdAt: userRecord?.createdAt ? new Date(userRecord.createdAt).toISOString() : null,
        lastLoginAt: null, // O banco nÃ£o possui campo de Ãºltimo acesso; mantido nulo para nÃ£o inventar dados
      }}
    />
  );
}
