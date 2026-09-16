# Arquitetura de Temas (Theme Engine)

O WebGran utiliza uma arquitetura multi-tenant onde diferentes lojas podem usar diferentes temas, mas todas compartilham a mesma base de código do Mini App (`/miniapp/[slug]`).

Para evitar lógica condicional massiva (`if theme === 'studio' else if theme === 'netflix'`) espalhada pelos componentes, usamos o padrão **Theme Engine**.

## Componentes da Arquitetura

1. **ThemeRegistry (`src/components/themes/engine/registry.ts`)**
   Um mapa estático/dinâmico de todos os temas registrados na plataforma (ex: `Studio`, `Netflix`, `Minimal`). Cada entrada aponta para a configuração daquele tema.

2. **ThemeConfig**
   Uma interface que define quais Views/Componentes um tema deve obrigatoriamente implementar (Layout, Home, Product, Category, Cart, Accesses, etc).

3. **ThemeProvider (`src/app/miniapp/Providers.tsx`)**
   A camada que envolve a loja e, se necessário, provê o contexto global do tema para os componentes mais abaixo.

4. **ThemeRenderer (`src/components/themes/engine/index.tsx`)**
   A ponte inteligente. Quando a rota `/miniapp/[slug]/product/[productSlug]` é acessada, o arquivo `page.tsx` chama o `ThemeRenderer`. O Renderer consulta o banco de dados (ou cache), descobre qual é o `themeId` / `slug` da loja (ex: `studio`), busca o `ThemeConfig` no `ThemeRegistry` e renderiza a View correspondente (ex: `StudioProduct`).

## Regras de Negócio

1. **Vendedores não escolhem o tema.** A seleção de tema é feita em nível de plataforma (Admin).
2. O tema padrão é aplicado automaticamente quando um lojista conecta seu bot.
3. Se um tema for desativado, o sistema fará fallback imediato para o tema definido como `isDefault`.
