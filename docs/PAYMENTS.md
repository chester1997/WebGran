# WebGran Payments

Este documento visa guiar as equipes de engenharia financeira que dão manutenção no núcleo financeiro da plataforma WebGran.

## 1. Fluxo Mercado Pago (Marketplace)
A arquitetura atua no modelo **Marketplace**. Um lojista precisa necessariamente possuir uma conta aprovada no Mercado Pago. O fluxo requer OAuth2 e exige um App Registrado com escopos de pagamentos *offline_access*.

## 2. OAuth
A obtenção da autorização (OAuth) permite gerar um Access Token que atua em nome do Vendedor (`seller`). 
- **NUNCA** pedir para o vendedor colar Access Tokens manualmente, isso quebra o Application Fee e viola diretrizes de segurança do Provedor.

## 3. Split
Quando `createCheckout()` ou `createPayment()` for acionado via Mercado Pago API, o payload enviará a variável de configuração da conta atrelada, e o WebGran coletará automaticamente sua parcela pela variável `application_fee` contida na request.

## 4. Comissão WebGran
O motor da aplicação calcula a comissão em tempo real com base no método estático do contrato da loja (`calculatePlatformFee`), e repassa para o MP em formato flat ou percentage, a depender do Provedor (MP prefere absolute fee).

## 5. Fluxo Cora (B2B Billing)
Para faturar a própria mensalidade da plataforma contra os Vendedores, usa-se a Cora (Banco B2B). Sem split de pagamentos, e focado em PIX Billing.

## 6. Cobrança Pix
Toda Subscription gera Invoices. Uma Invoice PENDING guarda um Payload Copia e Cola em sua coluna `qrCodeText`. O Frontend lê esse texto e renderiza via QR Code ou Botão.

## 7. Webhook
Ambos os fluxos injetam rotas de webhook em `api/webhooks/mercadopago` e `api/webhooks/cora`.
As validações ocorrem via HMAC. Uma falha de assinatura retorna `401 Unauthorized`.

## 8. Assinatura
A Entidade `subscriptions` gerencia o life-cycle (período ativo). Se um `dueDate` for cruzado sem pagamento, o status cai para `PAST_DUE` e posteriormente suspende o serviço (bots offline).

## 9. Estados
Pagamentos não processam devoluções ou aprovações instantâneas a não ser que os retornos sejam literais e assinados. 
- Order states: `pending -> paid -> cancelled`.
- Invoices: `PENDING -> PAID -> EXPIRED`.

## 10. Segurança e Idempotência
Todas as chaves criptográficas (como tokens do MP dos Lojistas) devem ser salvas criptografadas.
Os Webhooks usam Lock no banco (via ID da notificação) para rejeitar payloads processados duas vezes. Idempotency-Keys devem ser anexadas a toda request PUT/POST feita contra a API dos bancos.

## 11. Reembolso
O Reembolso (Refund) deve reverter a Order (cancelling Accesses via AccessService), e no Mercado Pago API deve bater no endpoint genérico de Refunds para devolver o saldo ao end-user e reverter a Application Fee cobrada pelo WebGran.
