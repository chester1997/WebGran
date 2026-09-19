# WEBGRAN — FASE 16: SISTEMA DE BANNERS PREMIUM DO MINI APP

## 1. RESUMO DA ARQUITETURA E REGRA DE NEGÓCIO
Foi desenvolvido um sistema independente e multi-tenant de banners para o WebGran, com gerenciamento completo no painel do Seller e exibição em slider compacto premium no Mini App.

### Principais Características:
* **Independência**: O modelo de `banners` é associado diretamente à `Store` via `storeId` e não depende de produtos ou carrosséis.
* **Limite Server-Side de 5 Banners**: Cada loja pode cadastrar no máximo 5 banners. A trava é validada estritamente no servidor (Server Action).
* **Configuração de Intervalo**: A loja possui a configuração `bannerInterval` (3s, 5s, 7s, 10s — default 5s) salva na tabela `stores`.
* **Segurança Multi-Tenant**: Toda operação (criar, editar, reordenar, excluir, alternar status) exige autenticação do Seller e validação de propriedade (`banner.storeId === store.id`).

---

## 2. ESTRUTURA DO BANCO DE DADOS
* **Tabela `stores`**:
  - Adicionada a coluna `banner_interval` (`integer`, NOT NULL, default 5).
* **Tabela `banners`**:
  - `id`: `uuid` (PK)
  - `store_id`: `uuid` (FK -> `stores.id`)
  - `title`: `text`
  - `image_url`: `text`
  - `link_type`: `text` (`product` | `category` | `external`)
  - `link_value`: `text`
  - `position`: `integer`
  - `status`: `text` (`active` | `inactive`)
  - `created_at`: `timestamp`
  - `updated_at`: `timestamp`

---

## 3. PAINEL DO SELLER (`/seller/banners`)
* **Menu da Sidebar**: Adicionado o link **Banners** (`/seller/banners`) com ícone de imagem no menu lateral do Seller.
* **Header da Página**: Exibe a contagem atual (ex: `X de 5 banners`) e botão `+ Adicionar Banner`.
* **Controle de Intervalo**: Seletor de botões (3s, 5s, 7s, 10s) que atualiza o tempo do slider em tempo real no servidor.
* **Listagem e Gerenciamento**:
  - Card de preview da imagem com proporção 16:9 (`object-fit: cover`).
  - Badge de posição (`#1`, `#2`, etc.).
  - Badge de status (`Ativo` / `Inativo`).
  - Botões de ação: Reordenar (`Subir ↑` / `Descer ↓`), `Ativar / Desativar`, `Editar`, `Excluir`.

---

## 4. COMPORTAMENTO DO SLIDER NO MINI APP (`HeroBanner.tsx`)
* **Design Compacto Premium**: Substituiu o antigo hero gigante (`55vh`) por um container proporcional compacto (`aspect-[2.2/1]`, max `220px`), permitindo visualizar imediatamente as seções inferiores (Top 10, Categorias e Carrosséis).
* **0 Banners**: O componente retorna `null` e não renderiza nenhum espaço vazio na tela.
* **1 Banner**: Exibe o banner estático compactado, sem indicadores, sem autoplay e sem escutador de swipe.
* **2 a 5 Banners**:
  - **Autoplay**: Transição automática a cada N segundos conforme configurado na loja.
  - **Loop Continuo**: Transição em ciclo contínuo.
  - **Swipe Touch**: Suporte a gestos touch horizontais em dispositivos móveis e Telegram WebApp.
  - **Indicadores Discretos**: Pontos de navegação (`● ○ ○ ○`) no canto inferior com destaque na cor accent (`bg-red-500`).

---

## 5. RESULTADO DO BUILD E TESTES
* **`npm run build`**: Concluído com **0 erros TypeScript** e **0 erros de compilação Next.js**.
* **Integridade das Fases Anteriores**: Preservadas intactas (Mercado Pago, Access Lifecycle, Telegram Access, DIRECT_CHAT e Bottom Navigation da FASE 15).

---

## 6. RASTREABILIDADE
* **Commit**: `feat(fase16): implement premium store banners system with seller management, 5-banner limit, slider autoplay and swipe`
* **Branch**: `main`
* **Produção**: `https://www.webgran.online`
