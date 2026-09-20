# WEBGRAN — FASE 17.4: GRID E ALINHAMENTO HORIZONTAL DA HOME

## 1. Fonte Única da Margem da Home (`--miniapp-content-padding-x`)
Para garantir um alinhamento visual perfeito e fluido entre todas as seções da Home (Top 15, Carrosséis padrão, Banners e Cabeçalho), o espaçamento lateral foi consolidado em uma **única variável token de CSS**:

```css
:root {
  --miniapp-content-padding-x: clamp(1rem, 4vw, 1.5rem);
}
```
- **Dispositivos Móveis (360px – 430px)**: `1rem` (16px de margem lateral).
- **Tablets e Janelas Estreitas (480px – 600px)**: Escala fluida de `16px` a `20px`.
- **Desktop e Viewports Amplas (768px+)**: `1.5rem` (24px de margem lateral).

Nenhum componente da Home utiliza `margin-left` arbitrária ou hardcoded. Todos partem estritamente desta mesma referência.

---

## 2. Alinhamento Unificado das Seções da Home

### A. Cabeçalho das Seções e Indicador Visual (Barrinha Roxa)
- Todos os títulos de seções (Top 15, "DUBLADO", "LANÇAMENTOS", etc.) utilizam o componente `HorizontalCarousel`, aplicando `px-[var(--miniapp-content-padding-x)]`.
- O indicador visual (`w-1 h-4 bg-violet-600 rounded-full shrink-0`) inicia exatamente no ponto X de margem da Home (`var(--miniapp-content-padding-x)`).
- O texto do título fica posicionado imediatamente após o indicador, mantendo um eixo vertical constante ao longo de toda a página.

### B. Top 15 Editorial Ranking (Respiro Lateral do Número 1)
- O contêiner de rolagem do Top 15 inicia no mesmo padding da Home (`paddingInlineStart: var(--miniapp-content-padding-x)`).
- O número da 1ª posição (`"1"`) é renderizado no ponto inicial da lista (`x = var(--miniapp-content-padding-x)`), garantindo um **respiro visual lateral perfeito** em relação à borda da tela.
- O conjunto `[Número 1 + Poster 1]` respeita integralmente a estrutura do grid.

### C. Carrosséis Padrão ("DUBLADO", "DORAMAS", etc.)
- O primeiro card dos carrosséis convencionais inicia exatamente na linha do grid (`paddingInlineStart: var(--miniapp-content-padding-x)`).
- A barrinha roxa do título e a borda inicial do primeiro produto mantêm alinhamento vertical harmônico.

---

## 3. Matriz de Testes de Viewport
- **360px (Móveis Pequenos)**: 16px de respiro lateral, Top 15 alinhado aos carrosséis.
- **390px – 430px (Telegram Mobile & Telegram Desktop em Janela Estreita)**: Alinhamento perfeito entre a barrinha roxa e a lista de produtos.
- **768px (Desktop)**: Expansão fluida do respiro para 24px mantendo a simetria de todas as seções.

---

## 4. Build, Commit e Deployment
- **Build Local**: `npm run build` aprovado com **0 erros TypeScript**.
- **Publicação**: Código integrado na branch `main` e publicado via deploy contínuo em Produção no Vercel.
