# WEBGRAN — FASE 8: AUDITORIA E2E DA COMPRA, ACCESS E "MEUS ACESSOS"

## 1. RESUMO EXECUTIVO

Durante a auditoria E2E do fluxo de compra em produção no WebGran, identificou-se a causa raiz do problema onde o pagamento via PIX era reconhecido, mas a tela **"Meus Acessos"** (`/miniapp/[slug]/accesses`) permanecia vazia.

### Causa Raiz Identificada:
1. **Filtro estrito de status em `AccessService.getCustomerAccesses`**:
   O método buscava acessos utilizando `eq(accesses.status, 'ACTIVE')`.
   Quando a entrega via Telegram falhava (ex.: validação de bot/chat ou erro da API do Telegram), o serviço registrava o `Access` no banco com `status = 'FAILED'` e `deliveryStatus = 'FAILED'`. Por causa da cláusula `eq(accesses.status, 'ACTIVE')`, o banco de dados omitia completamente o registro do retorno de "Meus Acessos", exibindo a tela vazia para o cliente.
2. **Resolução de Cliente no Frontend (`StudioAccesses`)**:
   A busca dependia exclusivamente do `session.customerId` sem fallback para o `telegramUserId` vinculado à loja em questão.

---

## 2. RESPOSTAS À AUDITORIA DIAGNÓSTICA (SEÇÃO 20 - PERGUNTAS A a K)

| Item | Pergunta | Resposta | Detalhes Diagnósticos |
| :--- | :--- | :--- | :--- |
| **A** | O pagamento da Order foi marcado como `paid` no banco? | **SIM** | Order `1df33228-0db7-48bf-8aea-29c96c4188f6` (`status: paid`, `paidAt: 2026-09-19 11:59:37 UTC`, `total: R$ 1,00`). |
| **B** | Existe o registro `Order` correspondente no banco? | **SIM** | Order ID `1df33228-0db7-48bf-8aea-29c96c4188f6`, `storeId: 09596d3e-6f66-4b61-9c09-7e4051190a10`. |
| **C** | Existe o registro `OrderItem` correspondente? | **SIM** | Item `2edef10b-06e3-4b16-a138-85d30fb08304`, `productId: 81635b4f-54b5-447f-94d2-0b4c6df53188` (Título: *"A IRMÃ QUE TODOS SUBESTIMARAAM"*). |
| **D** | Existe o `TelegramCustomer` associado? | **SIM** | Customer `ae6e6457-90d9-494c-86be-7266d85687e5`, `telegramUserId: "8126417353"`, Nome: `"JOY"`. |
| **E** | Existe o registro `Access` criado para a compra? | **SIM** | Access ID `ac32f0bf-5add-46ba-919d-8a16ffc0d1c8`. |
| **F** | Qual o status real do `Access`? | **`status: FAILED`** / **`deliveryStatus: FAILED`** | Criado no banco no momento do pagamento, mas marcado como `FAILED` devido a erro de validação do canal de entrega. |
| **G** | Qual o erro de entrega (`deliveryError`)? | **`Validação do Telegram Chat (-1004408364902) falhou: Bad Request: chat not found`** | O ID do chat `-1004408364902` cadastrado no produto era inválido ou não encontrou o bot como admin. |
| **H** | Qual o `telegramUserId` da sessão do comprador? | **`8126417353`** | Identificado e autenticado via `tg_session`. |
| **I** | Qual o `telegramChatId` configurado no produto comprado? | **`-1004408364902`** | `Product.deliveryValue`. |
| **J** | O endpoint "Meus Acessos" estava procurando pelo mesmo `customerId`? | **NÃO (Filtrava por status)** | Procurava o `customerId` correto, mas rejeitava registros com `status !== 'ACTIVE'`. |
| **K** | O bot enviou a mensagem antes do término do delivery? | **CORRIGIDO** | Mensagens de entrega e confirmação agora refletem fielmente o status real do delivery. |

---

## 3. CORREÇÕES IMPLEMENTADAS

1. **`AccessService.getCustomerAccesses`**:
   - Atualizado para buscar registros com status em `['ACTIVE', 'PENDING', 'FAILED']` (excluindo apenas `REVOKED` e `EXPIRED`).
   - Garante que compras com falha temporária no bot/Telegram continuem visíveis para o cliente final.

2. **Interface Mini App (`StudioAccesses.tsx`)**:
   - Adicionada resolução resiliente de `customerId` via `session.telegramId` caso `session.customerId` não esteja definido no cookie.
   - Adicionado indicador visual de **"Entrega pendente"** para acessos onde `deliveryStatus === 'FAILED'`, permitindo ver detalhes ou acessar páginas de suporte em vez de omitir o produto.

3. **Garantia E2E de Idempotência e Persistência**:
   - `AccessDeliveryService` cria obrigatoriamente o registro `Access` com `status: 'PENDING'` antes de iniciar qualquer chamada externa ao Telegram.
   - Erros de entrega registram o motivo exato em `deliveryError` sem apagar ou omitir a compra do banco.

---

## 4. EVIDÊNCIA DE VERIFICAÇÃO E2E

```text
=== WEBGRAN FASE 8 VERIFICATION TEST ===
Testing with Order ID: 1df33228-0db7-48bf-8aea-29c96c4188f6
Store ID: 09596d3e-6f66-4b61-9c09-7e4051190a10
Customer ID: ae6e6457-90d9-494c-86be-7266d85687e5 (JOY)

[Meus Acessos Query Result] Total Accesses returned: 1
- Access ID: ac32f0bf-5add-46ba-919d-8a16ffc0d1c8
  Product Title: "A IRMÃ QUE TODOS SUBESTIMARAAM"
  Status: FAILED
  Delivery Status: FAILED
  Invite Link: N/A
  Delivery Error: Validação do Telegram Chat (-1004408364902) falhou: Bad Request: chat not found

✅ WEBGRAN FASE 8 PASSED: Accesses exist and are visible in Meus Acessos query!
```
