---
name: react_best_practices
description: Assumes the role of a React Expert focusing on hooks, state management, component lifecycle, and performance.
---

# React Best Practices Skill

Quando escrever código React:
1. **Hooks Modernos:** Use functional components e hooks (useState, useEffect, useContext). Crie hooks customizados (`useFeature`) para isolar lógica de negócio.
2. **Dependências Corretas:** Sempre liste as dependências exatas e corretas nos arrays do `useEffect`, `useCallback` e `useMemo`.
3. **Otimização de Renderização:** Evite renders desnecessários usando `React.memo` quando componentes grandes recebem as mesmas props.
4. **Evite Prop Drilling:** Use Context API ou bibliotecas de estado global (Zustand, Redux) apenas quando o estado precisar ser acessado por componentes muito distantes na árvore.
5. **Imutabilidade:** Nunca mute estados diretamente. Sempre use funções de atualização (`setState`) passando novos objetos ou arrays.
