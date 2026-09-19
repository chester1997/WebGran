# WEBGRAN — FASE 11: EXPIRAÇÃO REAL DO ACESSO CONFORME A DURAÇÃO DO PRODUTO

## 1. RESUMO EXECUTIVO

A FASE 11 implementa a arquitetura de controle e expiração real da assinatura/acesso do cliente baseada na duração do produto cadastrada no WebGran (`products.duration`), estabelecendo uma separação estrita entre a expiração do link de convite (`inviteExpiresAt`) e a expiração do acesso ao conteúdo (`accessExpiresAt`).

### Principais Pilares da Arquitetura:
1. **Diferenciação Estrita de Expiração**:
   - `inviteExpiresAt`: Validade temporária da URL de convite gerada para entrada no grupo/canal via Telegram Bot API.
   - `accessExpiresAt` (`Access.expiresAt`): Fonte de verdade da assinatura do comprador no WebGran. Se um link expirou mas `now < Access.expiresAt`, o comprador pode renovar o link sem pagar novamente.
2. **Motor de Cálculo Calendárico de Expiração (`expiration-service.ts`)**:
   - `DAILY`: `paidAt + 1 dia`
   - `WEEKLY`: `paidAt + 7 dias`
   - `BIWEEKLY`: `paidAt + 14 dias`
   - `MONTHLY`: `paidAt + 1 mês` (Adição calendárica: 19/09 -> 19/10)
   - `QUARTERLY`: `paidAt + 3 meses` (Adição calendárica: 19/09 -> 19/12)
   - `ANNUAL`: `paidAt + 1 ano` (Adição calendárica: 19/09/2026 -> 19/09/2027)
   - `LIFETIME`: `null` (sem expiração)
3. **Job Backend de Expiração e Remoção Automatizada (`processExpiredAccesses`)**:
   - Consulta acessos onde `status = 'ACTIVE'` e `now >= expiresAt`.
   - Executa revogação do membro no Telegram chamando `banChatMember` e `unbanChatMember` via Telegram Bot API.
   - Atualiza `Access`: `status = 'EXPIRED'`, `deliveryStatus = 'EXPIRED'`, `expiredAt = NOW()`.
4. **Interface Mini App "Meus Acessos" (`StudioAccesses.tsx`)**:
   - Exibe os estados visuais padronizados e datas brasileiras:
     - 🟢 **ACTIVE**: `Acesso ativo` | `Expira em 19/10/2026 (30 dias restantes)` -> `[📺 ACESSAR CONTEÚDO]`
     - 🟢 **LIFETIME**: `Acesso vitalício` -> `[📺 ACESSAR CONTEÚDO]`
     - 🔴 **EXPIRED**: `Acesso expirado` | `Expirou em 19/10/2026` -> `[🛒 Comprar novamente]`
     - 🟡 **PENDING / FAILED**: `Entrega pendente` -> `[🔄 Tentar liberar acesso]`

---

## 2. TABELA DE CÁLCULO DE DURAÇÃO E EXPIRAÇÃO

| Duração do Produto | Fonte de Verdade (`Product.duration`) | Data Inicial (`paidAt`) | Data Final Calculada (`Access.expiresAt`) | Formatação no "Meus Acessos" |
| :--- | :--- | :--- | :--- | :--- |
| **Diário** | `daily` / `DAILY` | 19/09/2026 | 20/09/2026 | `Expira em 20/09/2026` |
| **Semanal** | `weekly` / `WEEKLY` | 19/09/2026 | 26/09/2026 | `Expira em 26/09/2026` |
| **Quinzenal** | `biweekly` / `BIWEEKLY` | 19/09/2026 | 03/10/2026 | `Expira em 03/10/2026` |
| **Mensal** | `monthly` / `MONTHLY` | 19/09/2026 | 19/10/2026 | `Expira em 19/10/2026 (30 dias restantes)` |
| **Trimestral** | `quarterly` / `QUARTERLY` | 19/09/2026 | 19/12/2026 | `Expira em 19/12/2026` |
| **Anual** | `annual` / `ANNUAL` | 19/09/2026 | 19/09/2027 | `Expira em 19/09/2027` |
| **Vitalício** | `lifetime` / `LIFETIME` | 19/09/2026 | `null` | `Acesso vitalício` |

---

## 3. EVIDÊNCIA DE VERIFICAÇÃO E TESTES

### 3.1. Testes Unitários dos Cálculos de Expiração (`test-fase11-expiration-calculation.ts`)

```text
=== WEBGRAN FASE 11 — TESTES UNITÁRIOS DE CÁLCULO DE EXPIRAÇÃO ===
Data Base de Teste (paidAt): 2026-09-19T12:00:00.000Z
✅ [PASS] DAILY      -> 2026-09-20 (Esperado: 2026-09-20)
   Formatado BR: "Expira em 20/09/2026" | Badge: ACTIVE
✅ [PASS] WEEKLY     -> 2026-09-26 (Esperado: 2026-09-26)
   Formatado BR: "Expira em 26/09/2026" | Badge: ACTIVE
✅ [PASS] BIWEEKLY   -> 2026-10-03 (Esperado: 2026-10-03)
   Formatado BR: "Expira em 03/10/2026" | Badge: ACTIVE
✅ [PASS] MONTHLY    -> 2026-10-19 (Esperado: 2026-10-19)
   Formatado BR: "Expira em 19/10/2026" | Badge: ACTIVE
✅ [PASS] QUARTERLY  -> 2026-12-19 (Esperado: 2026-12-19)
   Formatado BR: "Expira em 19/12/2026" | Badge: ACTIVE
✅ [PASS] ANNUAL     -> 2027-09-19 (Esperado: 2027-09-19)
   Formatado BR: "Expira em 19/09/2027" | Badge: ACTIVE
✅ [PASS] LIFETIME   -> null (Esperado: null)
   Formatado BR: "Acesso vitalício" | Badge: LIFETIME

Total de testes: 7 | Aprovados: 7
✅ SEÇÃO 23 - CÁLCULOS DE EXPIRAÇÃO APROVADOS COM 100% DE SUCESSO!
```

### 3.2. Teste Real E2E de Expiração e Job (`test-fase11-e2e-real.ts`)

```text
=== WEBGRAN FASE 11 — TESTE DE EXPIRAÇÃO DE ACESSO REAL E2E ===
[Setup] Produto "A IRMÃ QUE TODOS SUBESTIMARAAM" configurado para duration="monthly".
[Setup] Access 620b1b1e-a505-4747-ba66-f29594422d6e atualizado com grantedAt=2026-09-19T12:45:17.439Z e expiresAt=2026-10-19T12:45:17.439Z.

[Estado do Access no Banco]:
- Access ID: 620b1b1e-a505-4747-ba66-f29594422d6e
- Status: ACTIVE
- Delivery Status: DELIVERED
- Granted At (Início): Sat Sep 19 2026 09:45:17 GMT-0300
- Expires At (Expiração): Mon Oct 19 2026 09:45:17 GMT-0300
- Expired At: null
- Exibição no Meus Acessos: "Expira em 19/10/2026" (30 dias restantes)

[Testando Backend Job processExpiredAccesses()]:
[processExpiredAccesses] Scanning for expired accesses at 2026-09-19T12:57:49.681Z...
[processExpiredAccesses] Found 0 accesses to expire.

- Diferença calculada entre paidAt e expiresAt: 1 mês(es).

✅ WEBGRAN FASE 11 PASS: Produto mensal gerou exatamente expiresAt = paidAt + 1 mês!
```
