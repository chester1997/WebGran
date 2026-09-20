# FASE 21 — Refinamento da Sidebar + Correção do Menu Bot Telegram + Perfil do Vendedor

## Resumo das Alterações FASE 21

### Parte 1 — Refinamento Visual da Sidebar
- **Biblioteca de Ícones Unificada**: Padronização utilizando `Lucide Icons` com `strokeWidth={1.8}` em todos os itens.
- **Mapeamento Semântico de Ícones**:
  - `Dashboard` → `LayoutDashboard` (20px)
  - `Bot Telegram` → `Bot` (20px)
  - Submenu `Configuração` → `Settings2` (17px)
  - Submenu `Boas-vindas` → `Sparkles` (17px)
  - Submenu `Banners` → `ImageIcon` (17px)
  - Submenu `Produtos` → `Package` (17px)
  - Submenu `Carrosséis` → `Layers` (17px)
  - Submenu `Categorias` → `Tags` (17px)
  - `Pedidos` → `ShoppingCart` (20px)
  - `Recebimento` → `CreditCard` (20px)
  - `Clientes` → `Users` (20px)
  - `Configurações` → `Settings` (20px)
- **Tamanhos e Espaçamento**: Ícones principais com `w-5 h-5` (20px), submenus com `w-[17px] h-[17px]` (17px), alinhamento com `gap-3` (12px).
- **Active State & Hover State**:
  - Botão ativo: fundo suave `bg-red-500/10`, borda sutil `border-red-500/20`, brilho vermelho discreto e barra de indicação lateral esquerda `w-[3.5px] h-[20px] bg-red-500 rounded-r-[3px] shadow-[0_0_10px_#ef4444]`.
  - Hover: neutro e discreto (`hover:bg-white/[0.04] hover:text-white`), reservando a cor vermelha exclusivamente para o estado selecionado (ACTIVE).
- **Linha de Hierarquia do Submenu**: Linha vertical discreta (`border-l border-white/10 ml-5 pl-3`) conectando os itens do submenu.

---

### Parte 2 — Correção do Comportamento do Menu Bot Telegram
- **Separação de Estados**:
  - `botGroupOpen`: controla a expansão/recolhimento manual do grupo.
  - `isBotChildActive`: verifica se a rota atual pertence ao grupo.
- **Desativação do Toggle Involuntário**:
  - Removido o `useEffect` agressivo que forçava a reabertura/fechamento do menu a cada mudança de rota.
  - O clique nos itens do submenu (`<Link href="...">`) realiza **exclusivamente a navegação**, sem disparar o evento de expansão/recolhimento do menu pai.
  - O botão pai ("Bot Telegram") é o único responsável pelo toggle manual do submenu.

---

### Parte 3 — Perfil do Vendedor & Avatar
- **Novo Nome e Título Visual**:
  - Título da página principal de Configurações: **"Perfil do vendedor"**.
  - Subtítulo: *"Gerencie as informações da sua conta."*
- **Estrutura de Dados e Schema**:
  - Adicionado a coluna `avatarUrl` à tabela `users` no Drizzle Schema (`src/db/schema.ts`).
- **Foto de Perfil & Upload Persistente**:
  - Componente de foto grande (`◯`) com suporte a upload de arquivos (JPG, PNG, WEBP, até 5MB).
  - Suporte a substituição e remoção da foto de perfil.
  - Em caso de remoção ou ausência de foto, exibe avatar fallback com a inicial do nome/e-mail (ex: `[ J ]`).
  - Server Action `updateSellerProfileAction` salva as informações no banco de dados e invalida o cache do Next.js.
- **Avatar na Sidebar**:
  - A barra inferior da sidebar (`SellerLayout`) realiza fetch do perfil real do vendedor via `/api/seller/profile`.
  - Exibe o avatar oficial do vendedor, seu nome e o papel *"Vendedor"*.
- **Segurança & Multi-Tenant**:
  - Resolução do usuário baseada na sessão autenticada (`requireSeller()`), sem permitir manipulação arbitrária de `userId`.

---

### Validação & Build
- `npm run build`: Compilado com sucesso e 0 erros de TypeScript.
