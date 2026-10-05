import { 
  pgTable, 
  text, 
  timestamp, 
  uuid, 
  boolean, 
  integer, 
  bigint,
  jsonb, 
  unique, 
  decimal,
  index
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
  floatingNotificationsEnabled: boolean('floating_notifications_enabled').default(true).notNull(),
  floatingNotificationsPages: jsonb('floating_notifications_pages').default(['home', 'product', 'category', 'search']),
  floatingNotificationsDisplayDuration: integer('floating_notifications_display_duration').default(5).notNull(),
  floatingNotificationsIntervalMin: integer('floating_notifications_interval_min').default(15).notNull(),
  floatingNotificationsIntervalMax: integer('floating_notifications_interval_max').default(30).notNull(),
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

export const telegramBotChats = pgTable('telegram_bot_chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  botId: uuid('bot_id').notNull().references(() => telegramBots.id, { onDelete: 'cascade' }),
  telegramChatId: text('telegram_chat_id').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(), // 'group' | 'supergroup' | 'channel'
  username: text('username'),
  photoUrl: text('photo_url'),
  botStatus: text('bot_status').notNull().default('administrator'), // 'administrator' | 'member' | 'left' | 'kicked'
  canInviteUsers: boolean('can_invite_users').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  botChatUnique: unique().on(t.botId, t.telegramChatId),
  storeBotIdx: index('telegram_bot_chats_store_bot_idx').on(t.storeId, t.botId),
  storeActiveIdx: index('telegram_bot_chats_store_active_idx').on(t.storeId, t.isActive),
}));

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
  storeSlugUnique: unique().on(t.storeId, t.slug),
  storeStatusIdx: index('categories_store_status_idx').on(t.storeId, t.status)
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
  showViews: boolean('show_views').default(false),
  viewsCount: integer('views_count').default(0),
  showFire: boolean('show_fire').default(false),
  fireCount: integer('fire_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  storeSlugUnique: unique().on(t.storeId, t.slug),
  storeStatusIdx: index('products_store_status_idx').on(t.storeId, t.status),
  storeCategoryIdx: index('products_store_category_idx').on(t.storeId, t.categoryId)
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
  storeUserUnique: unique().on(t.storeId, t.telegramUserId),
  storeIdIdx: index('telegram_customers_store_id_idx').on(t.storeId)
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
  couponCode: text('coupon_code'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  storeStatusCreatedIdx: index('orders_store_status_created_idx').on(t.storeId, t.status, t.createdAt),
  customerIdx: index('orders_customer_idx').on(t.customerId)
}));

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
  accessOrderUnique: unique().on(t.storeId, t.customerId, t.productId, t.orderId),
  storeCustomerStatusIdx: index('accesses_store_customer_status_idx').on(t.storeId, t.customerId, t.status)
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
}, (t) => ({
  storeStatusIdx: index('banners_store_status_idx').on(t.storeId, t.status)
}));

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
}, (t) => ({
  storeStatusIdx: index('product_carousels_store_status_idx').on(t.storeId, t.status)
}));

export const carouselProducts = pgTable('carousel_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  carouselId: uuid('carousel_id').notNull().references(() => productCarousels.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  carouselProductUnique: unique().on(t.carouselId, t.productId)
}));

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  discountType: text('discount_type').notNull().default('percentage'), // 'percentage' | 'fixed'
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
  minOrderValue: decimal('min_order_value', { precision: 10, scale: 2 }).default('0'),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  expiresAt: timestamp('expires_at'),
  status: text('status').notNull().default('active'), // 'active' | 'inactive'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  storeCodeUnique: unique().on(t.storeId, t.code)
}));

export const storeFloatingNotifications = pgTable('store_floating_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  text: text('text').notNull(),
  icon: text('icon').default('🔥').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  position: integer('position').default(0).notNull(),
  countMin: integer('count_min').default(5),
  countMax: integer('count_max').default(18),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  storeIdIdx: index('store_floating_notifications_store_id_idx').on(t.storeId),
  storeEnabledIdx: index('store_floating_notifications_store_enabled_idx').on(t.storeId, t.enabled),
  storeProductIdx: index('store_floating_notifications_store_product_idx').on(t.storeId, t.productId),
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
  coupons: many(coupons),
  floatingNotifications: many(storeFloatingNotifications),
  clips: many(clips),
  botChats: many(telegramBotChats),
  productVideos: many(productVideos),
  videoProgresses: many(videoProgress),
}));

