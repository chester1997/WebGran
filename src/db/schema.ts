import { 
  pgTable, 
  text, 
  timestamp, 
  uuid, 
  boolean, 
  integer, 
  jsonb, 
  unique, 
  decimal 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum-like options or just text for simplicity (using text to avoid custom ENUM types complexity across environments if not strictly needed)

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull().default(''),
  role: text('role').notNull().default('seller'), // 'admin' | 'seller'
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const themes = pgTable('themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  previewImageUrl: text('preview_image_url'),
  config: jsonb('config').notNull().default({}),
  isActive: boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  description: text('description'),
  status: text('status').notNull().default('active'), // 'active' | 'inactive' | 'suspended'
  themeId: uuid('theme_id').references(() => themes.id, { onDelete: 'set null' }),
  welcomeMessage: text('welcome_message'),
  welcomeBanners: jsonb('welcome_banners').default([]),
  bannerInterval: integer('banner_interval').default(5).notNull(),
  categoryDisplayStyle: text('category_display_style').notNull().default('IMAGE'), // 'IMAGE' | 'ICON'
  supportType: text('support_type').default('telegram'),
  supportValue: text('support_value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const telegramBots = pgTable('telegram_bots', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  botId: text('bot_id').notNull().unique(), // The numeric bot ID from Telegram
  username: text('username').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'), // Bot profile photo fetched from Telegram
  tokenEncrypted: text('token_encrypted').notNull(),
  secretToken: text('secret_token'),
  buttonText: text('button_text').default('Abrir App'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  iconName: text('icon_name'),
  position: integer('position').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  storeSlugUnique: unique().on(t.storeId, t.slug)
}));

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  botId: uuid('bot_id').references(() => telegramBots.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  shortDescription: text('short_description'),
  coverUrl: text('cover_url'),
  bannerUrl: text('banner_url'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal('compare_at_price', { precision: 10, scale: 2 }),
  duration: text('duration').default('lifetime'), // 'daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'lifetime'
  badge: text('badge'), // 'novo' | 'dublado' | 'legendado' | 'em_alta' | 'lancamento' | null
  status: text('status').notNull().default('active'), // 'active' | 'draft' | 'archived'
  position: integer('position').notNull().default(0),
  deliveryType: text('delivery_type').default('telegram'), // 'telegram' | 'external'
  deliveryValue: text('delivery_value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  storeSlugUnique: unique().on(t.storeId, t.slug)
}));

export const telegramCustomers = pgTable('telegram_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  telegramUserId: text('telegram_user_id').notNull(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  photoUrl: text('photo_url'),
  languageCode: text('language_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  storeUserUnique: unique().on(t.storeId, t.telegramUserId)
}));

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => telegramCustomers.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // 'pending' | 'paid' | 'cancelled' | 'fulfilled'
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('BRL'),
  paymentId: text('payment_id'),
  preferenceId: text('preference_id'),
  paymentMethod: text('payment_method'),
  pixQrCode: text('pix_qr_code'),
  pixQrCodeBase64: text('pix_qr_code_base64'),
  pixExpiresAt: timestamp('pix_expires_at'),
  platformFee: decimal('platform_fee', { precision: 10, scale: 2 }).default('0'),
  netAmount: decimal('net_amount', { precision: 10, scale: 2 }).default('0'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
});

export const accesses = pgTable('accesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => telegramCustomers.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  deliveryType: text('delivery_type').default('telegram'), // 'telegram' | 'external'
  telegramChatId: text('telegram_chat_id'),
  inviteLink: text('invite_link'),
  inviteExpiresAt: timestamp('invite_expires_at'),
  status: text('status').notNull().default('PENDING'), // 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'FAILED'
  deliveryStatus: text('delivery_status').notNull().default('PENDING'), // 'PENDING' | 'DELIVERED' | 'FAILED' | 'EXPIRED'
  deliveryError: text('delivery_error'),
  grantedAt: timestamp('granted_at'),
  expiresAt: timestamp('expires_at'),
  expiredAt: timestamp('expired_at'),
  confirmationSentAt: timestamp('confirmation_sent_at'),
  revocationStatus: text('revocation_status'), // 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED_NOT_MEMBER'
  revocationError: text('revocation_error'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  accessOrderUnique: unique().on(t.storeId, t.customerId, t.productId, t.orderId)
}));

