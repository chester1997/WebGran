# WEBGRAN — FASE 19: Reorganização da Sidebar (Grupo "Bot Telegram")

## 1. Visão Geral
Nesta fase, a navegação do Seller Dashboard (`/seller`) foi reorganizada para eliminar o item antigo `"Loja & Bot"` e introduzir um grupo pai expansível denominado **"Bot Telegram"**.

---

## 2. Nova Estrutura de Navegação da Sidebar

```
Dashboard                         (/seller)

🤖 Bot Telegram                   [Grupo Expansível Pai]
    ⚙️ Configuração               (/seller/store)
    ✨ Boas-vindas                (/seller/boas-vindas)
    🖼️ Banners                   (/seller/banners)
    📦 Produtos                   (/seller/products)
    🗂️ Carrosséis                 (/seller/carousels)
    🏷️ Categorias                 (/seller/categories)

🛒 Pedidos                         (/seller/orders)
💳 Recebimento                     (/seller/recebimentos)
👥 Clientes                      (/seller/customers)
⚙️ Configurações                  (/seller/settings)
```

---

## 3. Comportamento e Regras de UI

1. **Abertura Automática (Auto-Expand)**:
   - Sempre que o usuário navega para qualquer uma das rotas filhas (`/seller/store`, `/seller/boas-vindas`, `/seller/banners`, `/seller/products`, `/seller/carousels`, `/seller/categories`), o grupo **Bot Telegram** expande automaticamente.

2. **Destaque Ativo (Active State)**:
   - O destaque vermelho ativo (`bg-gradient-to-r`, `border-red-500/20`, brilho e indicador lateral) é aplicado **exclusivamente ao submenu filho selecionado** (ex: `Carrosséis`).
   - O item pai ("Bot Telegram") permanece aberto em estado neutro/sutil sem o destaque vermelho simultâneo.

3. **Hierarquia Visual & Indentação**:
   - Os submenus são recuados com indentação `pl-5` dentro do grupo (recuo de 20px).
   - Tipografia e ícones dos submenus são refinados (`text-xs font-medium`, ícones `w-3.5 h-3.5`).
   - Animação suave de expansão/recolhimento.

4. **Busca na Sidebar**:
   - A caixa de busca filtra itens raiz e submenus. Se uma busca corresponder a qualquer filho, o grupo expande automaticamente.

5. **Navegação Recolhida (Sidebar Collapsed)**:
   - Quando recolhida, a sidebar exibe todos os ícones das seções com tooltips claros ao passar o mouse.

---

## 4. Testes e Validação
- **Compilação**: Executado `npm run build` com **0 erros de TypeScript** e código de saída 0.
- **Backend & Rotas**: Nenhuma rota ou API backend foi quebrada.
