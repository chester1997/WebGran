# Fluxo de Compra e Pagamento PIX NATIVO do WebGran

## Visão Geral

O WebGran utiliza um **fluxo de pagamento PIX 100% nativo e transparente** dentro do Telegram Mini App. O cliente nunca é redirecionado para navegadores externos (`Checkout Pro`, `window.open` ou popups).

---

## Arquitetura do Fluxo

```
Telegram Client
      │
      ▼
Telegram Bot (Menu Button / Link)
      │
      ▼
Telegram Mini App (Catalog & Cart)
      │
      ▼ [Clique "Finalizar Compra"]
Server Action: createCheckoutSession()
      │
      ├── 1. Valida produtos & cria Order (PENDING)
      ├── 2. Obtém Access Token do Vendedor (OAuth Decrypt)
      ├── 3. Chama Mercado Pago Transparente (`POST /v1/payments`, method: 'pix')
      └── 4. Retorna QR Code (Base64) + PIX Copia e Cola para o Mini App
      │
      ▼
Interface Nativa PIX do Mini App
      ├── Exibe QR Code Base64 nativo
      ├── Botão "Copiar Código" com toast feedback (2s)
      └── Polling em segundo plano (`GET /api/orders/[orderId]/status`)
      │
      ▼
Cliente Realiza o Pagamento no App do Banco
      │
      ▼
Mercado Pago Webhook (`POST /api/webhooks/mercadopago`)
      │
      ▼
AccessDeliveryService.processOrderDelivery(orderId)
      ├── Atualiza Order para `status: paid`
      ├── Gera convite individual/temporário do Telegram
      └── TelegramDeliveryService envia o acesso via Bot Telegram & libera na tela do Mini App
```

---

## Tabela de Banco de Dados (`orders`)

Foram adicionados os campos para suporte a PIX transparente:
- `pix_qr_code`: String do código Copia e Cola do PIX.
- `pix_qr_code_base64`: Imagem base64 do QR Code para exibição instantânea.
- `pix_expires_at`: Data e hora de expiração da cobrança PIX.
