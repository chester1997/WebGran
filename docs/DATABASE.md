# WebGran - Database Schema

Este documento descreve a estrutura do banco de dados relacional (PostgreSQL) do projeto WebGran utilizando Drizzle ORM.
A plataforma é projetada com uma arquitetura **multi-tenant**, permitindo que vários vendedores operem lojas distintas na mesma base.

## Tabelas e Relacionamentos

### 1. Users (`users`)
Usuários gerais da plataforma (Admins e Vendedores).
- `id` (UUID, PK)
- `name` (Text)
- `email` (Text, Unique)
- `role` (Text - 'admin' | 'seller')
- `createdAt` / `updatedAt`

### 2. Themes (`themes`)
Temas globais da plataforma para as lojas do Mini App. O vendedor não gerencia a configuração diretamente.
- `id` (UUID, PK)
- `name` (Text)
- `slug` (Text, Unique)
- `description` (Text)
- `previewImageUrl` (Text)
- `config` (JSONB) - Estrutura centralizada que ditará cores, tipografia e regras de layout.
- `isActive` (Boolean)
- `createdAt` / `updatedAt`

### 3. Stores (`stores`)
Representa cada loja (tenant) cadastrada na plataforma.
- `id` (UUID, PK)
- `ownerId` (UUID, FK -> Users)
- `name` (Text)
- `slug` (Text, Unique)
- `logoUrl` (Text)
- `description` (Text)
- `status` (Text)
- `themeId` (UUID, FK -> Themes)
- `createdAt` / `updatedAt`

### 4. Telegram Bots (`telegram_bots`)
Vínculo entre a loja e o bot do Telegram que servirá o Mini App.
- `id` (UUID, PK)
- `storeId` (UUID, FK -> Stores)
- `botId` (Text, Unique)
- `username` (Text)
- `displayName` (Text)
- `tokenEncrypted` (Text) - Token salvo com segurança para as integrações Webhook.
- `status` (Text)
- `createdAt` / `updatedAt`

### 5. Categories (`categories`)
Categorias de produtos da loja.
- `id` (UUID, PK)
- `storeId` (UUID, FK -> Stores)
- `name` (Text)
- `slug` (Text)
- `description` / `imageUrl` / `position` / `status`
- `createdAt` / `updatedAt`
- *Índice Único:* `storeId` + `slug`

### 6. Products (`products`)
Produtos vendidos pelo tenant no Telegram.
- `id` (UUID, PK)
- `storeId` (UUID, FK -> Stores)
- `categoryId` (UUID, FK -> Categories, Nullable)
- `title` (Text)
- `slug` (Text)
- `description` / `shortDescription` / `coverUrl` / `bannerUrl`
- `price` / `compareAtPrice` (Decimal)
- `status` / `position`
- `createdAt` / `updatedAt`
- *Índice Único:* `storeId` + `slug`

### 7. Telegram Customers (`telegram_customers`)
Clientes (usuários do Telegram) que interagem com o Mini App de uma loja.
- `id` (UUID, PK)
- `storeId` (UUID, FK -> Stores)
- `telegramUserId` (Text)
- `username` / `firstName` / `lastName` / `photoUrl` / `languageCode`
- `createdAt` / `updatedAt`
- *Índice Único:* `storeId` + `telegramUserId`

### 8. Orders (`orders`)
Pedidos gerados pelos clientes do Telegram.
- `id` (UUID, PK)
- `storeId` (UUID, FK -> Stores)
- `customerId` (UUID, FK -> TelegramCustomers)
- `status` (Text)
- `subtotal` / `discount` / `total` (Decimal)
- `currency` (Text)
- `createdAt` / `updatedAt`

### 9. Order Items (`order_items`)
Itens dos pedidos.
- `id` (UUID, PK)
- `orderId` (UUID, FK -> Orders)
- `productId` (UUID, FK -> Products)
- `quantity` (Integer)
- `unitPrice` / `total` (Decimal)

### 10. Accesses (`accesses`)
Gestão de acesso/assinatura a produtos digitais (se houver).
- `id` (UUID, PK)
- `storeId` (UUID, FK -> Stores)
- `customerId` (UUID, FK -> TelegramCustomers)
- `productId` (UUID, FK -> Products)
- `orderId` (UUID, FK -> Orders, Nullable)
- `status` (Text)
- `grantedAt` / `expiresAt`
- `createdAt`

### 11. Banners (`banners`)
Gestão dos banners promocionais do Mini App.
- `id` (UUID, PK)
- `storeId` (UUID, FK -> Stores)
- `title` (Text)
- `imageUrl` (Text)
- `linkType` (Text) - 'product', 'category', 'external'
- `linkValue` (Text)
- `position` (Integer)
- `status` (Text)
- `createdAt` / `updatedAt`

## Multi-Tenancy Estratégia
Todas as tabelas relacionadas à operação da loja (Categorias, Produtos, Clientes, Pedidos, Banners) possuem uma foreign key `store_id` associada à tabela `stores`.
A nível de aplicação e consultas pelo Drizzle, é obrigatório passar ou filtrar pelo `storeId` para garantir isolamento total de dados entre lojistas.

## Theme Engine Design
O objeto JSONB `config` da tabela `themes` contém todas as informações flexíveis e escaláveis do visual do app. Ele foi projetado para acomodar evoluções sem alterar o schema do banco a cada nova propriedade visual.
O lojista possui apenas uma referência `themeId` em sua `Store`, impedindo que ele injete código arbitrário ou quebre o design da plataforma, mantendo o controle total do WebGran sobre a qualidade visual entregue.