export const couponsRelations = relations(coupons, ({ one }) => ({
  store: one(stores, {
    fields: [coupons.storeId],
    references: [stores.id],
  }),
}));

export const storeFloatingNotificationsRelations = relations(storeFloatingNotifications, ({ one }) => ({
  store: one(stores, {
    fields: [storeFloatingNotifications.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [storeFloatingNotifications.productId],
    references: [products.id],
  }),
}));

export const telegramBotsRelations = relations(telegramBots, ({ one, many }) => ({
  store: one(stores, {
    fields: [telegramBots.storeId],
    references: [stores.id],
  }),
  chats: many(telegramBotChats),
}));

export const telegramBotChatsRelations = relations(telegramBotChats, ({ one }) => ({
  store: one(stores, {
    fields: [telegramBotChats.storeId],
    references: [stores.id],
  }),
  bot: one(telegramBots, {
    fields: [telegramBotChats.botId],
    references: [telegramBots.id],
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
  productVideos: many(productVideos),
}));

export const telegramCustomersRelations = relations(telegramCustomers, ({ one, many }) => ({
  store: one(stores, {
    fields: [telegramCustomers.storeId],
    references: [stores.id],
  }),
  orders: many(orders),
  accesses: many(accesses),
  videoProgresses: many(videoProgress),
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
  provider: text('provider').notNull(), // 'mercado_pago' | 'pushinpay' | 'syncpay'
  providerUserId: text('provider_user_id'),
  providerEmail: text('provider_email'),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  webhookId: text('webhook_id'),
  webhookSecretEncrypted: text('webhook_secret_encrypted'),
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
  syncpayPlanToken: text('syncpay_plan_token'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => subscriptionPlans.id),
  status: text('status').notNull().default('TRIAL'), // TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED
  syncpaySubscriptionToken: text('syncpay_subscription_token'),
  syncpaySubscriberToken: text('syncpay_subscriber_token'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  currentPeriodStart: timestamp('current_period_start').defaultNow().notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const videoLibraryPlans = pgTable('video_library_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  billingInterval: text('billing_interval').notNull().default('month'), // 'month' | 'year'
  storageQuotaGb: integer('storage_quota_gb').notNull().default(20), // -1 for unlimited, or GB integer
  active: boolean('active').default(true).notNull(),
  syncpayPlanToken: text('syncpay_plan_token'),
  syncStatus: text('sync_status').notNull().default('SYNC_PENDING'), // 'SYNC_PENDING' | 'SYNCED' | 'SYNC_ERROR'
  syncError: text('sync_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const videoLibrarySubscriptions = pgTable('video_library_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => videoLibraryPlans.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('ACTIVE'), // PENDING, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED
  syncpaySubscriptionToken: text('syncpay_subscription_token'),
  syncpaySubscriberToken: text('syncpay_subscriber_token'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  currentPeriodStart: timestamp('current_period_start').defaultNow().notNull(),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  sellerIdx: index('video_library_subscriptions_seller_idx').on(t.sellerId),
  statusIdx: index('video_library_subscriptions_status_idx').on(t.status),
}));

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

export const videoLibraryPlansRelations = relations(videoLibraryPlans, ({ many }) => ({
  subscriptions: many(videoLibrarySubscriptions),
}));

export const videoLibrarySubscriptionsRelations = relations(videoLibrarySubscriptions, ({ one }) => ({
  seller: one(users, {
    fields: [videoLibrarySubscriptions.sellerId],
    references: [users.id],
  }),
  plan: one(videoLibraryPlans, {
    fields: [videoLibrarySubscriptions.planId],
    references: [videoLibraryPlans.id],
  }),
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

export const clips = pgTable('clips', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  bunnyVideoId: text('bunny_video_id').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  duration: integer('duration'),
  status: text('status').notNull().default('UPLOADING'), // 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED'
  position: integer('position').notNull().default(0),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  bunnyVideoIdIdx: index('clips_bunny_video_id_idx').on(t.bunnyVideoId),
  storeIdIdx: index('clips_store_id_idx').on(t.storeId),
  productIdIdx: index('clips_product_id_idx').on(t.productId),
  statusIdx: index('clips_status_idx').on(t.status),
  storePositionIdx: index('clips_store_position_idx').on(t.storeId, t.position),
}));

export const clipsRelations = relations(clips, ({ one }) => ({
  store: one(stores, {
    fields: [clips.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [clips.productId],
    references: [products.id],
  }),
}));

export const productVideos = pgTable('product_videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  bunnyVideoId: text('bunny_video_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  position: integer('position').notNull().default(0),
  durationSeconds: integer('duration_seconds'),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  thumbnailUrl: text('thumbnail_url'),
  status: text('status').notNull().default('UPLOADING'), // 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED'
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  bunnyVideoIdIdx: index('product_videos_bunny_video_id_idx').on(t.bunnyVideoId),
  storeIdIdx: index('product_videos_store_id_idx').on(t.storeId),
  productIdIdx: index('product_videos_product_id_idx').on(t.productId),
  storeProductIdx: index('product_videos_store_product_idx').on(t.storeId, t.productId),
  statusIdx: index('product_videos_status_idx').on(t.status),
  storeProductPositionIdx: index('product_videos_store_product_position_idx').on(t.storeId, t.productId, t.position),
}));

export const productVideoAssignments = pgTable('product_video_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  videoId: uuid('video_id').notNull().references(() => productVideos.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  productVideoUnique: unique().on(t.productId, t.videoId),
  storeIdIdx: index('product_video_assignments_store_id_idx').on(t.storeId),
  productIdIdx: index('product_video_assignments_product_id_idx').on(t.productId),
  videoIdIdx: index('product_video_assignments_video_id_idx').on(t.videoId),
  storeProductIdx: index('product_video_assignments_store_product_idx').on(t.storeId, t.productId),
  storeVideoIdx: index('product_video_assignments_store_video_idx').on(t.storeId, t.videoId),
}));

export const productVideosRelations = relations(productVideos, ({ one, many }) => ({
  store: one(stores, {
    fields: [productVideos.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [productVideos.productId],
    references: [products.id],
  }),
  assignments: many(productVideoAssignments),
  progresses: many(videoProgress),
}));

export const productVideoAssignmentsRelations = relations(productVideoAssignments, ({ one }) => ({
  store: one(stores, {
    fields: [productVideoAssignments.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [productVideoAssignments.productId],
    references: [products.id],
  }),
  video: one(productVideos, {
    fields: [productVideoAssignments.videoId],
    references: [productVideos.id],
  }),
}));

export const videoProgress = pgTable('video_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => telegramCustomers.id, { onDelete: 'cascade' }),
  productVideoId: uuid('product_video_id').notNull().references(() => productVideos.id, { onDelete: 'cascade' }),
  positionSeconds: integer('position_seconds').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  progressPercent: decimal('progress_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  completed: boolean('completed').default(false).notNull(),
  lastWatchedAt: timestamp('last_watched_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  customerVideoUnique: unique().on(t.customerId, t.productVideoId),
  customerVideoIdx: index('video_progress_customer_video_idx').on(t.customerId, t.productVideoId),
  storeIdx: index('video_progress_store_idx').on(t.storeId),
}));

export const videoProgressRelations = relations(videoProgress, ({ one }) => ({
  store: one(stores, {
    fields: [videoProgress.storeId],
    references: [stores.id],
  }),
  customer: one(telegramCustomers, {
    fields: [videoProgress.customerId],
    references: [telegramCustomers.id],
  }),
  productVideo: one(productVideos, {
    fields: [videoProgress.productVideoId],
    references: [productVideos.id],
  }),
}));

export const videoTriggers = pgTable('video_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  videoId: uuid('video_id').notNull().references(() => productVideos.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('PUBLIC'), // 'PURCHASE' | 'PUBLIC'
  accessId: uuid('access_id').references(() => accesses.id, { onDelete: 'set null' }),
  active: boolean('active').default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  clicksCount: integer('clicks_count').notNull().default(0),
  uniqueViewsCount: integer('unique_views_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  tokenIdx: index('video_triggers_token_idx').on(t.token),
  storeIdx: index('video_triggers_store_idx').on(t.storeId),
  videoIdx: index('video_triggers_video_idx').on(t.videoId),
  typeIdx: index('video_triggers_type_idx').on(t.type),
  activeIdx: index('video_triggers_active_idx').on(t.active),
}));

export const videoTriggersRelations = relations(videoTriggers, ({ one }) => ({
  store: one(stores, {
    fields: [videoTriggers.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [videoTriggers.productId],
    references: [products.id],
  }),
  video: one(productVideos, {
    fields: [videoTriggers.videoId],
    references: [productVideos.id],
  }),
  access: one(accesses, {
    fields: [videoTriggers.accessId],
    references: [accesses.id],
  }),
}));

// ============================================================================
// ENTITLEMENTS / FEATURES / PLAN LIMITS & OVERRIDES
// ============================================================================

export const features = pgTable('features', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'BOOLEAN' | 'LIMIT' | 'QUOTA'
  category: text('category').notNull().default('general'),
  defaultValue: jsonb('default_value').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const planFeatures = pgTable('plan_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull().references(() => subscriptionPlans.id, { onDelete: 'cascade' }),
  featureId: uuid('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  planFeatureUnique: unique().on(t.planId, t.featureId),
  planIdx: index('plan_features_plan_idx').on(t.planId),
  featureIdx: index('plan_features_feature_idx').on(t.featureId),
}));

export const sellerFeatureOverrides = pgTable('seller_feature_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  featureId: uuid('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
  overrideValue: jsonb('override_value').notNull(),
  reason: text('reason'),
  expiresAt: timestamp('expires_at'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  sellerFeatureUnique: unique().on(t.sellerId, t.featureId),
  sellerIdx: index('seller_feature_overrides_seller_idx').on(t.sellerId),
  featureIdx: index('seller_feature_overrides_feature_idx').on(t.featureId),
}));

export const featuresRelations = relations(features, ({ many }) => ({
  planFeatures: many(planFeatures),
  overrides: many(sellerFeatureOverrides),
}));

export const planFeaturesRelations = relations(planFeatures, ({ one }) => ({
  plan: one(subscriptionPlans, {
    fields: [planFeatures.planId],
    references: [subscriptionPlans.id],
  }),
  feature: one(features, {
    fields: [planFeatures.featureId],
    references: [features.id],
  }),
}));

export const sellerFeatureOverridesRelations = relations(sellerFeatureOverrides, ({ one }) => ({
  seller: one(users, {
    fields: [sellerFeatureOverrides.sellerId],
    references: [users.id],
  }),
  feature: one(features, {
    fields: [sellerFeatureOverrides.featureId],
    references: [features.id],
  }),
  creator: one(users, {
    fields: [sellerFeatureOverrides.createdBy],
    references: [users.id],
  }),
}));

export const pendingDeletions = pgTable('pending_deletions', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'bunny_storage' | 'bunny_stream'
  path: text('path').notNull(),
  resourceId: text('resource_id'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  scheduledAt: timestamp('scheduled_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  storeIdx: index('pending_deletions_store_idx').on(t.storeId),
  processedIdx: index('pending_deletions_processed_idx').on(t.processedAt),
}));

export const pendingDeletionsRelations = relations(pendingDeletions, ({ one }) => ({
  store: one(stores, {
    fields: [pendingDeletions.storeId],
    references: [stores.id],
  }),
}));

export const sellerStorageUsage = pgTable('seller_storage_usage', {
  sellerId: uuid('seller_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  usedBytes: bigint('used_bytes', { mode: 'number' }).notNull().default(0),
  reservedBytes: bigint('reserved_bytes', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const storageReservations = pgTable('storage_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }),
  referenceType: text('reference_type').notNull(), // 'clip_upload' | 'image_upload' | 'generic'
  referenceId: text('reference_id'),
  requestedBytes: bigint('requested_bytes', { mode: 'number' }).notNull(),
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED'
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  sellerIdx: index('storage_reservations_seller_idx').on(t.sellerId),
  statusIdx: index('storage_reservations_status_idx').on(t.status),
  expiresIdx: index('storage_reservations_expires_idx').on(t.expiresAt),
}));

export const sellerStorageUsageRelations = relations(sellerStorageUsage, ({ one }) => ({
  seller: one(users, {
    fields: [sellerStorageUsage.sellerId],
    references: [users.id],
  }),
}));

export const paymentWebhookEvents = pgTable('payment_webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull(), // 'syncpay' | 'pushinpay' | 'mercado_pago'
  eventId: text('event_id').notNull(),
  eventType: text('event_type'),
  connectionId: text('connection_id'),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  payload: jsonb('payload'),
}, (t) => ({
  providerEventUnique: unique().on(t.provider, t.eventId),
  providerEventIdx: index('payment_webhook_events_idx').on(t.provider, t.eventId),
}));






