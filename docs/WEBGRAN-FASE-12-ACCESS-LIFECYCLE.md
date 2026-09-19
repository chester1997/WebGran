# WEBGRAN — FASE 12: CICLO COMPLETO DO ACESSO TELEGRAM, LINK, PERMANÊNCIA E EXPIRAÇÃO

## 1. RESUMO EXECUTIVO

A FASE 12 consolida o ciclo completo de acesso aos conteúdos no WebGran (`Compra -> Pagamento -> Access -> Convite -> Entrada no Canal -> Permanência Ativa -> Meus Acessos -> Expiração -> Revogação Telegram -> Acesso Expirado`), garantindo a separação técnica entre o convite de entrada (`inviteLink` / `inviteExpiresAt`) e a fonte de verdade da assinatura (`Access.expiresAt`).

### Principais Pilares da Arquitetura:
1. **Diferenciação Estrita de Entidades**:
   - `inviteLink`: URL temporária de entrada individual gerada pela Telegram Bot API (`createChatInviteLink`).
   - `Access`: Direito de assinatura do cliente gravado no PostgreSQL Neon (`status`, `deliveryStatus`, `grantedAt`, `expiresAt`, `expiredAt`).
   - Expiração do convite **NÃO** expira o acesso do cliente. Se o convite expirar antes do usuário entrar no canal, mas `now < Access.expiresAt`, o WebGran gera um novo convite dinamicamente sem cobrar ou duplicar registros.
2. **Resolução Dinâmica do Destino (`access-lifecycle-service.ts`)**:
   - Se o usuário já é membro do canal (`getChatMember` = `creator`, `administrator`, `member`): retorna o destino direto do canal (`https://t.me/c/...`). Não gera convites desnecessários.
   - Se o usuário não é membro e o convite expirou: renova a URL individual com `createTelegramInvite` e atualiza o `Access.inviteLink`.
   - Se `Access.status === 'EXPIRED'` ou `now >= Access.expiresAt`: bloqueia a entrada e exibe a opção de recompra (`[🛒 COMPRAR NOVAMENTE]`).
3. **Revogação Real Automatizada e Auditada (`processExpiredAccesses`)**:
   - Quando `now >= Access.expiresAt` (e não vitalício), o job consulta a API do Telegram.
   - Se o usuário já saiu do canal: registra `revocationStatus = 'SKIPPED_NOT_MEMBER'`, `status = 'EXPIRED'`.
   - Se o usuário permanece no canal: executa `banChatMember` e `unbanChatMember` via Telegram Bot API, registrando `revocationStatus = 'SUCCESS'`, `revokedAt = NOW()`, `status = 'EXPIRED'`. Se falhar (ex: bot sem permissão), registra `revocationStatus = 'FAILED'` e `revocationError` de forma transparente.

---

## 2. FLUXO DETALHADO DO CICLO DE VIDA DO ACESSO

```text
COMPRA (Mini App / Bot)
       │
       ▼
PAGAMENTO CONFIRMADO (Mercado Pago / Order = PAID)
       │
       ▼
ACCESS CRIADO (grantedAt = paidAt, expiresAt = paidAt + duração do produto)
       │
       ├──► USUÁRIO JÁ É MEMBRO? ──► SIM ──► Access = ACTIVE / DELIVERED
       │                                     Destino = Canal Direto (Sem gerar convite)
       │
       └──► NÃO ──► Gera Convite Único ──► Envia Mensagem no Bot [📺 ACESSAR CONTEÚDO]
                         │
                         ├─► Usuário entra no canal ──► Access permanece ACTIVE
                         │
                         └─► Convite expira antes da entrada?
                                   │
                                   ├──► Access.expiresAt válido? ──► SIM ──► Renova convite dinamicamente
                                   │
                                   └──► Access.expiresAt vencido? ──► SIM ──► Access = EXPIRED
                                                                               Revoga membro via Telegram
                                                                               [🛒 COMPRAR NOVAMENTE]
```

---

## 3. COMPARAÇÃO DE ESTADOS VISUAIS ("MEUS ACESSOS")

