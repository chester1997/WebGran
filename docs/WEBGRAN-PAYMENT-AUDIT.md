# WEBGRAN — AUDITORIA COMPLETA DE PROJETO & FLUXO DE COMPRA (FASE 1)

---

## 1. Arquitetura Atual do Projeto

### Stack Tecnológica & Infraestrutura
- **Framework Principal**: Next.js (Versão `16.3.5` Turbopack com **App Router**).
- **Linguagem**: TypeScript (Configuração estrita e sem erros de compilação `tsc --noEmit`).
- **Estilização**: Tailwind CSS v4 com `shadcn/ui`, `lucide-react` e `@theme inline` em `globals.css`.
- **Banco de Dados**: Serverless Postgres hospedado no **Neon DB**.
- **ORM & Migrações**: **Drizzle ORM** (`src/db/schema.ts`) com migrações via scripts Node/Drizzle (`src/db/add-access-cols.ts`, `add-secret-token.ts`, `add-welcome-cols.ts`).
- **Autenticação**:
  - **Vendedor/Admin**: NextAuth.js (`/api/auth/[...nextauth]`) via Email/Senha com sessão JWT e cookies seguros.
  - **Comprador (Telegram Mini App)**: Sessão JWT assinada em cookie/cabeçalho originada na validação do `initData` do Telegram (`/api/telegram/auth`).
- **Integração Telegram**:
  - `window.Telegram.WebApp` injetado pelo SDK `https://telegram.org/js/telegram-web-app.js`.
  - Serviço de Bot dedicado (`src/lib/telegram/bot.ts` e `TelegramBotService`).
  - Bot Webhook canônico em `/api/telegram/webhook` sem redirecionamento 308 e validado com `X-Telegram-Bot-Api-Secret-Token`.
- **Integração Mercado Pago**:
  - Módulo `MercadoPagoProvider` (`src/lib/payments/providers/mercado-pago.ts`).
  - Conexão OAuth de vendedores com renovação automática de `refresh_token` e criptografia AES-256 de chaves no Neon DB.
  - Webhook de notificações em `/api/webhooks/mercadopago`.

---

## 2. Mapeamento do Fluxo Atual (Como Funciona Hoje)

### Sequência Atual de Execução:
```
Telegram Bot (Usuário clica /start ou Botão Inline)
  ↓
Abre Telegram Mini App (/miniapp/[slug])
  ↓
Catálogo / StudioHome (Navegação por categorias e produtos)
  ↓
Página do Produto (/miniapp/[slug]/product/[productSlug]) -> Clica em "Comprar"
  ↓
Carrinho (/miniapp/[slug]/cart) -> Clica em "Finalizar Compra"
  ↓
Server Action (createCheckoutSession em src/app/miniapp/[slug]/cart/actions.ts)
  ↓
Cria Order (PENDENTE) no Neon DB
  ↓
Invoca MercadoPagoProvider.createCheckoutPreference() (Checkout Pro)
  ↓
REDIRECIONA COMPRADOR FORA DO MINI APP (Abre navegador externo com init_point do Mercado Pago)
  ↓
Comprador paga no site externo do Mercado Pago
  ↓
Mercado Pago envia Webhook (POST /api/webhooks/mercadopago)
  ↓
WebGran valida pagamento (status = approved), marca Order como 'paid'
  ↓
AccessDeliveryService concede Access (ACTIVE / DELIVERED) e envia mensagem no Telegram via TelegramDeliveryService
```

### Componentes & Envolvidos:
- **Página de Checkout/Carrinho**: `src/components/themes/studio/views/StudioCart.tsx`
- **Server Action de Compra**: `src/app/miniapp/[slug]/cart/actions.ts` (`createCheckoutSession`)
- **Gateway de Pagamento**: `src/lib/payments/providers/mercado-pago.ts` (`createCheckout`)
- **Serviço de Entrega**: `src/lib/delivery/access-delivery-service.ts` & `telegram-delivery-service.ts`

---

## 3. Análise Detalhada do Checkout Atual

### Diagnóstico do Comportamento Atual:
1. Ao clicar em **"Finalizar Compra"** no carrinho, o WebGran chama `createCheckoutSession()`.
2. A ação cria uma preferência de checkout no Mercado Pago (`https://api.mercadopago.com/checkout/preferences`).
3. O servidor retorna a URL `preference.url` (`init_point` do Mercado Pago).
4. O Mini App chama `window.Telegram.WebApp.openLink(result.checkoutUrl)` ou `window.location.href`.
5. **Problema**: O comprador **SAI** do Mini App e é levado para a página web externa do Mercado Pago no navegador do celular. Ele precisa realizar login ou digitar dados no site do Mercado Pago fora do Telegram.

