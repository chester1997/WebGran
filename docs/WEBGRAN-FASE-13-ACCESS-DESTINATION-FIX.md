# WEBGRAN — FASE 13: RELATÓRIO DE CORREÇÃO DO DESTINO DE ACESSO (BOTÕES "ACESSAR CONTEÚDO" E "ENTRAR NO GRUPO")

---

## 1. Visão Geral da Solução

A **FASE 13** corrige definitivamente o problema em que o botão "Acessar Conteúdo" e "Entrar no Grupo" (tanto nas mensagens do Bot quanto na tela Mini App → "Meus Acessos") continuavam apontando para um `inviteLink` estático expirado após o cliente entrar no canal.

### Arquitetura de Separação de Entidades

```
+-----------------------------------------------------------------------+
|                            COMPRA REAL                                |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                          ACCESS DO CLIENTE                            |
| (Direito de Acesso ao Conteúdo • Validade definida em expiresAt)     |
+-----------------------------------------------------------------------+
            |                                           |
            v                                           v
+-----------------------+                   +-----------------------+
|    CLIENTE É MEMBRO   |                   |  CLIENTE NÃO É MEMBRO |
+-----------------------+                   +-----------------------+
            |                                           |
            v                                           v
+-----------------------+                   +-----------------------+
|  LINK DIRETO DO CHAT  |                   |  LINK DE CONVITE      |
|  (https://t.me/c/...) |                   |  (Único, Temporário)  |
+-----------------------+                   +-----------------------+
```

1. **LINK DE CONVITE (`inviteLink`)**: Instrumento temporário e de uso único exclusivamente para permitir a **primeira entrada** do cliente no grupo/canal.
2. **DESTINO DO ACESSO (`resolveAccessDestination`)**: Entidade dinâmica e definitiva que avalia o status real de membro e a validade de `Access.expiresAt`.

---

## 2. Auditoria de Código (Locais Corrigidos)

1. **`src/lib/orders/access-lifecycle-service.ts`**:
   - Implementado `resolveAccessDestination(accessId: string, storeSlug?: string)` retornando payload estruturado:
     `{ status: 'ACTIVE' | 'EXPIRED' | 'FAILED', destinationType: 'DIRECT_CHAT' | 'INVITE' | 'EXPIRED' | 'ERROR', destinationUrl: string | null, expiresAt: Date | null }`.
   - Quando o comprador **já é membro** (`creator`, `administrator`, `member`): retorna `destinationType: 'DIRECT_CHAT'`, URL `https://t.me/c/...` (ou link público). **NUNCA** usa link de convite expirado e **NÃO** gera novo link de convite.
   - Quando o comprador **não é membro** e `now < Access.expiresAt`: se o link de convite existente for válido (`now < inviteExpiresAt`), retorna `destinationType: 'INVITE'`. Se estiver expirado ou ausente, gera um novo link de convite de uso único sem duplicar orders ou pagamentos.
   - Quando `Access.status === 'EXPIRED'` ou `now >= Access.expiresAt`: atualiza banco para `EXPIRED` e retorna `destinationType: 'EXPIRED'`, `destinationUrl: null`.

2. **`src/app/api/telegram/access/redirect/route.ts`** `[NOVO]`:
   - Endpoint universal `GET /api/telegram/access/redirect?accessId=...`.
   - Invoca `resolveAccessDestination(accessId)` e redireciona (302) para `destinationUrl` em tempo de execução.

3. **`src/lib/delivery/access-delivery-service.ts`**:
   - Atualizado `sendPaymentConfirmationMessage` para passar `redirectUrl` (`/api/telegram/access/redirect?accessId=...`).
   - Garante que a mensagem enviada pelo Bot continue funcionando de forma dinâmica mesmo se o cliente clicar semanas depois.

4. **`src/components/themes/studio/views/StudioAccessCard.tsx`** `[NOVO]`:
   - Componente React interativo para a tela "Meus Acessos".
   - Ao clicar no botão, realiza chamada a `/api/telegram/access/open` que invoca `resolveAccessDestination`.
   - Exibe status e datas formatadas conforme especificações:
     - **Ativo (Mensal/Semanal/Anual)**: `🟢 Acesso ativo | Expira em DD/MM/YYYY (X dias restantes)` -> `[ Entrar no Grupo ]` / `[ 📺 ACESSAR CONTEÚDO ]`.
     - **Ativo (Vitalício)**: `🟢 Acesso vitalício | Vitalício • Sem data limite` -> `[ Entrar no Grupo ]` / `[ 📺 ACESSAR CONTEÚDO ]`.
     - **Expirado**: `🔴 Acesso expirado | Expirou em DD/MM/YYYY` -> `[ 🛒 COMPRAR NOVAMENTE ]`.

