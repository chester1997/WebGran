import { redirect } from "next/navigation";

export default function RootPage() {
  // Por enquanto, redireciona para o painel do vendedor
  redirect("/seller");
}
