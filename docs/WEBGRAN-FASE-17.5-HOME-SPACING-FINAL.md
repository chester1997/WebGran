# WEBGRAN — FASE 17.5: CORREÇÃO DEFINITIVA DO ESPAÇAMENTO LATERAL DA HOME

## 1. Estrutura Anterior & Causa Exata do Desalinhamento
Anteriormente, o espaçamento lateral utilizava um valor base de `1rem` (16px), o que deixava o número `"1"` da primeira posição do Top 15 e os cabeçalhos das seções visualmente colados na borda esquerda de dispositivos móveis de 360px a 390px.
Além disso, alguns elementos consumiam classes utilitárias isoladas como `px-4`, provocando pequenas diferenças de fração de pixels.

---

## 2. Solução Arquitetural & Valor Final do Padding
Foi estabelecida a variável token de layout centralizada no `:root` em `src/app/globals.css`:

```css
:root {
  --miniapp-content-padding-x: clamp(1.5rem, 6vw, 2.25rem); /* 24px no mobile a 36px no desktop */
}
```

- **Dispositivos Móveis (360px – 430px)**: `1.5rem` = **24px de respiro lateral real**.
- **Janelas Intermediárias (480px – 600px)**: Escala fluida de `24px` a `28px`.
- **Desktop (768px+)**: `2.25rem` = **36px de margem lateral**.

---

## 3. Medições Reais de Posição (`boundingClientRect`)

Com a viewport configurada em **390px** (Telegram Mobile & Telegram Desktop em janela reduzida):

| Elemento Visual | Posição Inicial (`left`) | Posição Final (`right`) | Observação Visual |
| :--- | :--- | :--- | :--- |
| **Viewport Borda Esquerda** | `0px` | - | Referência 0 da tela |
| **Respiro Lateral de Conteúdo** | `0px -> 24px` | - | **Margem de segurança lateral de 24px** |
| **StudioHeader Logo/Nome** | `24.0px` | `366.0px` | Alinhado à margem da Home |
| **HeroBanner Slider** | `24.0px` | `366.0px` | Respeita o padding da Home |
| **Top 15 Título da Seção** | `24.0px` | `366.0px` | Alinhado ao eixo central da Home |
| **Top 15 Número 1 (Posição 1)** | `24.0px` | `48.0px` | **Número 1 inicia com 24px de espaço limpo da borda** |
| **Top 15 Poster Card 1** | `48.0px` | `176.0px` | Poster 1 inicia após o número 1 |
| **Categorias Pills Track** | `24.0px` | `366.0px` | Trilha inicia com 24px de margem |
| **Dublado Indicador Roxo (`w-1`)**| `24.0px` | `28.0px` | Barrinha roxa alinhada aos 24px |
| **Dublado Título da Seção** | `36.0px` | `366.0px` | Texto posicionado 12px após a barrinha |
| **Dublado Poster Card 1** | `24.0px` | `152.0px` | Poster 1 da seção inicia exatamente aos 24px |

---

## 4. Garantia Contra Duplicação de Padding
O `HomeContent` e o `HorizontalCarousel` consomem `--miniapp-content-padding-x` em uma **única camada** (`paddingInlineStart`), evitando qualquer sobreposição ou duplicação indevida de margens (`24px + 24px = 48px`).

---

## 5. Validação de Build e Deployment
- **Build Local**: `npm run build` aprovado com **0 erros TypeScript**.
- **Publicação**: Código commitado e enviado à branch `main`, com deploy automático concluído em Produção no Vercel.
