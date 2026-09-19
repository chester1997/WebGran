# WEBGRAN — FASE 17.2: CORREÇÃO DO TOP 15 + RESPONSIVIDADE TELEGRAM DESKTOP & MOBILE

## 1. Causa Raiz do Bug do Número "0"
Anteriormente, no componente `TopTenCarousel.tsx`, o número da posição era formatado como:
```typescript
const positionFormatted = String(index + 1).padStart(2, "0"); // "01", "02", "03"...
```
O container do item possuía um `pl-12` (48px de padding à esquerda), e o número tinha tamanho de fonte grande `text-[92px]`.
Como o card da imagem do produto possuía plano de fundo opaco `z-10 bg-zinc-900`:
- O primeiro dígito `"0"` ficava visível dentro da área de padding (0 a 45px).
- O segundo dígito real (`"1"`, `"2"`, `"3"`, etc.) ficava exatamente posicionado após os 45px, sendo completamente **coberto pelo card opaco (`z-10 bg-zinc-900`)**.
- Como resultado visual, em todas as posições da lista apenas o `"0"` permanecia visível, fazendo parecer que a numeração estava quebrada e fixada em `0`.

---

## 2. Correção da Numeração (1 a 15)
1. **Derivação Direta por Índice (1-based)**:
   - A numeração passou a ser `displayPosition = String(index + 1)` sem zeros à esquerda para números de um dígito.
   - Posição 1 → `"1"`
   - Posição 2 → `"2"`
   - Posição 10 → `"10"`
   - Posição 15 → `"15"`
2. **Sobreposição e Camada Visual (`z-20`)**:
   - O elemento contendo o número passou para `z-20 pointer-events-none select-none`, posicionando o traçado com brilho (`WebkitTextStroke` + `drop-shadow`) sobre a borda inferior esquerda do card.
   - Todo o número é 100% visível, legível e integrado à arte do produto.
3. **Suporte a Dois Dígitos (10 a 15)**:
   - Para posições de dois dígitos (`index >= 9`), o padding à esquerda se ajusta dinamicamente (`pl-11 sm:pl-14 md:pl-16`), evitando que o número invada ou colida com o card anterior.

---

## 3. Cores Determinísticas do Top 5 vs 6–15
- **Posição 1** (`index 0`): Red Intenso `#EF4444` (Glow Red)
- **Posição 2** (`index 1`): Vermelho-Alaranjado `#F97316` (Glow Orange-Red)
- **Posição 3** (`index 2`): Laranja Quente `#FB923C` (Glow Orange)
- **Posição 4** (`index 3`): Âmbar `#FBBF24` (Glow Amber)
- **Posição 5** (`index 4`): Amarelo Dourado `#FACC15` (Glow Gold)
- **Posições 6 a 15** (`index 5..14`): Neutro Cinza `#71717A` (Sem brilho)

---

## 4. Estratégia de Responsividade (Telegram Desktop & Mobile)
O componente `TopTenCarousel` foi projetado como **um único componente universal**, sem duplicar código entre mobile e desktop. A responsividade é guiada estritamente por breakpoints CSS de viewport (`vw` / container width):

- **< 480px (Telegram Mobile & Telegram Desktop em Janela Estreita ~390px)**:
  - Largura do poster: `w-32` (~128px)
  - Proporção: `aspect-[2/3]`
  - Tamanho da fonte do número: `text-6xl`
  - Permite aproximadamente ~2 itens visíveis na viewport inicial, incentivando o swipe horizontal.
- **480px – 767px (Dispositivos Médios / Tabletes / Janelas Intermediárias)**:
  - Largura do poster: `sm:w-36` (144px)
  - Tamanho da fonte do número: `sm:text-7xl`
- **768px+ (Telegram Desktop Amplo / Navegadores Desktop)**:
  - Largura do poster: `md:w-40` (160px)
  - Tamanho da fonte do número: `md:text-8xl`

---

## 5. Validação de Build e Deployment
- **Compilação Local**: `npm run build` executado com **0 erros TypeScript**.
- **Deployment**: Commit realizado e enviado para o repositório principal no GitHub (`main`), com deploy automatizado em Produção no Vercel.
