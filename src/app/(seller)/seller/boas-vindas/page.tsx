import { getWelcomeSettingsAction } from "./actions";
import WelcomeClient from "./WelcomeClient";

export default async function BoasVindasPage() {
  const settings = await getWelcomeSettingsAction();

  return <WelcomeClient initialSettings={settings} />;
}
