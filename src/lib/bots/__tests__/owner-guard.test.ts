import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

import { isOwnerUser, OWNER_USER_ID, OWNER_EMAIL, requireOwnerAccount, verifyOwnerActionAccess } from "../owner-guard";
import { getCurrentUser } from "@/lib/auth";

describe("WebGran Owner Guard Suite — Isolamento Exclusivo do Proprietário", () => {
  it("autoriza a conta real do proprietário pelo ID único", () => {
    expect(isOwnerUser({ id: OWNER_USER_ID, email: "outro@dominio.com" })).toBe(true);
  });

  it("autoriza a conta real do proprietário pelo e-mail", () => {
    expect(isOwnerUser({ id: "id-qualquer", email: OWNER_EMAIL })).toBe(true);
  });

  it("bloqueia estritamente outros vendedores reais e fictícios", () => {
    expect(isOwnerUser({ id: "6baf2bf5-f6b2-43d1-97e2-d4434fc9eaa0", email: "apollodrm8@gmail.com" })).toBe(false);
    expect(isOwnerUser({ id: "9c642b5a-8b5e-452b-96f4-3bd4f2e62450", email: "erikaestevo@gmail.com" })).toBe(false);
    expect(isOwnerUser({ id: "c7b81741-ca04-4df1-8504-b65f8f7ea5e0", email: "emporiosite6@gmail.com" })).toBe(false);
    expect(isOwnerUser({ id: "0d1a32a1-6f9e-495f-a711-525ea33f4a18", email: "erickrss707@gmail.com" })).toBe(false);
  });

  it("bloqueia usuários nulos, vazios ou sem identificador", () => {
    expect(isOwnerUser(null)).toBe(false);
    expect(isOwnerUser(undefined)).toBe(false);
    expect(isOwnerUser({ id: "" })).toBe(false);
    expect(isOwnerUser({ email: "" })).toBe(false);
  });

  it("verifyOwnerActionAccess concede autorização para o proprietário", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      id: OWNER_USER_ID,
      email: OWNER_EMAIL,
      name: "STUDIO ADM",
      role: "admin",
    });

    const result = await verifyOwnerActionAccess();
    expect(result.authorized).toBe(true);
    expect(result.user?.id).toBe(OWNER_USER_ID);
  });

  it("verifyOwnerActionAccess nega autorização para outro vendedor", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      id: "outro-vendedor",
      email: "vendedor@loja.com",
      name: "Outro Vendedor",
      role: "seller",
    });

    const result = await verifyOwnerActionAccess();
    expect(result.authorized).toBe(false);
    expect(result.error).toContain("Acesso restrito");
  });

  it("verifyOwnerActionAccess nega autorização para sessão inexistente", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null as any);

    const result = await verifyOwnerActionAccess();
    expect(result.authorized).toBe(false);
    expect(result.error).toContain("não autenticado");
  });
});