5. **`src/components/themes/studio/views/StudioAccesses.tsx`**:
   - Atualizado para pré-resolver destinos em tempo de renderização do servidor e renderizar o componente `StudioAccessCard`.

---

## 3. Resultados dos Testes Automatizados E2E (`test-fase13-destination-e2e.ts`)

```
==================================================
WEBGRAN — FASE 13: TESTE COMPLETO DE DESTINO DE ACESSO
==================================================

✅ Store encontrada: teste loja (09596d3e-6f66-4b61-9c09-7e4051190a10)
✅ Produto encontrado: A IRMÃ QUE TODOS SUBESTIMARAAM (81635b4f-54b5-447f-94d2-0b4c6df53188)
   deliveryValue (Chat ID): -1003982066404
✅ Customer de teste: TestUserFase13 (ID: b83a9c22-bb53-492a-a728-1760d432486e)
✅ Order de teste criada: 42f86808-aa0b-4735-8be6-3f4856173fad

--------------------------------------------------
SCENARIO A: User ALREADY a member of channel
--------------------------------------------------
[AccessLifecycleService] Buyer 99988877713 is ALREADY a member of -1003982066404. Returning direct channel URL.
Resultado Cenário A: {
  success: true,
  status: 'ACTIVE',
  destinationType: 'DIRECT_CHAT',
  destinationUrl: 'https://t.me/c/3982066404',
  expiresAt: 2026-10-19T13:37:20.733Z
}
✅ CENÁRIO A PASSOU: Retornou DIRECT_CHAT sem usar convite expirado.

--------------------------------------------------
SCENARIO B: User NOT a member, valid invite link
--------------------------------------------------
Resultado Cenário B: {
  success: true,
  status: 'ACTIVE',
  destinationType: 'INVITE',
  destinationUrl: 'https://t.me/+valid_invite_link_B',
  expiresAt: 2026-10-19T13:37:20.733Z
}
✅ CENÁRIO B PASSOU: Retornou o inviteLink válido existente.

--------------------------------------------------
SCENARIO C: Not a member, invite expired, access active
--------------------------------------------------
[AccessLifecycleService] Fresh invite link generated for Access d20089ec-21c6-437d-aa0c-148acbaec71c: https://t.me/+fresh_renewed_invite_link_C
Resultado Cenário C: {
  success: true,
  status: 'ACTIVE',
  destinationType: 'INVITE',
  destinationUrl: 'https://t.me/+fresh_renewed_invite_link_C',
  expiresAt: 2026-10-19T13:37:20.733Z
}
✅ CENÁRIO C PASSOU: Renovou inviteLink expirado e manteve Access ACTIVE sem duplicar pagamentos.

--------------------------------------------------
SCENARIO D: Expired Access (now >= expiresAt)
--------------------------------------------------
Resultado Cenário D: {
  success: false,
  status: 'EXPIRED',
  destinationType: 'EXPIRED',
  destinationUrl: null,
  expiresAt: 2026-09-18T13:37:20.733Z,
  message: '🔴 Seu acesso expirou.',
  canRepurchase: true,
  productSlug: 'a-irm-que-todos-subestimaraam-4339'
}
✅ CENÁRIO D PASSOU: Access expirado atualizado para EXPIRED e retornado destinationType EXPIRED.

==================================================
🎉 TODOS OS TESTES DA FASE 13 PASSARAM COM SUCESSO!
==================================================
```

---

## 4. Status Final

- ✅ Separação completa entre `inviteLink` e `destinationUrl`.
- ✅ `resolveAccessDestination` retorna objeto estruturado padronizado.
- ✅ Redirecionamento dinâmico em tempo de execução via `GET /api/telegram/access/redirect`.
- ✅ Tela "Meus Acessos" interativa atualizada com `StudioAccessCard`.
- ✅ Todos os testes automatizados E2E executados e validados.