---

## 4. Análise Comparativa do Vídeo de Referência vs. Objetivo Desejado

### Comportamento Observado no Vídeo de Referência:
1. O usuário entra no Bot no Telegram e clica no botão do Mini App.
2. O Mini App abre em tela cheia suavemente dentro do aplicativo do Telegram.
3. O usuário seleciona o produto e clica em **Comprar/Finalizar**.
4. O Mini App **NÃO ABRE O NAVEGADOR EXTERNO**. Ele transita para um estado visual *"Gerando cobrança..."* / *"Gerando PIX..."*.
5. Em menos de 2 segundos, a tela é preenchida nativamente dentro do Mini App com:
   - **Valor Total a Pagar**.
   - **QR Code PIX** visível e legível na tela.
   - Campo com o **Código PIX Copia e Cola**.
   - Botão em destaque **"Copiar Código PIX"** (que copia a chave para a área de transferência e exibe confirmação visual).
   - Estado de escuta *"Aguardando pagamento..."* com animação ou timer.
6. Assim que o pagamento é efetuado no aplicativo do banco, o Mini App detecta automaticamente a aprovação (via Polling ou Webhook em tempo real) e altera a tela sem recarregar para:
   - *"🎉 Pagamento Confirmado!"*
   - Botão direto: *"🎬 Acessar Conteúdo"*.
7. O usuário recebe simultaneamente a mensagem de boas-vindas/acesso no chat privado com o Bot no Telegram.

### O Novo Fluxo NATIVO a Implementar no WebGran:
```
Telegram Mini App
  ↓
Comprador Clica "Finalizar Compra"
  ↓
Estado Visual: "Gerando cobrança..." (Dentro do Mini App)
  ↓
Backend chama API Transparente do Mercado Pago (/v1/payments com payment_method_id = 'pix')
  ↓
Backend retorna: qr_code, qr_code_base64, payment_id, status
  ↓
Mini App exibe Tela de Pagamento PIX Nativa:
  - QR Code Visual (Imagem Base64)
  - Botão "Copiar Código PIX"
  - Contador / Status "Aguardando Pagamento..."
  ↓
Polling automático no Mini App + Notificação assíncrona do Webhook Mercado Pago
  ↓
Ao confirmar 'approved':
  - Tela muda para "Pagamento Confirmado!"
  - Concede Access (ACTIVE/DELIVERED)
  - Bot envia mensagem com Link de Convite no Telegram
```

---

## 5. Auditoria de Tecnologias & APIs

### Mercado Pago API & SDK
- **API Atual Utilizada**: `https://api.mercadopago.com/checkout/preferences` (Checkout Pro / Redirecionamento).
- **API Necessária para PIX Nativo**: API de Pagamentos Transparentes (`POST https://api.mercadopago.com/v1/payments`).
- **Payload do PIX Transparente**:
  ```json
  {
    "transaction_amount": 49.90,
    "description": "Produto Exemplo - Loja X",
    "payment_method_id": "pix",
    "payer": {
      "email": "cliente@email.com",
      "first_name": "Nome",
      "last_name": "Sobrenome"
    },
    "notification_url": "https://www.webgran.online/api/webhooks/mercadopago",
    "metadata": {
      "order_id": "uuid-do-pedido",
      "store_id": "uuid-da-loja"
    }
  }
  ```
- **Campos de Resposta do Mercado Pago**:
  - `point_of_interaction.transaction_data.qr_code` (Código Copia e Cola em texto).
  - `point_of_interaction.transaction_data.qr_code_base64` (Imagem do QR Code pronta para renderização em `<img src="data:image/png;base64,..." />`).
  - `id` (Payment ID numérico no Mercado Pago).

---

## 6. Auditoria do Banco de Dados Neon DB

### Estrutura das Tabelas Existentes (`src/db/schema.ts`):
- `stores`: `id`, `ownerId`, `name`, `slug`, `logoUrl`, etc.
- `telegramBots`: `id`, `storeId`, `botId`, `username`, `tokenEncrypted`, `secretToken`, `buttonText`.
- `products`: `id`, `storeId`, `botId`, `title`, `price`, `deliveryType`, `deliveryValue`.
- `telegramCustomers`: `id`, `storeId`, `telegramUserId`, `username`, `firstName`, `lastName`.
- `orders`: `id`, `storeId`, `customerId`, `status`, `subtotal`, `total`, `paymentId`, `preferenceId`, `paymentMethod`, `paidAt`.
- `accesses`: `id`, `storeId`, `customerId`, `productId`, `orderId`, `deliveryType`, `telegramChatId`, `inviteLink`, `status`, `deliveryStatus`, `deliveryError`.

