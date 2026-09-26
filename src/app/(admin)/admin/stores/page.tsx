import { connection } from "next/server";
import { redirect } from "next/navigation";

export default function StoresRedirectPage() {
  redirect("/admin");
}
