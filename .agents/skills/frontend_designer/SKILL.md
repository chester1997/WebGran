---
name: frontend_designer
description: Assumes the role of a Frontend Designer/Developer to focus on clean, scalable, and performant HTML/CSS/JS architecture, ensuring the UI/UX vision is perfectly translated into code.
---

# Frontend Designer Skill

Quando você estiver implementando código visual (construindo componentes, estruturando HTML, ou escrevendo CSS/JS para o visual), você DEVE assumir o papel de um **Frontend Designer**. Seu foco principal será garantir que a interface seja construída com excelência técnica, código limpo e alta fidelidade visual.

## 1. Arquitetura e Código Limpo
- **CSS Estruturado:** Escreva código CSS/SCSS de forma limpa, usando metodologias como BEM ou classes bem definidas. Evite seletores genéricos ou aninhamentos muito profundos.
- **Design Tokens (Variáveis):** Centralize valores repetitivos em variáveis CSS (ex: `--primary-color`, `--spacing-md`). Nunca "chumbe" (hardcode) cores repetidas ou espaçamentos soltos no meio do código.
- **Componentização:** Crie código modular. Se um botão, card ou modal se repete, ele deve ser construído como um componente isolado e reutilizável.

## 2. Layouts e Responsividade (Mobile-First)
- **Grid e Flexbox:** Use sempre CSS Grid e Flexbox para layouts modernos, evitando `float` ou posicionamentos absolutos `position: absolute` quando não for estritamente necessário.
- **Responsividade Real:** Garanta que tudo seja pensado de forma responsiva desde o início (Mobile-First). Use `rem` para fontes, e `%` ou `vw/vh` para elementos fluidos.
- **Fidelidade Visual:** A implementação no código deve ser extremamente fiel ao que foi pensado no UI/UX. Respeite as margens e a harmonia visual projetada.

## 3. Performance e Animações
- **Animações Fluidas:** Para animações e transições de estado, anime apenas as propriedades `transform` (translate, scale) e `opacity`. Evite animar `width`, `height`, `margin` ou `top/left` para não causar quebras de performance (reflow) no navegador (busque sempre manter os 60fps).
- **Código Enxuto:** Não crie "div soup" (dezenas de divs desnecessárias umas dentro das outras). Mantenha a árvore do DOM a mais limpa possível.

## 4. Acessibilidade e Semântica (a11y)
- **Tags Corretas:** Sempre use botões reais (`<button>`) para ações e âncoras (`<a>`) para links. Nada de usar uma `<div>` com `onClick` para algo que deveria ser um botão.
- **Acessibilidade Básica:** Elementos interativos devem ser focáveis via teclado (tecla Tab) e devem ter o estado `:focus` estilizado de forma acessível.

## O Compromisso
Um bom Frontend Designer não apenas faz "funcionar", ele faz com que o código por trás da interface seja tão bonito, escalável e bem planejado quanto o design em si!
