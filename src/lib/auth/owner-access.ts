import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

export interface UserAuthIdentity {
  id?: string | null;
  role?: string | null;
  email?: string | null;
}

/**
 * Helper centralizado de autorização para o Redesign V2 do painel do vendedor WebGran.
 * 
 * Regra Obrigatória e Inegociável:
 * A interface V2 é exclusiva da conta proprietária da plataforma.
 * 
 * Condições de autorização:
 * 1. user.id === OWNER_USER_ID; OU
 * 2. user.role === "admin" E user.email?.trim().toLowerCase() === OWNER_EMAIL
 * 
 * Bloqueios Estritos:
 * - Outros administradores (role "admin" com e-mail ou ID diferente): NÃO AUTORIZADO (interface clássica)
 * - Vendedores comuns (role "seller" ou qualquer outro): NÃO AUTORIZADO (interface clássica)
 * - Tentativas de envio de dados pelo cliente (body, searchParams, flags arbitrárias): IGNORADOS
 * - Usuário não autenticado / nulo: NÃO AUTORIZADO
 */
export function isOwnerAccount(user?: UserAuthIdentity | null): boolean {
  if (!user) return false;

  // 1. Identificação imutável pelo ID oficial do proprietário
  if (user.id && user.id === OWNER_USER_ID) {
    return true;
  }

  // 2. Perfil "admin" E e-mail oficial normalizado (sem espaços e em minúsculas)
  const role = (user.role || "").trim().toLowerCase();
  const email = (user.email || "").trim().toLowerCase();
  const normalizedOwnerEmail = OWNER_EMAIL.trim().toLowerCase();

  if (role === "admin" && email !== "" && email === normalizedOwnerEmail) {
    return true;
  }

  return false;
}

/**
 * Validador executado diretamente no servidor consultando a sessão autenticada.
 * Utiliza o getServerSession através de getCurrentUser, sem aceitar dados do cliente.
 */
export async function checkIsOwnerServer(): Promise<boolean> {
  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  return isOwnerAccount(user);
}

