# FASE 22 — Reestruturação de Configurações, Assinatura WebGran SaaS e Auditoria do Acesso Admin

## Summary of Changes & Audit Results

### 1. Reestruturação das Configurações
- **Remoção da Área "Forma de Recebimento"**: Removida a aba de configuração do Mercado Pago da página `/seller/settings`.
- **Manutenção Exclusiva do Recebimento na Sidebar**: O menu `Recebimento` na sidebar permanece como a única área operacional dos pagamentos realizados pelos **CLIENTES ao VENDEDOR**.
- **Nova Estrutura da Página (`/seller/settings`)**:
  1. `Perfil do Vendedor`: Gerenciamento do perfil pessoal da conta.
  2. `Assinatura WebGran`: Gerenciamento do pagamento do vendedor ao WebGran SaaS.

---

### 2. Perfil do Vendedor
- Mantida a estrutura completa com foto de perfil, upload otimizado, nome do vendedor, e-mail da conta (somente leitura), persistência no banco (`users.avatar_url`) e sincronização em tempo real com a sidebar.

---

### 3. Assinatura WebGran SaaS & Plano Único
- **Plano Único e Centralizado**:
  - Nome: `WebGran`
  - Preço Central: `R$ 89,90/mês`
  - Sem seletores de múltiplos planos ou ambiguidades.
- **Modelos no Banco de Dados**:
  - `subscription_plans`: Cadastrado plano fixo com `price = 89.90`.
  - `subscriptions`: Registra status (`ACTIVE`, `PENDING`, `PAST_DUE`, `CANCELLED`, `EXPIRED`) e datas do período.
  - `invoices`: Registra cobranças associadas com `amount = 89.90` e dados PIX da Cora.

---

### 4. Integração Cora Bank (PIX & Cobranças)
- **CoraProvider (`src/lib/payments/providers/cora.ts`)**:
  - Autenticação OAuth Client Credentials (`CORA_CLIENT_ID` / `CORA_CLIENT_SECRET`).
  - Geração de cobranças PIX Billed Invoice com QR Code e payload PIX Copia e Cola.
- **Validação de Valor & Idempotência**:
  - Todas as cobranças são estritamente validadas no backend com o valor fixo de **R$ 89,90**.
- **Webhook Cora (`/api/billing/cora/webhook`)**:
  - Endpoint seguro e idempotente para recebimento dos eventos de pagamento.
  - Atualização automática de `invoices.status = 'PAID'` e extensão da assinatura para `ACTIVE` (+30 dias).
- **Verificação Server-Side ("Já paguei")**:
  - O botão "Já paguei" dispara `/api/billing/subscription/verify`, que consulta o status real no servidor antes de alterar o banco.

---

### 5. Auditoria e Correção do Acesso Administrativo (Admin Audit)

#### Diagnóstico Original:
1. **Loop de Redirecionamento no `requireSeller()`**:
   - Quando um usuário com `role === 'admin'` acessava páginas do vendedor ou realizava login, `requireSeller()` continha um redirecionamento forçado `if (user.role === 'admin') redirect('/admin')`.
   - Isso impedia administradores que também possuem lojas de visualizar o painel `/seller` ou causava conflito com o middleware.
2. **Resolução de Roles (`requireAdmin`, `requireSeller`, `middleware.ts`)**:
   - Atualizado para tratar `admin` e `super_admin` de forma insensível a maiúsculas/minúsculas.
   - Administradores (`admin` e `super_admin`) têm acesso total ao painel administrativo `/admin`.
   - `requireSeller()` e `getCurrentStore()` foram ajustados para permitir que administradores acessem o contexto do vendedor sem loops de redirecionamento.

#### Testes de Acesso ao Admin:
- Usuário `SUPER_ADMIN` / `admin` → Acesso liberado ao `/admin` (Painel Administrativo com métricas de Lojas, Vendedores, Bots, Faturamento e Clientes).
- Usuário `SELLER` → Redirecionado para `/seller`.
- Usuário não autenticado → Redirecionado para `/login`.

---

### 6. Validação e Deploy
- `npm run build`: Compilado com sucesso e 0 erros de TypeScript.
- Código enviado para a branch `main` e ativo em produção na Vercel!
