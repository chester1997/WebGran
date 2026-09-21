# Integração Mercado Pago - Assinatura WebGran SaaS (R$ 89,90/mês)

## 1. Visão Geral da Arquitetura
A assinatura do WebGran SaaS (R$ 89,90/mês) foi totalmente integrada ao **Mercado Pago**, canalizada diretamente para a conta do proprietário da plataforma (`SUPER_ADMIN`).

### Separação Rígida de Fluxos:
- **Fluxo A — Produtos das Lojas (Marketplace)**: Cliente final -> Mercado Pago do Vendedor -> Pedido (`orders`) -> Acesso (`accesses`) -> Entrega no Telegram. (Permanece 100% intacto).
- **Fluxo B — Assinatura WebGran SaaS**: Vendedor -> Configurações -> Assinatura R$ 89,90 -> Mercado Pago do Proprietário (`platform_payment_connections`) -> Fatura (`invoices`) -> Ativação de Assinatura (`subscriptions`).

---

## 2. Conexão no Painel Admin (`/admin`)
A conta Mercado Pago que recebe as assinaturas pertence **exclusivamente ao proprietário da plataforma**.
- **Localização**: `/admin/settings` (Card Mercado Pago).
- **Formatos de Conexão Suportados**:
  1. **Fluxo OAuth 1-Click**:
     - `GET /api/admin/payments/mercadopago/connect`: Redireciona para o portal de autorização do Mercado Pago.
     - `GET /api/admin/payments/mercadopago/callback`: Recebe o código OAuth, troca por tokens criptografados e armazena em `platform_payment_connections`.
  2. **Configuração Direta de Access Token**:
     - `POST /api/admin/payments/mercadopago/credentials`: Permite inserir e validar diretamente o Access Token de Produção (`APP_USR-...`).
- **Segurança**: Tokens privados e secrets são mantidos estritamente no backend em `platform_payment_connections` e jamais são expostos na interface gráfica ou em `localStorage`.

---

## 3. Emissão de Cobrança PIX e Validade de 30 Minutos
Quando o vendedor clica em **`[ Pagar R$ 89,90 ]`**:
- O valor é fixado estritamente no backend em **R$ 89,90**.
- É calculada no servidor a janela de expiração de **exatos 30 minutos** (`createdAt + 30 minutos`).
- A cobrança é emitida via API oficial do Mercado Pago (`POST https://api.mercadopago.com/v1/payments`) enviando:
  - `transaction_amount`: `89.90`
  - `payment_method_id`: `'pix'`
  - `date_of_expiration`: `expiresAt.toISOString()` (30 minutos no futuro)
  - `external_reference`: `WEBGRAN_SUB_{invoiceId}`
  - Cabeçalho `X-Idempotency-Key`: UUID único.

---

## 4. Experiência do Vendedor e Temporizador Regressivo
Na tela do vendedor (`/seller/settings`):
- É exibido o QR Code oficial e o Pix Copia e Cola retornado pelo Mercado Pago.
- Um temporizador regressivo (`29:59`, `29:58`...) é calculado com base no `expiresAt` do servidor. **Não reinicia com o F5 / recarregamento da página**.
- O botão **`[ Já paguei ]`** consulta em tempo real o status no Mercado Pago (`GET /v1/payments/{paymentId}`).
- Se a cobrança expirar após 30 minutos sem pagamento:
  - A interface exibe a mensagem: *"Este PIX expirou. Gere um novo PIX para continuar."*
  - É exibido o botão **`[ Gerar novo PIX ]`**, que emite uma nova cobrança no Mercado Pago com novo ID, novo código Pix Copia e Cola e nova janela de 30 minutos.

---

## 5. Processamento de Webhook & Idempotência
- **Endpoint do Webhook de Assinatura**: `POST /api/webhooks/mercadopago/platform`
- Quando a notificação de pagamento é recebida:
  1. Consulta server-side o status do pagamento no Mercado Pago.
  2. Valida o status `approved` e o valor `89.90`.
  3. Atualiza o status da fatura para `PAID` e salva `paidAt`.
  4. Atualiza o status da assinatura em `subscriptions` para `ACTIVE` e renova o período final por 30 dias (`currentPeriodEnd = paidAt + 1 mês`).
- O webhook é idempotente e pode receber notificações duplicadas sem reprocessar faturas já pagas.

---

## 6. Dashboard Administrativo de Assinaturas
No painel Admin em `/admin/subscriptions`:
- **Cards Métricos**: Faturamento no mês, Assinaturas ativas, Pagamentos pendentes, Pagamentos expirados.
- **Tabela Financeira**: Vendedor, E-mail, Valor (R$ 89,90), Status (`PAID`, `PENDING`, `EXPIRED`, `CANCELLED`, `FAILED`), ID do Mercado Pago, Data de criação, Data de pagamento e Data de expiração.
