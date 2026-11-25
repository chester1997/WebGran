import { redirect } from "next/navigation";

export const OWNER_USER_ID = "ead2ec50-ac72-4917-9d9c-1c68de270070";
export const OWNER_EMAIL = "lf49127@gmail.com";

/**
 * Função pura executável tanto no cliente quanto no servidor.
 * Verifica se um determinado objeto de usuário corresponde estritamente à conta do proprietário da WebGran.
 */
export function isOwnerUser(user?: { id?: string; email?: string | null } | null): boolean {
  if (!user || !user.id) return false;
  return (
    user.id === OWNER_USER_ID ||
    (!!user.email && user.email.trim().toLowerCase() === OWNER_EMAIL.trim().toLowerCase())
  );
}

/** Contas liberadas para testar a Loja Web (além do proprietário), antes de abrir para todos. */
export const WEB_STORE_TESTER_EMAILS = ["saviominisseries@gmail.com"];

/** A Loja Web está liberada para esta conta? (proprietário ou e-mail da lista de teste) */
export function canUseWebStore(user?: { id?: string; email?: string | null } | null): boolean {
  if (isOwnerUser(user)) return true;
  const email = user?.email?.trim().toLowerCase();
  return !!email && WEB_STORE_TESTER_EMAILS.includes(email);
}

/** Página da Loja Web no painel: sem acesso, volta para /seller. */
export async function requireWebStoreAccount() {
  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canUseWebStore(user)) redirect("/seller");
  return user;
}

/** Server Actions da Loja Web. */
export async function verifyWebStoreActionAccess() {
  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  if (!user) return { authorized: false, error: "Usuário não autenticado." };
  if (!canUseWebStore(user)) return { authorized: false, error: "A Loja Web ainda está em fase de testes." };
  return { authorized: true, user };
}

/**
 * Validador de rota / página Server-Side.
 * Redireciona para /login caso não autenticado, ou para /seller se não for a conta do proprietário.
 */
export async function requireOwnerAccount() {
  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (!isOwnerUser(user)) {
    redirect("/seller");
  }

  return user;
}

/**
 * Validador para Server Actions e rotas de API.
 * Retorna estado de autorização explícito sem redirecionamentos automáticos.
 */
export async function verifyOwnerActionAccess() {
  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  if (!user) {
    return { authorized: false, error: "Usuário não autenticado." };
  }

  if (!isOwnerUser(user)) {
    return { authorized: false, error: "Acesso restrito ao proprietário da plataforma nesta fase de testes." };
  }

  return { authorized: true, user };
}
