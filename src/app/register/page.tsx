export const instant = false;
import { Suspense } from "react";
import { AuthContainer } from "@/components/auth/AuthContainer";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090B] flex items-center justify-center text-zinc-500 text-sm">Carregando...</div>}>
      <AuthContainer initialMode="register" />
    </Suspense>
  );
}
