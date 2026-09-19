# WEBGRAN — FASE 17.3: REFINAMENTO VISUAL DO TOP 15 + SCROLL INTERATIVO TELEGRAM DESKTOP

## 1. Causa do Número Pesado & Correções Visuais
No design anterior, o número da posição ocupava cerca de 70% a 80% da altura do poster devido à combinação de:
- **`font-black` (weight 900)** e fonte de exibição ultra condensada (`Impact`).
- **`WebkitTextStroke` de 2.5px** e brilho neon desfocado de **8px (`drop-shadow`)**.
- Tamanho de fonte desproporcional (`text-6xl` a `text-8xl`), fazendo o número competir diretamente com a arte da capa do produto.

### Correções Aplicadas:
1. **Redução de Proporção (Poster Dominante)**:
   - Tamanho ajustado para `text-4xl sm:text-5xl md:text-6xl`, ocupando cerca de 30% a 35% da altura visual do card.
2. **Tipografia Elegante**:
   - Alterado de `font-black` para `font-extrabold` com a fonte sans-serif padrão do sistema (`var(--font-geist-sans)`).
3. **Stroke & Glow Refinados**:
   - Espessura do contorno reduzida de `2.5px` para **`1.5px`**.
   - Brilho neon reduzido de 8px para um destaque sutil e premium de **4px (`drop-shadow`)** nos produtos do Top 5.
   - Posições de 6 a 15 mantidas em cinza neutro (`#71717A`) sem brilho.

---

## 2. Causa do Scroll Travado no Telegram Desktop & Solução Implementada
No Telegram Desktop (que opera via Chromium WebView embutido no Windows), o contêiner do carrossel possuía apenas `overflow-x: auto`. Em ambientes de Desktop sem tela sensível ao toque:
- O Scroll vertical da roda do mouse (`deltaY`) era retido pelo scroll raiz da página.
- O clique e arraste lateral com o mouse (mouse drag) não movimentava o scroll horizontal por padrão.

### Implementação Interativa no `HorizontalCarousel.tsx`:
1. **Mouse Drag-to-Scroll**:
   - Handlers de `onMouseDown`, `onMouseMove`, `onMouseUp` e `onMouseLeave` gerenciam o deslocamento suave do `scrollLeft`.
   - Cursor visual dinâmico: `cursor-grab` em estado normal e `cursor-grabbing` durante o arraste.
2. **Proteção Contra Cliques Acidentais (`onClickCapture`)**:
   - Se o movimento do ponteiro exceder 6px durante o arraste, o evento de clique é capturado e interrompido (`e.preventDefault()`).
   - Se o usuário realizar apenas um clique rápido no poster, o link do produto abre normalmente.
3. **Tradução da Roda do Mouse (`onWheel`)**:
   - Caso o usuário utilize a roda vertical do mouse sobre a área do ranking no Desktop, o movimento `e.deltaY` é convertido para deslocamento horizontal no `scrollLeft`.
4. **Preservação de Touch Nativo no Mobile**:
   - No celular (Telegram iOS e Android), o swipe touch nativo continua operando com fluidez total sem interferir no scroll vertical da página Home.

---

## 3. Breakpoints & Validação
- **Mobile & Telegram Desktop Estreito (~390px)**: `w-32` (~128px por card), ~2 capas visíveis inicialmente.
- **Tablets e Telas Médias (480px–767px)**: `sm:w-36` (144px).
- **Desktop Expandido (768px+)**: `md:w-40` (160px).
- **Compilação**: `npm run build` aprovado com **0 erros TypeScript**.
- **Deploy**: Publicado em Produção na Vercel com `commitSha` ativo.