export const banners = pgTable('banners', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  imageUrl: text('image_url').notNull(),
  linkType: text('link_type'), // 'product' | 'category' | 'external'
  linkValue: text('link_value'),
  position: integer('position').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const productCarousels = pgTable('product_carousels', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  status: text('status').notNull().default('active'),
  isRanking: boolean('is_ranking').default(false).notNull(),
  indicatorType: text('indicator_type').notNull().default('BAR'),
  iconName: text('icon_name'),
  iconColor: text('icon_color'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const carouselProducts = pgTable('carousel_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  carouselId: uuid('carousel_id').notNull().references(() => productCarousels.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  carouselProductUnique: unique().on(t.carouselId, t.productId)
}));


// Relations
export const usersRelations = relations(users, ({ many }) => ({
  stores: many(stores),
}));

export const themesRelations = relations(themes, ({ many }) => ({
  stores: many(stores),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  owner: one(users, {
    fields: [stores.ownerId],
    references: [users.id],
  }),
  theme: one(themes, {
    fields: [stores.themeId],
    references: [themes.id],
  }),
  bots: many(telegramBots),
  categories: many(categories),
  products: many(products),
  customers: many(telegramCustomers),
  orders: many(orders),
  accesses: many(accesses),
  banners: many(banners),
}));

export const telegramBotsRelations = relations(telegramBots, ({ one }) => ({
  store: one(stores, {
    fields: [telegramBots.storeId],
    references: [stores.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, {
    fields: [categories.storeId],
    references: [stores.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
  telegramBot: one(telegramBots, {
    fields: [products.botId],
    references: [telegramBots.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
  accesses: many(accesses),
}));

export const telegramCustomersRelations = relations(telegramCustomers, ({ one, many }) => ({
  store: one(stores, {
    fields: [telegramCustomers.storeId],
    references: [stores.id],
  }),
  orders: many(orders),
  accesses: many(accesses),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, {
    fields: [orders.storeId],
    references: [stores.id],
  }),
  customer: one(telegramCustomers, {
    fields: [orders.customerId],
    references: [telegramCustomers.id],
  }),
  items: many(orderItems),
  accesses: many(accesses),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const accessesRelations = relations(accesses, ({ one }) => ({
  store: one(stores, {
    fields: [accesses.storeId],
    references: [stores.id],
  }),
  customer: one(telegramCustomers, {
    fields: [accesses.customerId],
    references: [telegramCustomers.id],
  }),
  product: one(products, {
    fields: [accesses.productId],
    references: [products.id],
  }),
  order: one(orders, {
    fields: [accesses.orderId],
    references: [orders.id],
  }),
}));

export const bannersRelations = relations(banners, ({ one }) => ({
  store: one(stores, {
    fields: [banners.storeId],
    references: [stores.id],
  }),
}));

export const productCarouselsRelations = relations(productCarousels, ({ one, many }) => ({
  store: one(stores, {
    fields: [productCarousels.storeId],
    references: [stores.id],
  }),
  items: many(carouselProducts),
}));

export const carouselProductsRelations = relations(carouselProducts, ({ one }) => ({
  carousel: one(productCarousels, {
    fields: [carouselProducts.carouselId],
    references: [productCarousels.id],
  }),
  product: one(products, {
    fields: [carouselProducts.productId],
    references: [products.id],
  }),
}));


// ==========================================
// PAYMENT ARCHITECTURE
// ==========================================

export const sellerPaymentConnections = pgTable('seller_payment_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'mercado_pago'
  providerUserId: text('provider_user_id'),
  providerEmail: text('provider_email'),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  accountId: text('account_id'),
  status: text('status').notNull().default('active'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  billingInterval: text('billing_interval').notNull().default('month'), // 'month' | 'year'
  features: jsonb('features').notNull().default({}),
  maxProducts: integer('max_products'),
  maxBots: integer('max_bots'),
  maxCustomers: integer('max_customers'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => subscriptionPlans.id),
  status: text('status').notNull().default('TRIAL'), // TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED
  startedAt: timestamp('started_at').defaultNow().notNull(),
  currentPeriodStart: timestamp('current_period_start').defaultNow().notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('cora'), // 'cora'
  externalId: text('external_id'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('PENDING'), // PENDING, PAID, EXPIRED, CANCELLED, FAILED
  dueDate: timestamp('due_date').notNull(),
  paidAt: timestamp('paid_at'),
  expiresAt: timestamp('expires_at'),
  qrCode: text('qr_code'),
  qrCodeText: text('qr_code_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const platformPaymentConnections = pgTable('platform_payment_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull().default('MERCADO_PAGO'), // 'MERCADO_PAGO'
  status: text('status').notNull().default('DISCONNECTED'), // CONNECTED, DISCONNECTED, ERROR
  mpUserId: text('mp_user_id'),
  mpUserEmail: text('mp_user_email'),
  accessTokenEncrypted: text('access_token_encrypted'),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenExpiresAt: timestamp('token_expires_at'),
  connectedAt: timestamp('connected_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sellerPaymentConnectionsRelations = relations(sellerPaymentConnections, ({ one }) => ({
  seller: one(users, {
    fields: [sellerPaymentConnections.sellerId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [sellerPaymentConnections.storeId],
    references: [stores.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  seller: one(users, {
    fields: [subscriptions.sellerId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptions.planId],
    references: [subscriptionPlans.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  seller: one(users, {
    fields: [invoices.sellerId],
    references: [users.id],
  }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
}));
