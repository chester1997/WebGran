# Arquitetura de Pagamentos - WebGran

O WebGran lida com a complexidade de dois fluxos financeiros que jamais devem se misturar: o Marketplace (Clientes comprando dos Vendedores) e o Billing (Vendedores pagando o SaaS WebGran).

## Fluxo 1: Mercado Pago Marketplace (Split Payment)

Responsável pelas transações da "ponta". O cliente final não compra do WebGran, mas sim da loja do Vendedor. O Vendedor recebe o dinheiro diretamente em sua conta Mercado Pago e a comissão da plataforma (Application Fee) é separada de forma autônoma.

```mermaid
sequenceDiagram
    participant C as Cliente Final
    participant W as WebGran
    participant MP as Mercado Pago
    participant V as Vendedor
    
    %% Setup OAuth
    V->>W: Conectar Mercado Pago
    W->>MP: Inicia OAuth
    MP-->>V: Tela de Autorização
    V->>MP: Concede permissão
    MP-->>W: Authorization Code
    W->>MP: Troca por Access Token
    W-->>W: Salva seller_payment_connections
    
    %% Flow
    C->>W: Compra produto (Mini App)
    W->>MP: Create Preference (inclui application_fee)
    MP-->>W: Retorna Checkout URL
    W-->>C: Redireciona
    C->>MP: Efetua pagamento
    MP-->>V: Saldo do produto (menos split)
    MP-->>W: Saldo do split (comissão)
    MP->>W: Webhook (payment.updated)
    W-->>W: order = PAID -> AccessService.grantAccess()
```

## Fluxo 2: Cora Bank (Platform Billing / Mensalidade)

Responsável pela saúde financeira da plataforma. O Vendedor paga uma mensalidade fixa para o WebGran poder manter sua loja e bots rodando.

```mermaid
sequenceDiagram
    participant V as Vendedor
    participant W as WebGran
    participant C as Cora Bank
    
    %% Billing Cron / Creation
    W->>C: POST /invoices (vencimento X)
    C-->>W: Retorna BR Code (Pix)
    W-->>W: Salva Invoice = PENDING
    W->>V: Notifica cobrança via Bot / Painel
    V->>C: Paga BR Code no App do Banco
    C->>W: Webhook Invoice PAID
    W-->>W: Atualiza Invoice e Subscription para ACTIVE
```

## Diretórios e Abstrações

* `src/lib/payments/types`: Interfaces isoladas garantindo o Liskov Substitution Principle. Qualquer provedor pode assumir a vaga.
* `src/lib/payments/providers/mercado-pago.ts`: Implementação do Marketplace.
* `src/lib/payments/providers/cora.ts`: Implementação do Billing por PIX corporativo.

> **Regra de Ouro**: Tokens NUNCA transitam para o frontend. Não confie no webhook cegamente sem validar a assinatura do Headers. O ID de pagamento SEMPRE deve ser consultado individualmente na base do provider antes de processar qualquer entrega de produto ou plano.
