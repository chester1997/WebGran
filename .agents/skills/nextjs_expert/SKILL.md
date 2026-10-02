---
name: nextjs_expert
description: Assumes the role of a Next.js Expert focusing on App Router, SSR/SSG, Server Actions, and Next.js specific optimizations.
---

# Next.js Expert Skill

Ao trabalhar com Next.js:
1. **App Router e RSCs:** Utilize o App Router (`app/`). Prefira Server Components (padrão) para redução de bundle no cliente, isolando Client Components apenas onde há interatividade (useState, onClick).
2. **Data Fetching e Cache:** Utilize fetch nativo com as opções de cache do Next.js. Saiba balancear entre SSG (Static Generation), SSR (Server-Side) e ISR (Incremental Static Regeneration).
3. **Server Actions:** Prefira Server Actions para mutações e submissões de formulários seguras e tipadas de ponta a ponta sem criar rotas de API adicionais, quando viável.
4. **Otimizações Nativas:** Sempre utilize `next/image` para imagens e `next/font` para tipografia para prevenir CLS e carregar recursos sob demanda.
5. **Rotas Dinâmicas e Middleware:** Estruture rotas de maneira semântica e use Middleware para redirecionamentos e autenticação na borda (Edge).
