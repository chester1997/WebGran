import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { isOwnerAccount } from "@/lib/auth/owner-access";
import { getWelcomeSettingsAction } from "./actions";
import WelcomeClient from "./WelcomeClient";
import WelcomeClientV2 from "./WelcomeClientV2";
import SetupStoreClient from "../SetupStoreClient";

export default async function BoasVindasPage() {
  await connection();
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const settings = await getWelcomeSettingsAction();
  const isOwner = isOwnerAccount(user);

  if (isOwner) {
    return <WelcomeClientV2 initialSettings={settings} />;
  }

  return <WelcomeClient initialSettings={settings} />;
}
