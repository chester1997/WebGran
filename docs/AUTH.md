# WebGran - Autenticação e Controle de Acesso

Este documento detalha o funcionamento da autenticação e a estratégia de controle de acessos (Role-Based Access Control - RBAC) da plataforma WebGran, utilizando NextAuth.js com Credentials e validação do lado do servidor via Middleware e Server Actions/Components.

## Tipos de Usuários e Permissões

Existem dois perfis primários mapeados na tabela `users`: `admin` e `seller`.

### Administrador (`role: 'admin'`)
- **Regras:**
  - Possui controle irrestrito sobre a plataforma globalmente.
  - Pode visualizar todas as lojas, lojistas, bots e usuários do sistema.
  - É a única entidade capaz de gerenciar e criar novos Temas na `Theme Engine`.
  - Configurações globais e integrações com o Neon e logs.

### Vendedor / Lojista (`role: 'seller'`)
- **Regras:**
  - Acesso estritamente confinado ao escopo de sua própria loja (`getCurrentStore()`).
  - Pode gerenciar seus produtos, categorias e visualizar os pedidos dos seus clientes.
  - Não pode alterar o layout bruto via painel, recebendo e utilizando o tema pré-atribuído por um `admin`.
  - As queries de banco executadas no contexto do vendedor sempre obrigam o uso de `where(eq(table.storeId, currentStore.id))`.

## Arquitetura de Proteção de Rota

A proteção nunca confia exclusivamente no front-end. 

### 1. Middleware Global (`src/middleware.ts`)
Interpreta o Token JWT de sessão validando previamente a role do usuário.
- Requisições para `/admin/*` exigem que `role === 'admin'`. Redireciona vendedores para `/seller`.
- Requisições para `/seller/*` exigem que `role === 'seller'` (admins também possuem fallback liberado se desejado, mas o ideal é o isolamento). O redirecionamento de acessos negados vai para a página inicial (que por sua vez força login/redirect).

### 2. Helpers (Server-Side Validation)
Na pasta `src/lib/auth.ts`, criamos helpers que operam como Gatekeepers:

- `getCurrentUser()`: Retorna os dados da sessão do servidor.
- `requireAdmin()`: Garante que o usuário possua permissões plenas e rejeita (Throw Error) caso o role seja diferente, protegendo assim Server Actions ou Layouts restritos.
- `requireSeller()`: Semelhante ao admin, porém focado no vendedor.
- `getCurrentStore()`: Inspeciona a loja atrelada à conta logada (importante para injeção de foreign keys em inserts/updates de produtos/categorias).

## API de Sessão
Foi configurado o NextAuth App Router endpoint (`app/api/auth/[...nextauth]/route.ts`) validando senhas através da biblioteca `bcryptjs`. Todo o fluxo é state-less baseado no payload JWT mantendo as IDs e Roles, para não saturar o banco de dados e garantir escalabilidade.
