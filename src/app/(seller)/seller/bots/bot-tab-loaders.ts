import { db } from "@/db";
import {
  products,
  categories,
  telegramBots,
  productCarousels,
  carouselProducts,
  storeFloatingNotifications,
  productBotVisibility,
} from "@/db/schema";
import { eq, desc, and, asc, inArray } from "drizzle-orm";
import { getWelcomeSettingsAction } from "../boas-vindas/actions";
import { getStoreBanners } from "../banners/actions";
import { getCombosAction, getStoreActiveProductsAction } from "../combos/actions";
import { ProductVideoService } from "@/lib/videos/product-video-service";
import { getOrCreateRankingCarouselAction } from "../carousels/actions";
import { ClipService } from "@/lib/clips/service";
import { getCouponsAction } from "../coupons/actions";

export interface BotTabData {
  welcomeSettings?: {
    welcomeMessage: string;
    welcomeBanners: string[];
    supportType: string;
    supportValue: string;
  };
  bannersData?: {
    banners: any[];
    bannerInterval: number;
    maxLimit: number;
  };
  productsData?: {
    products: any[];
    categories: any[];
    bots: any[];
    carousels: any[];
  };
  combosData?: {
    combos: any[];
    activeProducts: any[];
  };
  videosData?: {
    videos: any[];
    usage: any;
  };
  carouselsData?: {
    rankingCarousel: any;
    standardCarousels: any[];
    storeProducts: any[];
  };
  categoriesData?: {
    allCategories: any[];
    serializedProducts: any[];
    initialStyle: "IMAGE" | "ICON";
  };
  clipsData?: {
    clips: any[];
    stats: { total: number; published: number; processing: number; failed: number };
    products: any[];
  };
  notificationsData?: {
    settings: any;
    notifications: any[];
    products: any[];
  };
  couponsData?: any[];
}

