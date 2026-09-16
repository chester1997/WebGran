# WebGran Architecture

## Objetivo do WebGran
WebGran é uma plataforma SaaS (Software as a Service) voltada para a criação e gerenciamento de lojas digitais que operam diretamente dentro do Telegram. Ele permite que lojistas e vendedores tenham e-commerces completos utilizando Telegram Mini Apps, oferecendo uma experiência de compra integrada, rápida e nativa no ecossistema do Telegram.

## Arquitetura Geral
O sistema adota uma arquitetura em camadas focada em Serverless utilizando Next.js App Router (Fullstack).

### Stack Tecnológica
- **Framework Principal:** Next.js (App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS
- **Componentes de UI:** shadcn/ui
- **Ícones:** Lucide React
- **Banco de Dados:** PostgreSQL hospedado via Neon (Serverless)
- **ORM:** Drizzle ORM
- **Validação de Dados:** Zod
- **Gerenciamento de Formulários:** React Hook Form

## Separação entre Admin, Seller e Mini App
O repositório é um monorepo baseado no App Router do Next.js onde as interfaces são divididas através de Route Groups:

- **(admin):** Interface exclusiva para a equipe do WebGran gerenciar as lojas, planos, clientes, etc. Possui um layout e permissões independentes.
- **(seller):** Painel do lojista (o tenant). É aqui que o vendedor cadastrará seus produtos, acompanhará pedidos, configurações da loja.
- **miniapp:** A interface servida dentro do Telegram. Possui um layout mobile-first focado na experiência de compra do cliente final. Toda a interação visual via Telegram ocorre nesta rota.
- **api:** Endpoints de uso interno, integrações externas, webhooks e bots.

## Estratégia Multi-Tenant
A plataforma suporta múltiplos lojistas na mesma base de dados. Cada tabela referente aos dados da loja (como produtos, categorias e pedidos) terá uma chave estrangeira de identificação (`storeId` ou `tenantId`). As requisições (especialmente do Mini App) identificarão a loja com base na URL ou cabeçalhos enviados pelo Telegram Web App.

## Estratégia Futura de Temas
O design do Mini App é totalmente separado do design dos painéis (Admin/Seller). O Mini App contará com uma **Theme Engine**. 
- O vendedor não escolherá o design livremente.
- Cada loja receberá inicialmente um tema padrão predefinido ("studio").
- Apenas a equipe técnica/administradores do WebGran poderão adicionar e disponibilizar novos temas no futuro.
Uma camada de abstração (ThemeProvider/ThemeConfig) já foi implementada no miniapp para viabilizar esse escalonamento visual sem ferir a lógica do app.

## Integração Futura com Telegram
- O sistema precisará expor webhooks na pasta `api/` para receber atualizações do Bot API (mensagens, interações, etc).
- O envio de dados do carrinho e checkout acontecerão utilizando o Telegram Web App SDK.
- Será utilizada uma autenticação baseada em dados validados via Hash HMAC utilizando o Token do bot para confirmar a autenticidade dos usuários abrindo o Mini App.

## Decisões Arquiteturais
- **Drizzle + Neon:** Otimizados para ambientes Serverless com tempo de inicialização rápido e baixo consumo de recursos, além da tipagem forte do Drizzle.
- **shadcn/ui no painel:** Garante painéis administrativos e de lojistas rápidos, padronizados, com modo escuro por padrão, reduzindo o tempo de criação de UI.
- **Isolamento de Layouts:** Utilizar Route Groups (`(admin)` e `(seller)`) e pastas separadas permite aplicar provedores e layouts distintos (ex: sem Theme Provider do Mini App vazando para o painel).