| Estado do Access | Duração | Condição no Banco | Exibição no Mini App | Ação Disponível |
| :--- | :--- | :--- | :--- | :--- |
| **Ativo** | Mensal / Anual | `status = 'ACTIVE'`, `now < expiresAt` | 🟢 **Acesso ativo** <br> `Expira em DD/MM/YYYY (X dias restantes)` | **[📺 ACESSAR CONTEÚDO]** |
| **Vitalício** | Vitalício | `status = 'ACTIVE'`, `expiresAt = null` | 🟢 **Acesso vitalício** <br> `Vitalício • Sem data limite` | **[📺 ACESSAR CONTEÚDO]** |
| **Entrega Pendente** | Qualquer | `deliveryStatus = 'FAILED'` / `PENDING` | 🟡 **Entrega pendente** <br> `Sua liberação está em andamento` | **[🔄 TENTAR LIBERAR ACESSO]** |
| **Expirado** | Qualquer | `status = 'EXPIRED'` / `now >= expiresAt` | 🔴 **Acesso expirado** <br> `Expirou em DD/MM/YYYY` | **[🛒 COMPRAR NOVAMENTE]** |

---

## 4. EVIDÊNCIA DE VERIFICAÇÃO E SUÍTE DE TESTES (10/10 PASSED)

Execução do script automatizado [test-fase12-lifecycle-e2e.ts](file:///d:/TELEGRAM/WebGran/src/db/test-fase12-lifecycle-e2e.ts):

```text
==================================================
WEBGRAN FASE 12 — SUÍTE DE TESTES DO CICLO DE ACESSO
==================================================

▶ TESTE 1: Usuário não membro + Access Válido -> Convite criado
[AccessLifecycleService] Fresh invite link generated for Access c3499542-48b2-4784-b258-8852785f9622: https://t.me/+71XZAk7wW0gyYmIx
✅ [PASS 1] Convite/Destino gerado com sucesso: https://t.me/+71XZAk7wW0gyYmIx

▶ TESTE 2: Usuário entra no canal -> Access continua ACTIVE
✅ [PASS 2] Access mantido como ACTIVE (ACTIVE)

▶ TESTE 3: Convite expira -> Access continua ACTIVE
✅ [PASS 3] Convite expirado mas Access permanece ACTIVE (ACTIVE)

▶ TESTE 4: Convite expirado + Access válido -> Novo convite gerado dinamicamente
[AccessLifecycleService] Fresh invite link generated for Access c3499542-48b2-4784-b258-8852785f9622: https://t.me/+jV2KO10A1xE0NmEx
✅ [PASS 4] Novo convite gerado/resolvido sem novo pagamento: https://t.me/+jV2KO10A1xE0NmEx

▶ TESTE 5 & 6 & 7: expiresAt vencido -> processExpiredAccesses() expira e executa revogação
[processExpiredAccesses] Scanning for expired accesses at 2026-09-19T13:13:46.090Z...
[processExpiredAccesses] Found 1 accesses to expire.
[processExpiredAccesses] User 7779385719 already left channel -1003982066404. Skipped revocation.
✅ [PASS 5,6,7] Access expirado e revogação processada. Status=EXPIRED, RevocationStatus=SKIPPED_NOT_MEMBER

▶ TESTE 8: LIFETIME -> Acesso vitalício não expira
[AccessLifecycleService] Fresh invite link generated for Access dab72878-b719-410b-a7d2-e0c33c754b3b: https://t.me/+XWRIaV6VcCo5OGNh
✅ [PASS 8] Acesso LIFETIME mantido ativo sem data de expiração.

▶ TESTE 9 & 10: Meus Acessos renderiza datas para ACTIVE e desabilita botão para EXPIRED
✅ [PASS 9,10] Formatação de interface validada: ACTIVE="Expira em 29/09/2026", EXPIRED="Expirou em 09/09/2026"

==================================================
SUÍTE DE TESTES FASE 12: 10/10 PASSED
==================================================

🎉 WEBGRAN FASE 12 CRITÉRIO FINAL DE PASS ALCANÇADO COM 100% DE SUCESSO!
```