export async function loadBotTabData(
  tab: string,
  store: { id: string; slug: string; name: string; categoryDisplayStyle?: string | null; floatingNotificationsEnabled?: boolean | null; floatingNotificationsPages?: any; floatingNotificationsDisplayDuration?: number | null; floatingNotificationsIntervalMin?: number | null; floatingNotificationsIntervalMax?: number | null },
  userId: string,
  currentBotId?: string
): Promise<BotTabData> {
  const result: BotTabData = {};

  try {
    switch (tab) {
      case "boas-vindas": {
        const settings = await getWelcomeSettingsAction();
        result.welcomeSettings = settings;
        break;
      }

      case "banners": {
        const { banners, bannerInterval, maxLimit } = await getStoreBanners();
        result.bannersData = {
          banners: banners.map((b) => ({
            ...b,
            createdAt: new Date(b.createdAt),
            updatedAt: new Date(b.updatedAt),
          })),
          bannerInterval,
          maxLimit,
        };
        break;
      }

      case "produtos": {
        // Se currentBotId for informado (visão dentro do bot), filtra produtos visíveis para este bot
        let visibleProductIds: string[] | null = null;
        let visibilityMap: Record<string, { isOwner: boolean; canDeliver: boolean }> = {};

        if (currentBotId) {
          const visibilities = await db.query.productBotVisibility.findMany({
            where: and(
              eq(productBotVisibility.storeId, store.id),
              eq(productBotVisibility.botId, currentBotId)
            ),
          });

          visibleProductIds = visibilities.map((v) => v.productId);
          for (const v of visibilities) {
            visibilityMap[v.productId] = { isOwner: v.isOwner, canDeliver: v.canDeliver };
          }
        }

        let allProducts: any[] = [];
        if (currentBotId) {
          if (visibleProductIds && visibleProductIds.length > 0) {
            allProducts = await db.query.products.findMany({
              where: and(eq(products.storeId, store.id), inArray(products.id, visibleProductIds)),
              orderBy: [desc(products.createdAt)],
              with: {
                category: true,
              },
            });
          }
        } else {
          allProducts = await db.query.products.findMany({
            where: eq(products.storeId, store.id),
            orderBy: [desc(products.createdAt)],
            with: {
              category: true,
            },
          });
        }

        const allCategories = await db.query.categories.findMany({
          where: eq(categories.storeId, store.id),
          columns: { id: true, name: true },
        });

        const storeBots = await db.query.telegramBots.findMany({
          where: eq(telegramBots.storeId, store.id),
          columns: { id: true, username: true, displayName: true },
        });

        const allCarousels = await db.query.productCarousels.findMany({
          where: and(
            eq(productCarousels.storeId, store.id),
            eq(productCarousels.isRanking, false)
          ),
          orderBy: [asc(productCarousels.position), desc(productCarousels.createdAt)],
          columns: {
            id: true,
            name: true,
            indicatorType: true,
            iconName: true,
            iconColor: true,
            status: true,
            position: true,
          },
        });

        const customCarouselIds = allCarousels.map((c) => c.id);
        const productCarouselMap: Record<string, string[]> = {};

        if (customCarouselIds.length > 0) {
          const associations = await db.query.carouselProducts.findMany({
            where: inArray(carouselProducts.carouselId, customCarouselIds),
            columns: {
              productId: true,
              carouselId: true,
            },
          });

          for (const assoc of associations) {
            if (!productCarouselMap[assoc.productId]) {
              productCarouselMap[assoc.productId] = [];
            }
            productCarouselMap[assoc.productId].push(assoc.carouselId);
          }
        }

        const enrichedProducts = allProducts.map((p) => ({
          ...p,
          carouselIds: productCarouselMap[p.id] || [],
          isOwnerOfCurrentBot: visibilityMap[p.id]?.isOwner ?? (p.botId === currentBotId),
          canDeliverInCurrentBot: visibilityMap[p.id]?.canDeliver ?? true,
        }));

        result.productsData = {
          products: enrichedProducts,
          categories: allCategories,
          bots: storeBots,
          carousels: allCarousels,
        };
        break;
      }

      case "combos": {
        const [combosList, activeProducts] = await Promise.all([
          getCombosAction(),
          getStoreActiveProductsAction(),
        ]);
        result.combosData = {
          combos: combosList,
          activeProducts,
        };
        break;
      }

      case "videos": {
        let videos: any[] = [];
        try {
          videos = await ProductVideoService.listSellerLibraryVideos(store.id);
        } catch (e) {
          console.error("Error loading videos in bot tab:", e);
        }

        let rawUsage: any;
        try {
          rawUsage = await ProductVideoService.getSellerVideoStorageUsage(userId, store.id);
        } catch (e) {
          rawUsage = {
            usedBytes: 0,
            quotaGb: 50,
            quotaBytes: 50 * 1024 * 1024 * 1024,
            reservedBytes: 0,
            remainingBytes: 50 * 1024 * 1024 * 1024,
            percentUsed: 0,
          };
        }

        const usedGB = rawUsage.usedBytes / (1024 * 1024 * 1024);
        const quotaGB = rawUsage.quotaGb ?? 0;
        const freeGB =
          rawUsage.remainingBytes !== null
            ? rawUsage.remainingBytes / (1024 * 1024 * 1024)
            : Math.max(0, quotaGB - usedGB);

        const usage = {
          usedBytes: rawUsage.usedBytes,
          quotaBytes: rawUsage.quotaBytes || quotaGB * 1024 * 1024 * 1024,
          reservedBytes: rawUsage.reservedBytes,
          usedGB,
          quotaGB,
          freeGB,
          percentage: rawUsage.percentUsed,
          hasVideoSubscription: Boolean(rawUsage.hasVideoSubscription),
          planName: rawUsage.planName || null,
          planPriceCents: rawUsage.planPriceCents || null,
          isUnlimited: Boolean(rawUsage.isUnlimited),
        };

        result.videosData = {
          videos: videos.map((v) => ({
            ...v,
            createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : new Date().toISOString(),
          })),
          usage,
        };
        break;
      }

      case "carrosseis": {
        const rankingCarousel = await getOrCreateRankingCarouselAction();
        const standardCarousels = await db.query.productCarousels.findMany({
          where: and(
            eq(productCarousels.storeId, store.id),
            eq(productCarousels.isRanking, false)
          ),
          orderBy: [asc(productCarousels.position), desc(productCarousels.createdAt)],
          with: {
            items: {
              orderBy: (items, { asc }) => [asc(items.position)],
              with: {
                product: true,
              },
            },
          },
        });

        const storeProducts = await db.query.products.findMany({
          where: eq(products.storeId, store.id),
          orderBy: [desc(products.createdAt)],
          columns: { id: true, title: true, price: true, badge: true },
        });

        result.carouselsData = {
          rankingCarousel,
          standardCarousels,
          storeProducts,
        };
        break;
      }

      case "categorias": {
        const allCategories = await db.query.categories.findMany({
          where: eq(categories.storeId, store.id),
          orderBy: [asc(categories.position)],
        });

        const storeProducts = await db.query.products.findMany({
          where: eq(products.storeId, store.id),
          orderBy: [asc(products.title)],
        });

        const serializedProducts = storeProducts.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          coverUrl: p.coverUrl,
          categoryId: p.categoryId,
        }));

        result.categoriesData = {
          allCategories,
          serializedProducts,
          initialStyle: (store.categoryDisplayStyle as "IMAGE" | "ICON") || "IMAGE",
        };
        break;
      }

      case "clips": {
        const clipsList = await ClipService.listStoreClips(store.id);
        const storeProducts = await db.query.products.findMany({
          where: eq(products.storeId, store.id),
          orderBy: [asc(products.title)],
        });

        const total = clipsList.length;
        let published = 0;
        let processing = 0;
        let failed = 0;

        clipsList.forEach((c) => {
          if (c.status === "READY") published++;
          else if (c.status === "FAILED") failed++;
          else processing++;
        });

        result.clipsData = {
          clips: clipsList.map((c) => ({
            ...c,
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
            product: c.product
              ? {
                  id: c.product.id,
                  title: c.product.title,
                  price: c.product.price,
                  coverUrl: c.product.coverUrl,
                  slug: c.product.slug,
                  status: c.product.status,
                }
              : null,
          })),
          stats: { total, published, processing, failed },
          products: storeProducts.map((p) => ({
            id: p.id,
            title: p.title,
            price: p.price,
            coverUrl: p.coverUrl,
            slug: p.slug,
            status: p.status,
          })),
        };
        break;
      }

      case "notificacoes": {
        const storeNotifications = await db.query.storeFloatingNotifications.findMany({
          where: eq(storeFloatingNotifications.storeId, store.id),
          orderBy: [asc(storeFloatingNotifications.position), desc(storeFloatingNotifications.createdAt)],
          with: {
            product: {
              columns: {
                id: true,
                title: true,
              },
            },
          },
        });

        const storeProducts = await db.query.products.findMany({
          where: eq(products.storeId, store.id),
          orderBy: [desc(products.createdAt)],
          columns: {
            id: true,
            title: true,
          },
        });

        result.notificationsData = {
          settings: {
            floatingNotificationsEnabled: store.floatingNotificationsEnabled ?? true,
            floatingNotificationsPages: (store.floatingNotificationsPages as string[]) || [
              "home",
              "product",
              "category",
              "search",
            ],
            floatingNotificationsDisplayDuration: store.floatingNotificationsDisplayDuration ?? 5,
            floatingNotificationsIntervalMin: store.floatingNotificationsIntervalMin ?? 15,
            floatingNotificationsIntervalMax: store.floatingNotificationsIntervalMax ?? 30,
          },
          notifications: storeNotifications,
          products: storeProducts,
        };
        break;
      }

      case "cupons": {
        const couponsList = await getCouponsAction();
        result.couponsData = couponsList;
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`[loadBotTabData] Error loading data for tab ${tab}:`, err);
  }

  return result;
}

