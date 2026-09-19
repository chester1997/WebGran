# WEBGRAN — FASE 17.1: RELATÓRIO DO TOP 15 EDITORIAL + RANKING VISUAL DE PRODUTOS EM ALTA

## 1. RESUMO DA IMPLEMENTAÇÃO E ARQUITETURA
A seção visual existente "Top 10 Hoje" foi evoluída para um **Ranking Editorial (Top 15)** totalmente controlável pelo vendedor na aba **Configurações → Carrosséis** do painel Seller.

### Principais Características:
* **Evolução do Top Existente**: Não foi criado um sistema paralelo nem duplicada a seção. O componente de ranking existente foi atualizado para consumir a configuração da loja.
* **Seleção 100% Manual (Sem Cálculo por Vendas)**: O ranking não é calculado por algoritmo, vendas ou visualizações. O vendedor escolhe manualmente quais produtos aparecem e em qual ordem.
* **Limite Server-Side de 15 Produtos**: Validação estrita no servidor que impede a adição do 16º produto, com a mensagem: `"Esta seção permite no máximo 15 produtos."`
* **Nome Editável**: O vendedor pode personalizar o título da seção (ex: *"Top 15 Hoje"*, *"Em Alta"*, *"Em Destaque"*, *"Mais Populares"*). O nome salvo é exibido em tempo real no Mini App.
* **Ordem Manual / Reordenação**: Botões Subir (`↑`) e Descer (`↓`) no painel para alterar posições manualmente.

---

## 2. SISTEMA DE CORES DETERMINÍSTICO POR POSIÇÃO

### Regra Visual das Posições (1 a 15):
* **Somente Posições 1 a 5 (Top 5)** possuem cores quentes de alta energia:
  - **Posição 01 (`#1`)**: Vermelho Intenso (`#EF4444` stroke + glow vermelho)
  - **Posição 02 (`#2`)**: Vermelho-Alaranjado (`#F97316` stroke + glow alaranjado)
  - **Posição 03 (`#3`)**: Laranja Quente (`#FB923C` stroke + glow laranja)
  - **Posição 04 (`#4`)**: Âmbar (`#FBBF24` stroke + glow âmbar)
  - **Posição 05 (`#5`)**: Dourado / Amarelo (`#FACC15` stroke + glow dourado)
* **Posições 6 a 15 (`#06` a `#15`)**: Utilizam tratamento **neutro** (cinza `#71717A` stroke limpo, sem cores quentes).

### Determinismo Estrito:
* A cor depende estritamente da **POSIÇÃO (`index`)** e não do produto.
* Se um produto for movido da posição 1 para a posição 8, ele perde a cor quente e assume o estilo neutro da posição 8.
* **0% `Math.random()`**: Nenhuma aleatoriedade na renderização. As cores permanecem 100% estáveis.

---

## 3. COMPORTAMENTO NA HOME DO MINI APP
* **Status Ativo (`isActive = true`)**: Renderiza a seção na Home com o nome personalizado salvo no banco.
* **Status Inativo (`isActive = false`) ou 0 Produtos**: A seção inteira desaparece da Home, sem deixar títulos ou espaços vazios.
* **Produtos Inativos/Excluídos**: Produtos desativados são ocultados da exibição do ranking sem quebrar a renderização.

---

## 4. ESTRUTURA DO BANCO DE DADOS
* **Tabela `product_carousels`**: Adicionada a coluna `is_ranking` (`boolean`, default `false`).
* **Migration**: Script [`add-ranking-col.ts`](file:///d:/TELEGRAM/WebGran/src/db/add-ranking-col.ts) executado com sucesso no banco Neon.

---

## 5. RESULTADO DO BUILD E TESTES
* **`npm run build`**: 0 erros TypeScript / 0 erros Next.js.
* **Preservação de Fases Anteriores**: Banners da FASE 16, Bottom Navigation da FASE 15 (`Início | Buscar | Carrinho | Acessos`) e sistemas de checkout/pagamento mantidos 100% intactos.

---

## 6. RASTREABILIDADE
* **Commit**: `feat(fase17.1): convert top 10 to top 15 editorial ranking with manual product selection and position-based top 5 warm colors`
* **Branch**: `main`
* **Produção Vercel**: `https://www.webgran.online`