### Lacunas Identificadas no Schema Atual:
Para suportar o PIX Nativo e o Polling de Pagamento sem dependências externas, os seguintes campos conceituais precisam ser adicionados na tabela `orders`:
- `pixQrCode`: Texto bruto do código PIX Copia e Cola.
- `pixQrCodeBase64`: Imagem do QR Code em Base64 para exibição instantânea.
- `pixExpiresAt`: Data/hora de expiração do PIX gerado.

---

## 7. Auditoria da Entrega Telegram & Autenticação

### Segurança Multi-Tenant & Telegram InitData:
- **Autenticação de Compradores**: O WebGran já possui a rota `/api/telegram/auth` que recebe o `initData` enviado pelo Telegram Mini App e valida a hash usando a chave HMAC do Bot Token da loja correspondente.
- **Isolamento de Tenant**:
  - A loja é resolvida pelo `storeSlug`.
  - O bot é buscado estritamente por `telegramBots.storeId`.
  - O produto e canal de entrega pertencem exclusivamente à loja da sessão.

### Serviço de Entrega (`TelegramDeliveryService` & `AccessDeliveryService`):
- O sistema já possui a camada isolada que cria links de convite dinâmicos (`createChatInviteLink`) com limite de 1 membro e envia a mensagem automática no Telegram assim que o webhook confirma `status = 'paid'`.

---

## 8. Diagnóstico de UI / UX e Pontos Pendentes

### 1. Botão de Adicionar ao Carrinho com Check Permanente:
- **Causa**: O componente `AddToCartButton.tsx` (ou similar) altera o estado local para `added = true` e não reseta após um tempo determinado, fazendo o botão exibir um `Check` fixo.
- **Solução Futura**: Transformar o estado de confirmação em um efeito temporário de 2 segundos ou disparar um Toast de notificação sem travar o botão principal.

### 2. Tratamento do Modal / Tela de Erro ("Ops! Algo deu errado"):
- **Causa**: Quando o Mini App é aberto em navegador desktop comum sem parâmetros de sessão ou quando o `initData` do Telegram está ausente/expirado, algumas rotas falham ao tentar decodificar a sessão `getMiniAppSession()`.
- **Solução Futura**: Tratar graciosamente o fallback de visualização pública da loja quando a sessão do Telegram não estiver presente.

---

## 9. Resumo Final da Auditoria (FASE 1)

```
AUDITORIA CONCLUÍDA

Fluxo Atual:
Mini App -> Carrinho -> Mercado Pago Checkout Pro (Abre navegador externo) -> Retorno externo.

Problema Principal:
O cliente sai do Telegram ao tentar pagar, degradando a experiência de conversão e fugindo do fluxo nativo do Telegram Mini App.

Fluxo Desejado:
Mini App -> Carrinho -> Finalizar -> API PIX Transparente -> QR Code + Copia e Cola NATIVO no Mini App -> Polling/Webhook -> Liberação de Acesso Automática sem sair do Telegram.

Arquivos Principais Mapeados:
- src/app/miniapp/[slug]/cart/actions.ts (Criador do checkout)
- src/components/themes/studio/views/StudioCart.tsx (Interface do carrinho)
- src/lib/payments/providers/mercado-pago.ts (Integração MP)
- src/lib/delivery/access-delivery-service.ts (Entrega de acesso)
- src/db/schema.ts (Esquema do banco Neon)

Alterações Necessárias na Próxima Fase:
1. Criar método createPixPayment() no MercadoPagoProvider usando a API /v1/payments.
2. Adicionar campos pixQrCode, pixQrCodeBase64 e pixExpiresAt no schema de orders.
3. Criar a nova interface visual de Checkout PIX Nativo no Mini App (com QR Code, Copia e Cola e Polling de status).
4. Ajustar o botão AddToCartButton para resetar o estado temporário.

Riscos:
- Vendedores que ainda não conectaram o OAuth do Mercado Pago precisarão de tratamento claro de erro ou fallback.
- Expiração do PIX precisa ser tratada visualmente no Mini App caso o cliente demore mais de 30 minutos para pagar.

Próxima Fase Recomendada:
Aguardar autorização do usuário para iniciar a FASE 2 (Implementação do Checkout PIX Nativo no Backend e Frontend do Mini App).
```
