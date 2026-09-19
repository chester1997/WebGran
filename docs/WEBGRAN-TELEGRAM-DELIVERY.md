# WEBGRAN — ARQUITETURA E FLUXO DE ENTREGA TELEGRAM (FASE 7)

## 1. MODELO DE DADOS & SEPARAÇÃO DE RESPONSABILIDADES

O sistema WebGran mantém uma separação estrita de entidades para garantir o isolamento Multi-Tenant e a precisão do destino de entrega:

- **`TelegramBot`**: Pertence a uma `Store`. Fornece o `botToken` para comunicação e geração de links.
- **`Product`**: Contém o `deliveryType` (`telegram` / `TELEGRAM_CHAT`) e o `deliveryValue` que armazena a origem exclusiva do **`telegramChatId`** (ex: `-1001234567890`).
- **`TelegramCustomer`**: Identifica o comprador através do **`telegramUserId`** numérico.
- **`Access`**: Registro de entrega vinculado a `orderId`, `productId`, `customerId` e `storeId`, armazenando `status` (`PENDING` | `ACTIVE` | `FAILED`), `deliveryStatus` (`PENDING` | `DELIVERED` | `FAILED`), `inviteLink` e `deliveryError`.

---

## 2. REGRAS FUNDAMENTAIS E ELIMINAÇÃO DE FALLBACKS

1. **Destino Exclusivo**: O destino da entrega vem **estritamente de `Product.deliveryValue`** (`telegramChatId`).
2. **Sem Fallbacks Perigosos**: Fica proibido o uso de `@webgran_oficial`, `bot.username`, `store.slug` ou qualquer string genérica como destino alternativo.
3. **Ausência de ID**: Se `Product.deliveryValue` estiver vazio ou nulo no momento da entrega, o sistema falha explicitamente com `deliveryError = "Produto sem telegramChatId configurado."` e marca `Access.status = 'FAILED'`.

---

## 3. RESOLUÇÃO DO BOT & VALIDAÇÃO DE PERMISSÕES

O bot responsável pela entrega é resolvido contextualmente pela loja da ordem:
`Order → Store → TelegramBot → Bot Token → Product.telegramChatId`

Antes de tentar gerar convites, a classe `TelegramDeliveryService` executa uma validação em duas etapas na Bot API do Telegram:

1. **`getChat(telegramChatId)`**: Valida se o grupo/canal existe.
2. **`getChatMember(telegramChatId, bot.botId)`**: Valida se o bot está presente e verifica:
   - `status === 'administrator'` ou `status === 'creator'`
   - `can_invite_users === true` (ou `status === 'creator'`)

Se qualquer uma das condições falhar, o acesso marca `Access.status = 'FAILED'` e registra a mensagem de erro exata retornada pela API do Telegram.

---

## 4. VERIFICAÇÃO SE O COMPRADOR JÁ É MEMBRO

Antes de criar um convite dinâmico, o sistema chama:
`getChatMember(telegramChatId, customer.telegramUserId)`

- **Se o comprador já for membro** (`status` é `'member'`, `'administrator'` ou `'creator'`):
  - Não gera novo convite desnecessariamente.
  - Define `Access.status = 'ACTIVE'`, `Access.deliveryStatus = 'DELIVERED'`.
  - Envia a mensagem: *"🎉 PAGAMENTO CONFIRMADO! Você já possui acesso ao conteúdo."*.
- **Se o comprador não for membro**:
  - Chama `createChatInviteLink({ chat_id: telegramChatId, name: 'WebGran-orderId', member_limit: 1 })`.
  - Salva o `inviteLink` único no registro de `Access`.
  - Define `Access.status = 'ACTIVE'`, `Access.deliveryStatus = 'DELIVERED'`.
  - Envia a mensagem de confirmação com o botão *"🎬 Acessar conteúdo"*.

---

## 5. VALIDAÇÃO NA CRIAÇÃO E EDIÇÃO DO PRODUTO (PAINEL SELLER)

Nas Server Actions de criação (`createProductAction`) e edição (`updateProductAction`):
- Quando o vendedor define `deliveryType === 'telegram'`, o backend executa imediatamente `TelegramDeliveryService.validateBotAndChatPermission(botToken, telegramChatId, bot.botId)`.
- Se o bot da loja não for administrador ou não tiver `can_invite_users`, a ação bloqueia o salvamento e retorna o erro amigável ao vendedor.

---

## 6. RETRY DE ENTREGA & IDEMPOTÊNCIA

A função `AccessDeliveryService.retryAccessDelivery(accessId, storeId)` permite que o vendedor recarregue a entrega de acessos que falharam:
- Se o pedido já estiver `paid`, **não cria novos pagamentos**.
- Se o `Access` já estiver `ACTIVE` e `DELIVERED`, **não repete envios nem gera convites duplicados**.
- Se o `Access` estiver `FAILED`, re-executa a validação e entrega de forma segura.

---

## 7. TABELA DE VERIFICAÇÃO DE REQUISITOS (FASE 7)

| Requisito / Teste | Status | Observação |
| :--- | :---: | :--- |
| **Destino vindo do Product.telegramChatId** | **PASS** | `Product.deliveryValue` é a única fonte |
| **Eliminação de @webgran_oficial** | **PASS** | Removidos todos os fallbacks a usernames |
| **Resolução do Bot por Store** | **PASS** | Resolvido via `Order -> Store -> TelegramBot` |
| **Validação Admin + can_invite_users** | **PASS** | `validateBotAndChatPermission` valida admin e permissão de convite |
| **Identificação por Telegram User ID** | **PASS** | `TelegramCustomer.telegramUserId` utilizado nas consultas |
| **Checagem de membro existente** | **PASS** | `checkBuyerMembership` evita criar convites redundantes |
| **Convite Único (`member_limit: 1`)** | **PASS** | `createTelegramInvite` gera link individual por compra |
| **Validação na Criação do Produto** | **PASS** | `createProductAction` / `updateProductAction` validam admin |
| **Retry Idempotente** | **PASS** | `retryAccessDelivery` seguro para repetições sem duplicar |

---

## 8. RESULTADO FINAL

**STATUS FINAL: SUCESSO (PASS)**
A entrega no Telegram foi completamente blindada para garantir multi-tenancy estrito, validação prévia de permissões do bot, verificação de membros existentes e eliminação de qualquer fallback incorreto de usernames.
