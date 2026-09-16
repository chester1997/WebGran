# Auditoria e Plano de Refatoração - WebGran

## 1. Arquitetura Atual (O que já temos)

*   **Stack:** Next.js (App Router), React, Tailwind CSS, shadcn/ui.
*   **Banco de Dados:** PostgreSQL (Neon) via Drizzle ORM.
*   **Autenticação:** NextAuth.js (Credentials provider) isolando `admin` e `seller`.
*   **Multi-tenant:** Sólido no nível do banco de dados. Quase todas as entidades operacionais (`products`, `orders`, `categories`, `telegramBots`, `telegramCustomers`, `accesses`) possuem uma chave estrangeira obrigatória `storeId`.
*   **Theme Engine:** Arquitetura centralizada. A loja renderiza componentes baseados em `store.themeId` (resolvido dinamicamente no backend). O tema "Studio" é o único ativo, focado em UX de streaming. Não há seletores de tema vazados para o Lojista.
*   **Integração Telegram:** `StoreResolver` intercepta webhooks `/start` identificando o `botId`, buscando a loja correta e validando o cliente, injetando segurança cruzada no Mini App via JWT em Cookies (`tg_session`).
*   **Pagamentos:** Interfaces e provedores isolados (`MarketplacePaymentProvider` para Mercado Pago e `PlatformBillingProvider` para Cora), schemas de Invoices e Subscriptions.
*   **Onboarding:** Rota `/register` operando a criação da conta, provisionamento da loja e atribuição do Tema Padrão Global de forma atômica.

## 2. Problemas Encontrados (O que precisa melhorar)

*   **UX/UI do Painel do Vendedor (`/seller`):** Atualmente, parece um "CRUD administrativo simples". Falta identidade de SaaS profissional. Faltam Skeletons (loading states), Empty States ilustrados, Toasts e modais/drawers complexos.
*   **Estrutura do Sidebar do Vendedor:** Desatualizada em relação às novas diretrizes. Precisa das rotas exatas: Dashboard, Minha Loja, Meu Bot, Produtos, Categorias, Pedidos, Clientes, Configurações.
*   **Gerenciamento de Produtos e Categorias:** Ausência de listagens avançadas (filtros, ordenação, paginação) e uma página de criação/edição dividida em blocos (Informações, Mídia, Comercial, Organização, Entrega).
*   **Centro "Meu Bot":** A página ainda não reflete o dashboard de controle e monitoramento descrito (Status, Webhook, Teste).
*   **Centro "Minha Loja":** Falta a subdivisão clara em abas (Informações, Identidade, Preview).
*   **Componentização Excessivamente Simples:** Muitos formulários foram feitos em HTML cru em vez de usar os form controls padronizados do Design System (shadcn/ui).

## 3. O que será preservado

*   O core do banco de dados (esquema multi-tenant perfeito).
*   A Engine de Temas e o renderizador dinâmico.
*   O sistema de sessão JWT (`tg_session`) do Mini App.
*   O mecanismo de roteamento de Webhooks do Telegram.
*   O algoritmo de Ranking Top 10 automático (baseado em pedidos pagos).
*   A arquitetura das pastas e abstrações de pagamento (`src/lib/payments`).

## 4. O que será refatorado (Plano de Ação)

*   **Fase 1: Estrutura Visual do SaaS (Em andamento)**
    *   Refatorar `layout.tsx` do `/seller` para o novo modelo de navegação.
    *   Estabelecer os componentes base do Design System (Toasts, Skeletons, Empty States).
*   **Fase 2: O Novo Dashboard e 'Minha Loja'**
    *   Transformar o Dashboard com gráficos/métricas reais filtráveis.
    *   Construir a tela de gerenciamento central da Loja (Informações + Preview do Mini App).
*   **Fase 3: Hub do Telegram ('Meu Bot') e Clientes**
    *   UX de conexão do bot simplificada, com status em tempo real.
    *   Visualização de Clientes estilo CRM.
*   **Fase 4: Motor de Catálogo (Produtos & Categorias)**
    *   Drawers/Modais para categorias.
    *   Editor avançado de Produtos em múltiplas seções.
*   **Fase 5: Checkout e Pedidos**
    *   Painel Kanban/Tabela detalhada de Pedidos com ações de estorno e detalhes de acesso.

## 5. Possíveis Riscos

*   **Vazamento de Dados (Cross-tenant):** Com a introdução de rotas mais complexas e paginação, o risco de esquecer um `eq(table.storeId, currentStore.id)` aumenta. Solução: Centralizar queries de catálogo em Repositórios (Services) para evitar esquecimentos nos Server Actions.
*   **Performance do Theme Engine:** O uso exagerado de imports dinâmicos dentro do Theme Engine pode retardar o TTFB (Time to First Byte) se não houver caching/prerendering apropriado no Next.js 14.

---
*Status: Preparando melhorias estruturais iniciais.*
