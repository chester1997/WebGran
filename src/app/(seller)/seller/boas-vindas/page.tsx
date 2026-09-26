export const instant = false;
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { getWelcomeSettingsAction } from "./actions";
import WelcomeClient from "./WelcomeClient";
import SetupStoreClient from "../SetupStoreClient";

export default async function BoasVindasPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  const settings = await getWelcomeSettingsAction();

  return <WelcomeClient initialSettings={settings} />;
}
