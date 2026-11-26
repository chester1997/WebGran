import { Suspense } from "react";
import { AuthContainer } from "@/components/auth/AuthContainer";

/** Link do e-mail "Redefinir sua senha": o lojista cadastra a nova senha (o token vem em ?token=). */
export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05060a]" />}>
      <AuthContainer initialMode="reset" />
    </Suspense>
  );
}
