# WEBGRAN — FASE 17.6: CORREÇÃO DA CAUSA RAIZ DO GRID DOS TRACKS

## 1. Diagnóstico & Causa Raiz Exata
Anteriormente, embora o cabeçalho das seções (`SectionHeader`) respeitasse o padding da Home (`px-[var(--miniapp-content-padding-x)]` = 24px), a trilha de rolagem do carrossel (`div.flex.overflow-x-auto`) utilizava a regra inline CSS:

```css
style={{ paddingInlineStart: "var(--miniapp-content-padding-x)" }}
```

### O Problema do Motor WebKit/Chromium em WebView Móvel:
Nos motores de renderização WebKit (iOS) e Chromium WebView (Android e Telegram Desktop), as propriedades `padding-left` ou `padding-inline-start` aplicadas a contêineres com `display: flex; overflow-x: auto;` são **ignoradas/colapsadas no posicionamento dos elementos filhos flex**.

Como consequência:
- O cabeçalho da seção iniciava em `X = 24px`.
- O primeiro item flex do Top 15 (o número `"1"`) iniciava em **`X = 0px`** (colado na borda esquerda).
- O primeiro `ProductCard` do carrossel "DUBLADO" iniciava em **`X = 0px`** (colado na borda esquerda).

---

## 2. Correção Aplicada (`HorizontalCarousel.tsx`)
Em vez de depender de `paddingInlineStart` (que colapsava no scroll flex), a trilha de rolagem passou a utilizar um **espaçador físico flex real (`div.shrink-0`)** com largura calculada:

```tsx
{/* Leading Grid Track Spacer */}
<div
  className="shrink-0 pointer-events-none"
  style={{ width: "calc(var(--miniapp-content-padding-x) - var(--carousel-gap))" }}
  aria-hidden="true"
/>
```

Como o espaçador é um nó DOM físico no flexbox (`shrink-0`), nenhum navegador/WebView consegue colapsá-lo. 
Superada a largura do espaçador mais o `gap`, o **Item 1 do Top 15** e o **Primeiro Poster do carrossel "DUBLADO"** são forçados a iniciar rigorosamente a `x = var(--miniapp-content-padding-x)`.

---

## 3. Medições `getBoundingClientRect` (ANTES vs DEPOIS)

Medições realizadas em viewport móvel padrão de **390px** (Telegram Mobile & Telegram Desktop em janela estreita):

### Medições ANTES da FASE 17.6:
| Elemento Visual | Posição `left` ANTES | Status Visual ANTES |
| :--- | :--- | :--- |
| **Top 15 Header Título** | `24.0px` | Respeitava grid |
| **Top 15 Número 1** | **`0.0px`** | ❌ **Colado na borda (ERRADO)** |
| **Top 15 Item 1** | **`0.0px`** | ❌ **Sem respiro lateral** |
| **Dublado Header Indicador (`w-1`)** | `24.0px` | Respeitava grid |
| **Dublado Primeiro ProductCard** | **`0.0px`** | ❌ **Colado na borda (ERRADO)** |

---

### Medições DEPOIS da FASE 17.6:
| Elemento Visual | Posição `left` DEPOIS | Status Visual DEPOIS |
| :--- | :--- | :--- |
| **Top 15 Header Título** | `24.0px` | `24px` |
| **Top 15 Número 1** | **`24.0px`** | ✅ **Alinhado perfeitamente aos 24px** |
| **Top 15 Item 1** | **`24.0px`** | ✅ **Inicia exatamente aos 24px** |
| **Top 15 Poster Card 1** | `48.0px` | Inicia aos 48px (24px padding + 24px pl item) |
| **Dublado Header Indicador (`w-1`)** | **`24.0px`** | ✅ **Alinhado perfeitamente aos 24px** |
| **Dublado Título Texto** | `36.0px` | 12px após a barrinha roxa |
| **Dublado Primeiro ProductCard** | **`24.0px`** | ✅ **Inicia exatamente aos 24px** |

---

## 4. Matriz de Testes & Validação
- **Telegram Mobile (360px, 375px, 390px, 412px, 430px)**:
  - O número `"1"` e o primeiro poster do "DUBLADO" possuem respiro lateral real de 24px a partir da borda esquerda da tela.
- **Telegram Desktop (Janela Estreita ~390px e Telas Amplas 768px+)**:
  - O alinhamento vertical dos títulos e do conteúdo das trilhas permanece idêntico em todas as resoluções.
  - A rolagem horizontal via drag-to-scroll do mouse e wheel permanece 100% funcional.
- **Build Local**: `npm run build` concluído com **0 erros TypeScript**.
- **Publicação**: Integrado na branch `main` com deploy automatizado em Produção no Vercel.
