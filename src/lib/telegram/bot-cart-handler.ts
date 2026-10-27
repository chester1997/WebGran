import { TelegramBotService } from "./bot";
import { CartService, CartDTO } from "@/lib/cart/cart-service";
import { ComboService, ActiveComboDTO, ActiveProgressivePromotionDTO } from "@/lib/combos/combo-service";
import { db } from "@/db";
import { products, telegramCustomers } from "@/db/schema";
import { and, eq, desc, asc, inArray } from "drizzle-orm";
import { isDuplicateTelegramCallback } from "./update-dedup";
import { parseSupportConfig } from "@/lib/support/support-helper";
import { AccessService } from "@/lib/orders/access-service";
import { CheckoutService } from "@/lib/orders/checkout-service";

export interface BotCartContext {
  store: {
    id: string;
    name: string;
    slug: string;
    supportType?: string | null;
    supportValue?: string | null;
  };
  botService: TelegramBotService;
  miniAppUrl: string;
}

/**
 * Formats a CartDTO into a friendly, clear Telegram Markdown message with interactive inline buttons.
 */
export function formatCartMessage(
  cart: CartDTO,
  miniAppUrl: string
): { text: string; replyMarkup: any } {
  const miniAppCartUrl = `${miniAppUrl}/cart`;

  if (!cart.items || cart.items.length === 0) {
    let emptyText =
      `🛒 *Seu Carrinho está vazio!*\n\n` +
      `Você ainda não adicionou nenhum produto ao carrinho desta loja.\n\n` +
      `Explore nosso catálogo no Mini App ou aproveite nossas ofertas com desconto progressivo!`;

    if (cart.progressivePromotion?.nextTierProgress) {
      const nextTier = cart.progressivePromotion.nextTierProgress;
      const targetPriceFormatted = `R$ ${(nextTier.targetTierPriceCents / 100).toFixed(2).replace(".", ",")}`;
      emptyText += `\n\n🔥 *Aproveite:* leve *${nextTier.targetQuantity} produtos* por apenas *${targetPriceFormatted}*!`;
    }

    const emptyKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🛍️ Ver Catálogo no Mini App",
            web_app: { url: miniAppUrl },
          },
        ],
        [
          {
            text: "🔥 Ofertas Progressivas",
            callback_data: "prog_view",
          },
          {
            text: "🎁 Ver Combos com Desconto",
            callback_data: "combo_list",
          },
        ],
        [
          {
            text: "📦 Ver Catálogo",
            callback_data: "cart_cat",
          },
        ],
        [
          {
            text: "↩️ Voltar ao Menu",
            callback_data: "start_menu",
          },
        ],
      ],
    };

    return { text: emptyText, replyMarkup: emptyKeyboard };
  }

  let text = `🛒 *Seu Carrinho de Compras*\n\n`;

  let itemNum = 1;
  for (const item of cart.items) {
    const itemPrice = Number(item.price) || 0;
    const lineTotal = itemPrice * item.quantity;
    const priceFormatted = `R$ ${itemPrice.toFixed(2).replace(".", ",")}`;
    const lineTotalFormatted = `R$ ${lineTotal.toFixed(2).replace(".", ",")}`;
    const prefix = item.isCombo ? "🎁 *[Combo]* " : "• ";

    if (item.quantity > 1) {
      text += `${prefix}*${item.quantity}x* ${item.title}\n  ↳ ${lineTotalFormatted} (${priceFormatted} un)\n`;
    } else {
      text += `${prefix}*1x* ${item.title} — ${lineTotalFormatted}\n`;
    }
    itemNum++;
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💰 *Subtotal:* R$ ${cart.subtotal.toFixed(2).replace(".", ",")}\n`;

  if (cart.progressiveDiscount && cart.progressiveDiscount > 0) {
    const discountFormatted = `R$ ${cart.progressiveDiscount.toFixed(2).replace(".", ",")}`;
    const pct = cart.progressivePromotion?.savingsPercentage || 0;
    const pctText = pct > 0 ? ` (${pct}% OFF)` : "";
    text += `🎉 *Desconto Progressivo:* -${discountFormatted}${pctText}\n`;
    text += `💵 *Total:* *R$ ${cart.total.toFixed(2).replace(".", ",")}*\n`;
    text += `✨ *Você economizou:* ${discountFormatted}!\n`;

    if (cart.progressivePromotion?.appliedTiers && cart.progressivePromotion.appliedTiers.length > 0) {
      const unlockedTiers = cart.progressivePromotion.appliedTiers
        .map((t) => `${t.count > 1 ? `${t.count}x ` : ""}${t.minQuantity} produtos por R$ ${(t.priceCents / 100).toFixed(2).replace(".", ",")}`)
        .join(", ");
      text += `🎉 *Oferta desbloqueada:* ${unlockedTiers}! Você economizou ${discountFormatted}.\n`;

      const tiersSummary = cart.progressivePromotion.appliedTiers
        .map((t) => `${t.count}x (${t.minQuantity} un por R$ ${(t.priceCents / 100).toFixed(2).replace(".", ",")})`)
        .join(", ");
      text += `🏷️ *Faixa aplicada:* ${tiersSummary}\n`;
    }
  } else {
    text += `💵 *Total:* *R$ ${cart.total.toFixed(2).replace(".", ",")}*\n`;
  }

  text += `📦 *Total de Itens:* ${cart.itemCount}\n`;

  // Display progressive offer progress or next tier progress message if available
  const nextTier = cart.progressivePromotion?.nextTierProgress;
  if (nextTier && nextTier.unitsRemaining > 0) {
    const isSingle = nextTier.unitsRemaining === 1;
    const icon = isSingle ? "🔥" : "🚀";
    const title = cart.progressiveDiscount && cart.progressiveDiscount > 0 ? "Próxima faixa:" : "Oferta progressiva:";
    const verb = isSingle ? "Falta" : "Faltam";
    const unitsWord = isSingle ? "produto" : "produtos";
    const targetPriceFormatted = `R$ ${(nextTier.targetTierPriceCents / 100).toFixed(2).replace(".", ",")}`;

    text += `\n${icon} *${title}* ${verb} *${nextTier.unitsRemaining} ${unitsWord}* para desbloquear *${nextTier.targetQuantity} por ${targetPriceFormatted}*!\n`;

    if (nextTier.projectedAdditionalSavingsCents && nextTier.projectedAdditionalSavingsCents > 0) {
      const savingsFormatted = `R$ ${(nextTier.projectedAdditionalSavingsCents / 100).toFixed(2).replace(".", ",")}`;
      const savingsLabel = cart.progressiveDiscount && cart.progressiveDiscount > 0
        ? `Economia adicional estimada de ${savingsFormatted}!`
        : `Economia estimada de ${savingsFormatted} ao completar a faixa!`;
      text += `  ↳ _${savingsLabel}_\n`;
    }
  }

  text += `\n_Toque em 💳 Finalizar compra para pagar via Pix ou abra o Mini App._`;

  const inlineKeyboardRows: any[][] = [];

  // Per-item action controls: clean 2-button row [ index. Qtd Title ] [ 🗑️ Remover ]
  let itemIndex = 1;
  for (const item of cart.items) {
    const MAX_ITEM_TITLE_LEN = 18;
    const titleSnippet =
      item.title.length > MAX_ITEM_TITLE_LEN
        ? `${item.title.slice(0, MAX_ITEM_TITLE_LEN - 3)}...`
        : item.title;
    const qtyPrefix = item.quantity > 1 ? `${item.quantity}x ` : "";
    const label = `${itemIndex}. ${qtyPrefix}${titleSnippet}`;

    inlineKeyboardRows.push([
      {
        text: label,
        callback_data: `cart_noop`,
      },
      {
        text: `🗑️ Remover`,
        callback_data: `cart_rem:${item.id}`,
      },
    ]);
    itemIndex++;
  }

  // Action buttons
  if (cart.items.length > 0) {
    inlineKeyboardRows.push([
      {
        text: "💳 Finalizar compra",
        callback_data: "cart_checkout",
      },
    ]);
  }

  inlineKeyboardRows.push([
    {
      text: "🛍️ Abrir Carrinho no Mini App",
      web_app: { url: miniAppCartUrl },
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "🔥 Ver Ofertas",
      callback_data: "prog_view",
    },
    {
      text: "🎁 Ver Combos",
      callback_data: "combo_list",
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "📦 Mais Produtos",
      callback_data: "cart_cat",
    },
    {
      text: "🗑️ Esvaziar",
      callback_data: "cart_clr",
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "↩️ Voltar ao Menu",
      callback_data: "start_menu",
    },
  ]);

  return {
    text,
    replyMarkup: { inline_keyboard: inlineKeyboardRows },
  };
}

/**
 * Formats a paginated catalog list (10 products per page) for quick item addition via Telegram chat.
 * Each product has a compact title button and a direct '🛒' add button side-by-side.
 */
export async function formatCatalogMessage(
  storeId: string,
  miniAppUrl: string,
  page: number = 1,
  telegramUserId?: number | string
): Promise<{ text: string; replyMarkup: any; linkPreviewOptions?: any }> {
  const allActiveProducts = await db.query.products.findMany({
    where: and(eq(products.storeId, storeId), eq(products.status, "active")),
    orderBy: [desc(products.createdAt)],
  });

  const totalProducts = allActiveProducts ? allActiveProducts.length : 0;

  if (totalProducts === 0) {
    return {
      text: `📦 *Nenhum produto disponível no momento.*\n\nFique de olho em nossas novidades!`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "🛍️ ABRIR LOJA",
              web_app: { url: miniAppUrl },
            },
          ],
          [
            {
              text: "↩️ Voltar ao Menu",
              callback_data: "start_menu",
            },
          ],
        ],
      },
    };
  }

  // Load user's persisted cart to show real selection state
  const cartItemProductIds = new Set<string>();
  if (telegramUserId) {
    try {
      const cart = await CartService.getCartByTelegramUser(storeId, telegramUserId);
      if (cart?.items) {
        for (const item of cart.items) {
          if (item.productId) cartItemProductIds.add(item.productId);
          if (item.id) cartItemProductIds.add(item.id);
        }
      }
    } catch (err) {
      console.warn("[BOT CATALOG] Error loading user cart for selection indicators:", err);
    }
  }

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageProducts = allActiveProducts.slice(startIndex, startIndex + PAGE_SIZE);

  let text = `📦 *Catálogo de Produtos*\n`;
  text += `Página ${safePage} de ${totalPages} · ${totalProducts} ${totalProducts === 1 ? "produto" : "produtos"}\n\n`;

  let itemNum = startIndex + 1;
  for (const prod of pageProducts) {
    const priceVal = Number(prod.price) || 0;
    const priceFormatted = `R$ ${priceVal.toFixed(2).replace(".", ",")}`;
    text += `*${itemNum}.* ${prod.title} — *${priceFormatted}*\n`;
    itemNum++;
  }

  text += `\n_Toque no produto para ver detalhes ou no botão à direita para selecionar no carrinho._`;

  const inlineKeyboardRows: any[][] = [];

  let btnNum = startIndex + 1;
  for (const prod of pageProducts) {
    const isSelected = cartItemProductIds.has(prod.id);
    const cartBtnText = isSelected ? "✅ Adicionado" : "🛒";
    const MAX_TITLE_LEN = 18;
    const shortTitle = prod.title.length > MAX_TITLE_LEN
      ? `${prod.title.slice(0, MAX_TITLE_LEN - 3).trim()}...`
      : prod.title;

    inlineKeyboardRows.push([
      {
        text: `${btnNum}. ${shortTitle}`,
        callback_data: `prod_view:${prod.id}:${safePage}`,
      },
      {
        text: cartBtnText,
        callback_data: `cart_add:${prod.id}:${safePage}`,
      },
    ]);
    btnNum++;
  }

  // Controles de paginação se houver mais de uma página
  if (totalPages > 1) {
    const navRow: any[] = [];
    if (safePage > 1) {
      navRow.push({
        text: "◀️ Anterior",
        callback_data: `cat_p:${safePage - 1}`,
      });
    }
    navRow.push({
      text: `${safePage}/${totalPages}`,
      callback_data: "cat_noop",
    });
    if (safePage < totalPages) {
      navRow.push({
        text: "Próxima ▶️",
        callback_data: `cat_p:${safePage + 1}`,
      });
    }
    inlineKeyboardRows.push(navRow);
  }

  inlineKeyboardRows.push([
    {
      text: "🛒 Ver Carrinho",
      callback_data: "cart_view",
    },
    {
      text: "🛍️ Abrir no Mini App",
      web_app: { url: miniAppUrl },
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "↩️ Voltar ao Menu",
      callback_data: "start_menu",
    },
  ]);

  return {
    text,
    replyMarkup: { inline_keyboard: inlineKeyboardRows },
    linkPreviewOptions: { is_disabled: true },
  };
}

/**
 * Resolves an active trailer URL for a given product if available.
 * Checks assigned product videos (Bunny player in Mini App), Clips, or explicit trailer URL in description.
 */
export async function resolveProductTrailerUrl(
  storeId: string,
  product: { id: string; description?: string | null },
  miniAppUrl: string
): Promise<{ url: string; isWebApp: boolean } | null> {
  // 1. Check ProductVideoService for assigned ready videos
  try {
    const { ProductVideoService } = await import("@/lib/videos/product-video-service");
    const videos = await ProductVideoService.listProductVideos(storeId, product.id, true);
    const readyVideo = videos.find((v: any) => v.status === "READY" && v.active);
    if (readyVideo) {
      return {
        url: `${miniAppUrl}/video/${readyVideo.id}`,
        isWebApp: true,
      };
    }
  } catch (err) {
    console.warn("[BOT CART] Error checking product videos for trailer:", err);
  }

  // 2. Check clips associated with this product
  try {
    const { clips } = await import("@/db/schema");
    const clip = await db.query.clips.findFirst({
      where: and(
        eq(clips.storeId, storeId),
        eq(clips.productId, product.id),
        eq(clips.status, "READY"),
        eq(clips.isActive, true)
      ),
      orderBy: [asc(clips.position)],
    });
    if (clip) {
      return {
        url: `${miniAppUrl}/clips?productId=${product.id}`,
        isWebApp: true,
      };
    }
  } catch (err) {
    console.warn("[BOT CART] Error checking clips for trailer:", err);
  }

  // 3. Check for validated YouTube / Vimeo / direct video trailer link in description
  if (product.description) {
    const trailerMatch =
      product.description.match(/(?:trailer|pr[ée]via|v[íi]deo):\s*(https?:\/\/[^\s]+)/i) ||
      product.description.match(
        /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+|vimeo\.com\/[0-9]+|[^\s]+\.(?:mp4|webm)))/i
      );

    if (trailerMatch && trailerMatch[1]) {
      const candidateUrl = trailerMatch[1].trim();
      try {
        const parsed = new URL(candidateUrl);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          return {
            url: candidateUrl,
            isWebApp: false,
          };
        }
      } catch {}
    }
  }

  return null;
}

/**
 * Formats a detailed view of a product with hero image preview, direct add-to-cart, trailer and navigation.
 */
export async function formatProductDetailMessage(
  storeId: string,
  productId: string,
  page: number,
  miniAppUrl: string,
  telegramUserId?: number | string
): Promise<{ text: string; replyMarkup: any; linkPreviewOptions?: any }> {
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, productId),
      eq(products.storeId, storeId),
      eq(products.status, "active")
    ),
  });

  if (!product) {
    return {
      text: "⚠️ *Produto não encontrado ou indisponível.*",
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "◀️ Voltar ao Catálogo",
              callback_data: `cat_p:${page}`,
            },
          ],
          [
            {
              text: "↩️ Voltar ao Menu",
              callback_data: "start_menu",
            },
          ],
        ],
      },
      linkPreviewOptions: { is_disabled: true },
    };
  }

  const priceVal = Number(product.price) || 0;
  const priceFormatted = `R$ ${priceVal.toFixed(2).replace(".", ",")}`;

  // Validate image URL (coverUrl with bannerUrl fallback)
  const rawImageUrl = product.coverUrl || product.bannerUrl;
  let validImageUrl: string | null = null;
  if (rawImageUrl && typeof rawImageUrl === "string" && rawImageUrl.trim().startsWith("http")) {
    try {
      const parsed = new URL(rawImageUrl.trim());
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        validImageUrl = rawImageUrl.trim();
      }
    } catch {}
  }

  let text = "";
  if (validImageUrl) {
    // Hidden zero-width anchor to render image preview in Telegram
    text += `[\u200B](${validImageUrl})`;
  }

  text += `📦 *${product.title}*\n\n`;
  if (product.description && product.description.trim() !== "") {
    text += `${product.description.trim()}\n\n`;
  }
  text += `💰 *Preço:* ${priceFormatted}\n`;

  // Check if product is currently in customer's cart
  let isProductInCart = false;
  if (telegramUserId) {
    try {
      const cart = await CartService.getCartByTelegramUser(storeId, telegramUserId);
      if (cart?.items) {
        isProductInCart = cart.items.some(
          (item) => item.productId === productId || item.id === productId
        );
      }
    } catch (err) {
      console.warn("[BOT CART] Error checking cart in formatProductDetailMessage:", err);
    }
  }

  // Resolve trailer if available
  const trailerInfo = await resolveProductTrailerUrl(storeId, product, miniAppUrl);

  const cartBtnText = isProductInCart ? "✅ No Carrinho (Remover)" : "🛒 Adicionar ao Carrinho";

  const inlineKeyboardRows: any[][] = [
    [
      {
        text: cartBtnText,
        callback_data: `cart_add:${product.id}:${page}`,
      },
    ],
  ];

  if (trailerInfo) {
    inlineKeyboardRows.push([
      trailerInfo.isWebApp
        ? {
            text: "🎬 Ver trailer",
            web_app: { url: trailerInfo.url },
          }
        : {
            text: "🎬 Ver trailer",
            url: trailerInfo.url,
          },
    ]);
  }

  inlineKeyboardRows.push([
    {
      text: "🛍️ Ver no Mini App",
      web_app: { url: `${miniAppUrl}/product/${product.slug || product.id}` },
    },
    {
      text: "🛒 Ver Carrinho",
      callback_data: "cart_view",
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "◀️ Voltar ao Catálogo",
      callback_data: `cat_p:${page}`,
    },
    {
      text: "↩️ Voltar ao Menu",
      callback_data: "start_menu",
    },
  ]);

  const linkPreviewOptions = validImageUrl
    ? {
        url: validImageUrl,
        prefer_large_media: true,
        show_above_text: true,
      }
    : { is_disabled: true };

  return {
    text,
    replyMarkup: { inline_keyboard: inlineKeyboardRows },
    linkPreviewOptions,
  };
}

/**
 * Formats the active combos list for Telegram chat with interactive add buttons.
 */
export async function formatCombosMessage(
  storeId: string,
  miniAppUrl: string
): Promise<{ text: string; replyMarkup: any }> {
  const activeCombos = await ComboService.getActiveCombos(storeId);

  if (!activeCombos || activeCombos.length === 0) {
    return {
      text: `🎁 *Nenhum combo promocional disponível no momento.*\n\nConfira os produtos individuais no nosso catálogo!`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "📦 Ver Produtos",
              callback_data: "cart_cat",
            },
            {
              text: "🛍️ Abrir Loja",
              web_app: { url: miniAppUrl },
            },
          ],
          [
            {
              text: "🔥 Ver Ofertas Progressivas",
              callback_data: "prog_view",
            },
          ],
        ],
      },
    };
  }

  let text = `🎁 *Combos Promocionais*\n\nEconomize comprando pacotes exclusivos com descontos especiais:\n\n`;

  const inlineKeyboardRows: any[][] = [];

  for (const combo of activeCombos) {
    const normalPriceFormatted = `R$ ${combo.normalPrice.toFixed(2).replace(".", ",")}`;
    const promoPriceFormatted = `R$ ${combo.price.toFixed(2).replace(".", ",")}`;
    const savingsFormatted = `R$ ${combo.savings.toFixed(2).replace(".", ",")}`;

    const productNames = combo.products.map((p) => `  • ${p.title}`).join("\n");

    text += `*${combo.title}*\n`;
    text += `${productNames}\n`;
    text += `↳ ~${normalPriceFormatted}~ por *${promoPriceFormatted}* (Economia: ${savingsFormatted} — *${combo.savingsPercentage}% OFF*)\n\n`;

    const titleSnippet = combo.title.length > 20 ? `${combo.title.slice(0, 20)}...` : combo.title;
    inlineKeyboardRows.push([
      {
        text: `➕ Levar ${titleSnippet} (${promoPriceFormatted})`,
        callback_data: `combo_add:${combo.id}`,
      },
    ]);
  }

  inlineKeyboardRows.push([
    {
      text: "🔥 Ver Ofertas Progressivas",
      callback_data: "prog_view",
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "🛒 Ver Carrinho",
      callback_data: "cart_view",
    },
    {
      text: "📦 Produtos Avulsos",
      callback_data: "cart_cat",
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "🛍️ Abrir Loja no Mini App",
      web_app: { url: miniAppUrl },
    },
  ]);

  return {
    text,
    replyMarkup: { inline_keyboard: inlineKeyboardRows },
  };
}

/**
 * Formats the active progressive offer details and tier table for Telegram chat.
 */
export async function formatProgressiveOfferMessage(
  storeId: string,
  miniAppUrl: string
): Promise<{ text: string; replyMarkup: any }> {
  const promotion = await ComboService.getActiveProgressivePromotion(storeId);

  if (!promotion || !promotion.tiers || promotion.tiers.length === 0) {
    return {
      text: `🔥 *Ofertas Progressivas*\n\nNenhuma oferta progressiva por quantidade está ativa no momento nesta loja.\n\nConfira nosso catálogo de produtos ou combos promocionais!`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "📦 Ver Produtos",
              callback_data: "cart_cat",
            },
            {
              text: "🎁 Ver Combos",
              callback_data: "combo_list",
            },
          ],
          [
            {
              text: "🛍️ Abrir Loja no Mini App",
              web_app: { url: miniAppUrl },
            },
          ],
          [
            {
              text: "↩️ Voltar ao Menu",
              callback_data: "start_menu",
            },
          ],
        ],
      },
    };
  }

  const sortedTiers = [...promotion.tiers].sort((a, b) => a.minQuantity - b.minQuantity);

  let text = `🔥 *${promotion.title}*\n`;
  if (promotion.description) {
    text += `_${promotion.description}_\n`;
  }
  text += `\nCompre mais e pague menos! Adicione produtos elegíveis ao seu carrinho e ganhe descontos automáticos por quantidade.\n\n`;
  text += `📊 *Tabela de Faixas & Preços:*\n`;

  for (const tier of sortedTiers) {
    const totalPriceFormatted = `R$ ${(tier.priceCents / 100).toFixed(2).replace(".", ",")}`;
    const unitPriceFormatted = `R$ ${(tier.priceCents / 100 / tier.minQuantity).toFixed(2).replace(".", ",")}`;
    text += `• *${tier.minQuantity} itens* por *${totalPriceFormatted}* (${unitPriceFormatted}/un)\n`;
  }

  text += `\n🏷️ *Regra:* `;
  if (promotion.eligibilityMode === "specific_products") {
    text += `Válido para produtos selecionados da loja.\n`;
  } else {
    text += `Válido para *todos* os produtos da loja!\n`;
  }
  text += `\n_Os descontos são calculados automaticamente no carrinho e você pode misturar produtos elegíveis!_`;

  const inlineKeyboard = [
    [
      {
        text: "🛍️ Ver Produtos Elegíveis",
        callback_data: "prog_prods",
      },
    ],
    [
      {
        text: "🛒 Ver Carrinho",
        callback_data: "cart_view",
      },
      {
        text: "📦 Ver Catálogo",
        callback_data: "cart_cat",
      },
    ],
    [
      {
        text: "🛍️ Abrir Loja no Mini App",
        web_app: { url: miniAppUrl },
      },
    ],
  ];

  return {
    text,
    replyMarkup: { inline_keyboard: inlineKeyboard },
  };
}

/**
 * Formats the list of products eligible for the active progressive offer.
 */
export async function formatProgressiveProductsMessage(
  storeId: string,
  miniAppUrl: string
): Promise<{ text: string; replyMarkup: any }> {
  const promotion = await ComboService.getActiveProgressivePromotion(storeId);

  if (!promotion) {
    return formatCatalogMessage(storeId, miniAppUrl);
  }

  let eligibleProducts: any[] = [];

  if (promotion.eligibilityMode === "specific_products") {
    if (promotion.eligibleProductIds && promotion.eligibleProductIds.length > 0) {
      eligibleProducts = await db.query.products.findMany({
        where: and(
          eq(products.storeId, storeId),
          inArray(products.id, promotion.eligibleProductIds),
          eq(products.status, "active")
        ),
        limit: 10,
        orderBy: [desc(products.createdAt)],
      });
    }
  } else {
    eligibleProducts = await db.query.products.findMany({
      where: and(eq(products.storeId, storeId), eq(products.status, "active")),
      limit: 10,
      orderBy: [desc(products.createdAt)],
    });
  }

  if (!eligibleProducts || eligibleProducts.length === 0) {
    return {
      text: `🛍️ *Produtos Elegíveis*\n\nNenhum produto elegível encontrado no momento.\nExplore outros produtos no nosso catálogo!`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "📊 Ver Regras da Oferta",
              callback_data: "prog_view",
            },
            {
              text: "📦 Ver Catálogo",
              callback_data: "cart_cat",
            },
          ],
          [
            {
              text: "🛍️ Abrir Loja",
              web_app: { url: miniAppUrl },
            },
          ],
        ],
      },
    };
  }

  let text = `🛍️ *Produtos Elegíveis — ${promotion.title}*\n\n`;
  text += `Escolha os produtos abaixo para montar seu pacote com desconto progressivo:\n`;

  const inlineKeyboardRows: any[][] = [];

  for (const prod of eligibleProducts) {
    const priceVal = Number(prod.price) || 0;
    const priceFormatted = `R$ ${priceVal.toFixed(2).replace(".", ",")}`;
    inlineKeyboardRows.push([
      {
        text: `➕ ${prod.title} — ${priceFormatted}`,
        callback_data: `cart_add:${prod.id}`,
      },
    ]);
  }

  inlineKeyboardRows.push([
    {
      text: "📊 Ver Tabela de Faixas",
      callback_data: "prog_view",
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "🛒 Ver Carrinho",
      callback_data: "cart_view",
    },
    {
      text: "🛍️ Abrir Loja no Mini App",
      web_app: { url: miniAppUrl },
    },
  ]);

  return {
    text,
    replyMarkup: { inline_keyboard: inlineKeyboardRows },
  };
}

/**
 * Handles the /carrinho command.
 */
export async function handleCartCommand(
  ctx: BotCartContext,
  chatId: number | string,
  telegramUser: {
    id: number | string;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
  }
) {
  try {
    const cart = await CartService.getCartByTelegramUser(ctx.store.id, telegramUser.id);
    const { text, replyMarkup } = formatCartMessage(cart, ctx.miniAppUrl);

    await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown");
  } catch (error: any) {
    console.error("[BOT CART] Error handling /carrinho command:", error);
    await ctx.botService.sendMessage(
      chatId,
      "⚠️ Ocorreu um erro ao carregar seu carrinho. Tente novamente em instantes."
    );
  }
}

/**
 * Handles the /produtos or /catalogo command.
 */
export async function handleCatalogCommand(
  ctx: BotCartContext,
  chatId: number | string,
  telegramUser?: { id: number | string }
) {
  try {
    const { text, replyMarkup, linkPreviewOptions } = await formatCatalogMessage(
      ctx.store.id,
      ctx.miniAppUrl,
      1,
      telegramUser?.id || chatId
    );
    await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown", linkPreviewOptions);
  } catch (error: any) {
    console.error("[BOT CART] Error handling /produtos command:", error);
    await ctx.botService.sendMessage(
      chatId,
      "⚠️ Ocorreu um erro ao consultar os produtos. Tente novamente em instantes."
    );
  }
}

/**
 * Handles the /combos command.
 */
export async function handleCombosCommand(
  ctx: BotCartContext,
  chatId: number | string
) {
  try {
    const { text, replyMarkup } = await formatCombosMessage(ctx.store.id, ctx.miniAppUrl);
    await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown");
  } catch (error: any) {
    console.error("[BOT CART] Error handling /combos command:", error);
    await ctx.botService.sendMessage(
      chatId,
      "⚠️ Ocorreu um erro ao consultar os combos. Tente novamente em instantes."
    );
  }
}

/**
 * Handles the /ofertas or /promocao command.
 */
export async function handleProgressiveOffersCommand(
  ctx: BotCartContext,
  chatId: number | string
) {
  try {
    const { text, replyMarkup } = await formatProgressiveOfferMessage(ctx.store.id, ctx.miniAppUrl);
    await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown");
  } catch (error: any) {
    console.error("[BOT CART] Error handling /ofertas command:", error);
    await ctx.botService.sendMessage(
      chatId,
      "⚠️ Ocorreu um erro ao consultar as ofertas. Tente novamente em instantes."
    );
  }
}

/**
 * Generates the standardized 4-row initial inline keyboard for the bot welcome menu.
 */
export function getInitialBotKeyboard(
  store: { supportType?: string | null; supportValue?: string | null },
  miniAppUrl: string
) {
  const supportConfig = parseSupportConfig(store.supportType, store.supportValue);
  const supportButton = supportConfig.isValid && supportConfig.url
    ? { text: "💬 Suporte", url: supportConfig.url }
    : { text: "💬 Suporte", callback_data: "support_info" };

  return {
    inline_keyboard: [
      [
        {
          text: "🛍️ ABRIR LOJA",
          web_app: { url: miniAppUrl },
        },
      ],
      [
        {
          text: "🛒 Carrinho",
          callback_data: "cart_view",
        },
        {
          text: "📺 Meus Acessos",
          callback_data: "my_accesses",
        },
      ],
      [
        {
          text: "📚 Catálogo",
          callback_data: "cart_cat",
        },
      ],
      [
        supportButton,
      ],
    ],
  };
}

/**
 * Formats the customer's unlocked accesses into a friendly Telegram Markdown message.
 * Differentiates between video products (direct playback in Mini App) and channels/groups (invite link).
 */
export async function formatAccessesMessage(
  store: { id: string; name: string; slug: string },
  telegramUserId: number | string,
  miniAppUrl: string
): Promise<{ text: string; replyMarkup: any }> {
  const customer = await db.query.telegramCustomers.findFirst({
    where: and(
      eq(telegramCustomers.storeId, store.id),
      eq(telegramCustomers.telegramUserId, String(telegramUserId))
    ),
  });

  const accessesList = customer
    ? await AccessService.getCustomerAccesses(store.id, customer.id)
    : [];

  if (accessesList.length === 0) {
    const text =
      `📺 *Meus Acessos — ${store.name}*\n\n` +
      `Você ainda não possui conteúdos liberados nesta loja.\n\n` +
      `💡 *Como funciona?*\n` +
      `Assim que seu pagamento for confirmado via PIX ou cartão, seus links de acesso aos canais ou vídeos exclusivos serão liberados aqui automaticamente!`;

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "🛍️ ABRIR LOJA",
            web_app: { url: miniAppUrl },
          },
        ],
        [
          {
            text: "🛒 Carrinho",
            callback_data: "cart_view",
          },
          {
            text: "📚 Catálogo",
            callback_data: "cart_cat",
          },
        ],
        [
          {
            text: "↩️ Voltar ao Menu",
            callback_data: "start_menu",
          },
        ],
      ],
    };

    return { text, replyMarkup };
  }

  let text =
    `📺 *Meus Acessos — ${store.name}*\n\n` +
    `Você possui *${accessesList.length}* ${accessesList.length === 1 ? "produto liberado" : "produtos liberados"} nesta loja:\n\n`;

  const inlineKeyboardRows: any[][] = [];

  const { AccessLifecycleService } = await import("@/lib/orders/access-lifecycle-service");

  for (const acc of accessesList) {
    const prodTitle = acc.product?.title || "Produto";
    text += `• *${prodTitle}*\n`;
    const shortTitle = prodTitle.length > 25 ? prodTitle.slice(0, 22) + "..." : prodTitle;

    try {
      const resolution = await AccessLifecycleService.resolveAccessDestination(
        acc.id,
        store.slug,
        String(telegramUserId)
      );

      if (resolution.destinationType === "PRODUCT_VIDEO" && resolution.destinationUrl) {
        // Direct video product -> opens dedicated video player inside Telegram Mini App
        inlineKeyboardRows.push([
          {
            text: `▶️ Assistir: ${shortTitle}`,
            web_app: { url: resolution.destinationUrl },
          },
        ]);
      } else if (acc.inviteLink || resolution.destinationUrl) {
        // Channel or group product -> redirects to authorized Telegram channel/group
        inlineKeyboardRows.push([
          {
            text: `▶️ Acessar: ${shortTitle}`,
            url: acc.inviteLink || resolution.destinationUrl,
          },
        ]);
      } else {
        // Safe fallback
        inlineKeyboardRows.push([
          {
            text: `▶️ Acessar: ${shortTitle}`,
            web_app: { url: `${miniAppUrl}/accesses` },
          },
        ]);
      }
    } catch (err) {
      console.warn("[BOT CART] Error resolving access destination:", err);
      if (acc.inviteLink) {
        inlineKeyboardRows.push([
          {
            text: `▶️ Acessar: ${shortTitle}`,
            url: acc.inviteLink,
          },
        ]);
      } else {
        inlineKeyboardRows.push([
          {
            text: `▶️ Acessar: ${shortTitle}`,
            web_app: { url: `${miniAppUrl}/accesses` },
          },
        ]);
      }
    }
  }

  text += `\n_Toque no botão acima para assistir ao vídeo ou acessar seu canal VIP._`;

  inlineKeyboardRows.push([
    {
      text: "📺 Ver Meus Acessos no Mini App",
      web_app: { url: `${miniAppUrl}/accesses` },
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "🛍️ ABRIR LOJA",
      web_app: { url: miniAppUrl },
    },
    {
      text: "🛒 Carrinho",
      callback_data: "cart_view",
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "↩️ Voltar ao Menu",
      callback_data: "start_menu",
    },
  ]);

  return { text, replyMarkup: { inline_keyboard: inlineKeyboardRows } };
}

/**
 * Handles the /acessos command.
 */
export async function handleAccessesCommand(
  ctx: BotCartContext,
  chatId: number | string,
  telegramUser: { id: number | string }
) {
  try {
    const { text, replyMarkup } = await formatAccessesMessage(ctx.store, telegramUser.id, ctx.miniAppUrl);
    await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown");
  } catch (error: any) {
    console.error("[BOT CART] Error handling /acessos command:", error);
    await ctx.botService.sendMessage(
      chatId,
      "⚠️ Ocorreu um erro ao consultar seus acessos. Tente novamente em instantes."
    );
  }
}

/**
 * Handles the /suporte command.
 */
export async function handleSupportCommand(
  ctx: BotCartContext,
  chatId: number | string,
  store: { name: string; supportType?: string | null; supportValue?: string | null }
) {
  try {
    const supportConfig = parseSupportConfig(store.supportType, store.supportValue);

    if (supportConfig.isValid && supportConfig.url) {
      const text =
        `💬 *Atendimento e Suporte — ${store.name}*\n\n` +
        `Para dúvidas, suporte ou atendimento sobre suas compras, clique no botão abaixo para falar diretamente com nossa equipe:`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "💬 Falar com Suporte", url: supportConfig.url },
          ],
          [
            { text: "🛍️ ABRIR LOJA", web_app: { url: ctx.miniAppUrl } },
          ],
        ],
      };

      await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown");
    } else {
      const text =
        `💬 *Atendimento e Suporte — ${store.name}*\n\n` +
        `Nossa equipe de atendimento está à disposição através do nosso Mini App.\n\n` +
        `Clique no botão abaixo para abrir a loja e ver mais informações de contato:`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "🛍️ ABRIR LOJA", web_app: { url: ctx.miniAppUrl } },
          ],
        ],
      };

      await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown");
    }
  } catch (error: any) {
    console.error("[BOT CART] Error handling /suporte command:", error);
    await ctx.botService.sendMessage(
      chatId,
      "⚠️ Ocorreu um erro ao carregar as informações de suporte. Tente novamente em instantes."
    );
  }
}

/**
 * Handles interactive callback queries for cart, combo and progressive offer operations.
 */
export async function handleCartCallbackQuery(
  ctx: BotCartContext,
  cbId: string,
  chatId: number | string | undefined,
  messageId: number | undefined,
  cbData: string,
  telegramUser: {
    id: number | string;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
  }
) {
  if (
    !cbData.startsWith("cart_") &&
    !cbData.startsWith("combo_") &&
    !cbData.startsWith("prog_") &&
    !cbData.startsWith("cat_") &&
    !cbData.startsWith("prod_view:") &&
    !cbData.startsWith("prod_toggle:") &&
    !cbData.startsWith("trailer_play:") &&
    !cbData.startsWith("check_pay:") &&
    !cbData.startsWith("order_check:") &&
    cbData !== "my_accesses" &&
    cbData !== "support_info" &&
    cbData !== "start_menu"
  ) {
    return false;
  }

  // Deduplicate repeated callback clicks to prevent duplicate actions
  if (isDuplicateTelegramCallback(cbId)) {
    console.log(`[BOT CART] Skipping duplicate callback_query_id=${cbId}`);
    await ctx.botService.answerCallbackQuery(cbId);
    return true;
  }

  // No-op click on item label or page indicator
  if (cbData === "cart_noop" || cbData === "cat_noop") {
    await ctx.botService.answerCallbackQuery(cbId);
    return true;
  }

  try {
    // 1. Show catalog view (page 1 or requested page)
    if (cbData === "cart_cat" || cbData.startsWith("cat_p:")) {
      let page = 1;
      if (cbData.startsWith("cat_p:")) {
        const rawPage = parseInt(cbData.replace("cat_p:", ""), 10);
        if (!isNaN(rawPage) && rawPage > 0) {
          page = rawPage;
        }
      }

      const { text, replyMarkup, linkPreviewOptions } = await formatCatalogMessage(
        ctx.store.id,
        ctx.miniAppUrl,
        page,
        telegramUser.id
      );
      await ctx.botService.answerCallbackQuery(cbId);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown", linkPreviewOptions);
      } else if (chatId) {
        await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown", linkPreviewOptions);
      }
      return true;
    }

    // 1.1 Show product details view
    if (cbData.startsWith("prod_view:")) {
      const parts = cbData.split(":");
      const productId = parts[1];
      const page = parseInt(parts[2], 10) || 1;

      const { text, replyMarkup, linkPreviewOptions } = await formatProductDetailMessage(
        ctx.store.id,
        productId,
        page,
        ctx.miniAppUrl,
        telegramUser.id
      );

      await ctx.botService.answerCallbackQuery(cbId);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown", linkPreviewOptions);
      } else if (chatId) {
        await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown", linkPreviewOptions);
      }
      return true;
    }

    // 1.2 Toggle product selection in details view
    if (cbData.startsWith("prod_toggle:")) {
      const parts = cbData.split(":");
      const productId = parts[1];
      const page = parseInt(parts[2], 10) || 1;

      const currentCart = await CartService.getCartByTelegramUser(ctx.store.id, telegramUser.id);
      const existingItem = currentCart.items.find(
        (i) => i.productId === productId || i.id === productId
      );

      if (existingItem) {
        await CartService.removeItemByTelegramUser(ctx.store.id, telegramUser.id, existingItem.id);
        await ctx.botService.answerCallbackQuery(cbId, "🗑️ Produto removido do carrinho!");
      } else {
        await CartService.addItemByTelegramUser(ctx.store.id, telegramUser.id, productId, 1);
        await ctx.botService.answerCallbackQuery(cbId, "✅ Produto adicionado ao carrinho!");
      }

      const { text, replyMarkup, linkPreviewOptions } = await formatProductDetailMessage(
        ctx.store.id,
        productId,
        page,
        ctx.miniAppUrl,
        telegramUser.id
      );

      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown", linkPreviewOptions);
      }
      return true;
    }

    // 1.3 Play product trailer directly in chat
    if (cbData.startsWith("trailer_play:")) {
      const parts = cbData.split(":");
      const productId = parts[1];
      const page = parseInt(parts[2], 10) || 1;

      const product = await db.query.products.findFirst({
        where: and(
          eq(products.id, productId),
          eq(products.storeId, ctx.store.id),
          eq(products.status, "active")
        ),
      });

      if (!product) {
        await ctx.botService.answerCallbackQuery(cbId, "⚠️ Produto não encontrado.", true);
        return true;
      }

      const trailerInfo = await resolveProductTrailerUrl(ctx.store.id, product, ctx.miniAppUrl);
      if (!trailerInfo) {
        await ctx.botService.answerCallbackQuery(cbId, "⚠️ Trailer indisponível no momento.", true);
        return true;
      }

      await ctx.botService.answerCallbackQuery(cbId, "🎬 Carregando trailer...");

      const backButton = [
        [
          {
            text: "◀️ Voltar ao Produto",
            callback_data: `prod_view:${product.id}:${page}`,
          },
        ],
      ];

      const targetChatId = chatId || telegramUser.id;
      const isDirectVideo = Boolean(trailerInfo.url.match(/\.(mp4|webm)(\?.*)?$/i));

      if (isDirectVideo) {
        try {
          await ctx.botService.sendVideo(
            targetChatId,
            trailerInfo.url,
            `🎬 *Trailer:* ${product.title}`,
            { inline_keyboard: backButton },
            "Markdown"
          );
          return true;
        } catch (videoErr) {
          console.warn("[BOT CART] sendVideo failed, falling back to message with preview:", videoErr);
        }
      }

      const trailerMsgText = `🎬 *Trailer — ${product.title}*\n\n[▶️ Assistir Trailer na Conversa](${trailerInfo.url})`;
      await ctx.botService.sendMessage(
        targetChatId,
        trailerMsgText,
        { inline_keyboard: backButton },
        "Markdown",
        { url: trailerInfo.url, prefer_large_media: true }
      );
      return true;
    }

    // 2. Show combos view
    if (cbData === "combo_list") {
      const { text, replyMarkup } = await formatCombosMessage(ctx.store.id, ctx.miniAppUrl);
      await ctx.botService.answerCallbackQuery(cbId);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 2.1 Show progressive offers view
    if (cbData === "prog_view") {
      const { text, replyMarkup } = await formatProgressiveOfferMessage(ctx.store.id, ctx.miniAppUrl);
      await ctx.botService.answerCallbackQuery(cbId);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 2.2 Show progressive eligible products
    if (cbData === "prog_prods") {
      const { text, replyMarkup } = await formatProgressiveProductsMessage(ctx.store.id, ctx.miniAppUrl);
      await ctx.botService.answerCallbackQuery(cbId);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 3. View current cart
    if (cbData === "cart_view") {
      const cart = await CartService.getCartByTelegramUser(ctx.store.id, telegramUser.id);
      const { text, replyMarkup } = formatCartMessage(cart, ctx.miniAppUrl);
      await ctx.botService.answerCallbackQuery(cbId);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 3.1 View unlocked customer accesses
    if (cbData === "my_accesses") {
      const { text, replyMarkup } = await formatAccessesMessage(ctx.store, telegramUser.id, ctx.miniAppUrl);
      await ctx.botService.answerCallbackQuery(cbId);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      } else if (chatId) {
        await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 3.2 View support information
    if (cbData === "support_info") {
      await ctx.botService.answerCallbackQuery(cbId);
      await handleSupportCommand(ctx, chatId || telegramUser.id, ctx.store);
      return true;
    }

    // 3.3 Return to initial start menu
    if (cbData === "start_menu") {
      const replyMarkup = getInitialBotKeyboard(ctx.store, ctx.miniAppUrl);
      const text = `🛍️ *Menu Inicial — ${ctx.store.name}*\n\nSelecione uma opção abaixo para navegar:`;
      await ctx.botService.answerCallbackQuery(cbId);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      } else if (chatId) {
        await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 3.8 Checkout via Pix directly inside Telegram chat
    if (cbData === "cart_checkout") {
      const cart = await CartService.getCartByTelegramUser(ctx.store.id, telegramUser.id);
      if (!cart || !cart.items || cart.items.length === 0) {
        await ctx.botService.answerCallbackQuery(cbId, "⚠️ Seu carrinho está vazio.", true);
        const { text, replyMarkup } = formatCartMessage(cart, ctx.miniAppUrl);
        if (chatId && messageId) {
          await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
        }
        return true;
      }

      await ctx.botService.answerCallbackQuery(cbId, "⏳ Gerando cobrança Pix...");

      const customer = await CartService.getOrCreateCustomerForTelegramUser(ctx.store.id, telegramUser);
      const checkoutRes = await CheckoutService.createCheckout({
        storeId: ctx.store.id,
        customerId: customer.id,
        storeSlug: ctx.store.slug,
        items: cart.items.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          isCombo: i.isCombo,
          comboId: i.comboId,
        })),
      });

      if (!checkoutRes.success || !checkoutRes.orderId) {
        await ctx.botService.answerCallbackQuery(
          cbId,
          `⚠️ ${checkoutRes.error || "Não foi possível gerar a cobrança Pix no momento."}`,
          true
        );
        return true;
      }

      // Empty cart on successful checkout session creation
      await CartService.clearCartByTelegramUser(ctx.store.id, telegramUser.id);

      const orderId = checkoutRes.orderId;
      const totalFormatted = `R$ ${(checkoutRes.total ?? cart.total).toFixed(2).replace(".", ",")}`;
      const pixCode = checkoutRes.pix?.qrCode || "";
      const targetChatId = chatId || telegramUser.id;

      let pixMsg = `💳 *Pedido #${orderId.slice(0, 8)}* — *Aguardando Pagamento*\n\n`;
      pixMsg += `💵 *Total a pagar:* *${totalFormatted}*\n\n`;
      if (pixCode) {
        pixMsg += `👇 *Pix Copia e Cola* _(toque no código para copiar)_:\n\n`;
        pixMsg += `\`${pixCode}\`\n\n`;
      }
      pixMsg += `⏳ *Status:* Aguardando confirmação do banco...\n`;
      pixMsg += `_Assim que o pagamento for aprovado, seu acesso aos conteúdos será liberado automaticamente aqui na conversa!_`;

      const pixKeyboard = {
        inline_keyboard: [
          [
            {
              text: "🔄 Verificar Pagamento",
              callback_data: `check_pay:${orderId}`,
            },
          ],
          [
            {
              text: "🛍️ Explorar Catálogo",
              callback_data: "cart_cat",
            },
            {
              text: "↩️ Menu Inicial",
              callback_data: "start_menu",
            },
          ],
        ],
      };

      let sentWithPhoto = false;
      if (checkoutRes.pix?.qrCodeBase64) {
        try {
          let appBaseUrl = "https://www.webgran.online";
          try {
            appBaseUrl = new URL(ctx.miniAppUrl).origin;
          } catch {
            appBaseUrl =
              process.env.NEXT_PUBLIC_APP_URL ||
              (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.webgran.online");
          }
          const qrImageUrl = `${appBaseUrl}/api/telegram/order-qr/${orderId}`;
          await ctx.botService.sendPhoto(targetChatId, qrImageUrl, pixMsg, pixKeyboard, "Markdown");
          sentWithPhoto = true;
        } catch (photoErr) {
          console.warn("[BOT CART] sendPhoto failed for QR Code, falling back to sendMessage:", photoErr);
        }
      }

      if (!sentWithPhoto) {
        await ctx.botService.sendMessage(targetChatId, pixMsg, pixKeyboard, "Markdown");
      }

      return true;
    }

    // 3.9 Check payment status
    if (cbData.startsWith("check_pay:") || cbData.startsWith("order_check:")) {
      const orderId = cbData.replace(/^(check_pay:|order_check:)/, "").trim();
      const targetChatId = chatId || telegramUser.id;

      try {
        const { syncOrderWithMercadoPago } = await import("@/lib/payments/order-sync");
        const syncRes = await syncOrderWithMercadoPago(orderId);

        if (syncRes.status === "paid") {
          await ctx.botService.answerCallbackQuery(cbId, "🎉 Pagamento confirmado com sucesso!");

          const { AccessDeliveryService } = await import("@/lib/delivery/access-delivery-service");
          await AccessDeliveryService.processOrderDelivery(orderId);

          const paidMsg =
            `🎉 *Pagamento Confirmado!*\n\n` +
            `O pagamento do pedido *#${orderId.slice(0, 8)}* foi aprovado com sucesso e seus acessos foram liberados!\n\n` +
            `Toque no botão abaixo para acessar seus conteúdos:`;

          const paidKeyboard = {
            inline_keyboard: [
              [
                {
                  text: "🔐 Meus Acessos",
                  callback_data: "my_accesses",
                },
              ],
              [
                {
                  text: "🛍️ Explorar Catálogo",
                  callback_data: "cart_cat",
                },
                {
                  text: "↩️ Menu Inicial",
                  callback_data: "start_menu",
                },
              ],
            ],
          };

          if (chatId && messageId) {
            try {
              await ctx.botService.editMessageText(chatId, messageId, paidMsg, paidKeyboard, "Markdown");
            } catch {
              await ctx.botService.sendMessage(targetChatId, paidMsg, paidKeyboard, "Markdown");
            }
          } else {
            await ctx.botService.sendMessage(targetChatId, paidMsg, paidKeyboard, "Markdown");
          }
          return true;
        } else {
          await ctx.botService.answerCallbackQuery(
            cbId,
            "⏳ Pagamento ainda não identificado. Aguarde alguns instantes e tente novamente.",
            true
          );
          return true;
        }
      } catch (checkErr: any) {
        console.error("[BOT CART] Error checking payment:", checkErr);
        await ctx.botService.answerCallbackQuery(
          cbId,
          "⚠️ Não foi possível verificar o status agora. Tente novamente em instantes.",
          true
        );
        return true;
      }
    }

    // 4. Clear cart
    if (cbData === "cart_clr") {
      const cart = await CartService.clearCartByTelegramUser(ctx.store.id, telegramUser.id);
      const { text, replyMarkup } = formatCartMessage(cart, ctx.miniAppUrl);
      await ctx.botService.answerCallbackQuery(cbId, "🗑️ Carrinho esvaziado!");
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 5. Add/Select product (supports cart_add: and prog_add: with toggle in catalog)
    if (cbData.startsWith("cart_add:") || cbData.startsWith("prog_add:")) {
      const rawPayload = cbData.replace(/^(cart_add:|prog_add:)/, "").trim();
      const parts = rawPayload.split(":");
      const productId = parts[0];
      const pageStr = parts[1];
      const page = pageStr ? parseInt(pageStr, 10) : undefined;

      if (!productId) {
        await ctx.botService.answerCallbackQuery(cbId, "⚠️ Produto inválido.", true);
        return true;
      }

      // If called from paginated catalog or detail view (page is specified), toggle selection (add 1 or remove)
      if (page !== undefined) {
        let currentCart: any = null;
        try {
          currentCart = await CartService.getCartByTelegramUser(ctx.store.id, telegramUser.id);
        } catch (err) {
          console.warn("[BOT CART] Error reading user cart during toggle:", err);
        }

        const existingItem = currentCart?.items?.find(
          (i: any) => i.productId === productId || i.id === productId
        );

        if (existingItem) {
          // Deselect: remove from cart
          await CartService.removeItemByTelegramUser(
            ctx.store.id,
            telegramUser.id,
            existingItem.id
          );
          await ctx.botService.answerCallbackQuery(cbId, "🗑️ Removido do carrinho!");
        } else {
          // Select: add exactly 1 unit
          const cart = await CartService.addItemByTelegramUser(
            ctx.store.id,
            telegramUser.id,
            productId,
            1
          );

          let toast = "✅ Adicionado ao carrinho!";
          if (cart?.progressiveDiscount && cart.progressiveDiscount > 0) {
            toast = `🎉 Desconto ativado! Economia de R$ ${cart.progressiveDiscount.toFixed(2).replace(".", ",")}`;
          } else if (cart?.progressivePromotion?.nextTierProgress?.unitsRemaining) {
            const remaining = cart.progressivePromotion.nextTierProgress.unitsRemaining;
            const targetQty = cart.progressivePromotion.nextTierProgress.targetQuantity;
            const targetPriceFormatted = `R$ ${(cart.progressivePromotion.nextTierProgress.targetTierPriceCents / 100).toFixed(2).replace(".", ",")}`;
            toast = remaining === 1
              ? `🔥 Falta só 1 produto para desbloquear ${targetQty} por ${targetPriceFormatted}!`
              : `🚀 Adicionado! Faltam ${remaining} para ${targetQty} com desconto!`;
          }

          await ctx.botService.answerCallbackQuery(cbId, toast);
        }

        // Re-render catalog page in-place without replacing screen
        const { text, replyMarkup, linkPreviewOptions } = await formatCatalogMessage(
          ctx.store.id,
          ctx.miniAppUrl,
          page,
          telegramUser.id
        );

        if (chatId && messageId) {
          await ctx.botService.editMessageText(
            chatId,
            messageId,
            text,
            replyMarkup,
            "Markdown",
            linkPreviewOptions
          );
        }
        return true;
      }

      // When called without page (e.g. from progressive offers or external callback):
      const cart = await CartService.addItemByTelegramUser(
        ctx.store.id,
        telegramUser.id,
        productId,
        1
      );

      let toast = "✅ Produto adicionado ao carrinho!";
      if (cart?.progressiveDiscount && cart.progressiveDiscount > 0) {
        toast = `🎉 Desconto ativado! Economia de R$ ${cart.progressiveDiscount.toFixed(2).replace(".", ",")}`;
      } else if (cart?.progressivePromotion?.nextTierProgress?.unitsRemaining) {
        const remaining = cart.progressivePromotion.nextTierProgress.unitsRemaining;
        const targetQty = cart.progressivePromotion.nextTierProgress.targetQuantity;
        const targetPriceFormatted = `R$ ${(cart.progressivePromotion.nextTierProgress.targetTierPriceCents / 100).toFixed(2).replace(".", ",")}`;
        toast = remaining === 1
          ? `🔥 Falta só 1 produto para desbloquear ${targetQty} por ${targetPriceFormatted}!`
          : `🚀 Adicionado! Faltam ${remaining} para ${targetQty} com desconto!`;
      }

      await ctx.botService.answerCallbackQuery(cbId, toast);

      const { text, replyMarkup } = formatCartMessage(cart, ctx.miniAppUrl);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 6. Add combo
    if (cbData.startsWith("combo_add:")) {
      const comboId = cbData.replace("combo_add:", "").trim();
      if (!comboId) {
        await ctx.botService.answerCallbackQuery(cbId, "⚠️ Combo inválido.", true);
        return true;
      }

      const cart = await CartService.addComboByTelegramUser(
        ctx.store.id,
        telegramUser.id,
        comboId,
        1
      );
      const { text, replyMarkup } = formatCartMessage(cart, ctx.miniAppUrl);
      await ctx.botService.answerCallbackQuery(cbId, "🎁 Combo adicionado ao carrinho!");
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 7. Increment product quantity
    if (cbData.startsWith("cart_inc:")) {
      const productId = cbData.replace("cart_inc:", "").trim();
      const cart = await CartService.addItemByTelegramUser(
        ctx.store.id,
        telegramUser.id,
        productId,
        1
      );
      const { text, replyMarkup } = formatCartMessage(cart, ctx.miniAppUrl);

      let toast = "➕ Quantidade aumentada!";
      if (cart.progressiveDiscount && cart.progressiveDiscount > 0) {
        toast = `🎉 Desconto ativo! Economia de R$ ${cart.progressiveDiscount.toFixed(2).replace(".", ",")}`;
      }
      await ctx.botService.answerCallbackQuery(cbId, toast);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 8. Decrement item quantity (removes if reached 1)
    if (cbData.startsWith("cart_dec:")) {
      const itemId = cbData.replace("cart_dec:", "").trim();
      const currentCart = await CartService.getCartByTelegramUser(ctx.store.id, telegramUser.id);
      const item = currentCart.items.find((i) => i.id === itemId);

      let updatedCart: CartDTO;
      if (!item || item.quantity <= 1) {
        updatedCart = await CartService.removeItemByTelegramUser(
          ctx.store.id,
          telegramUser.id,
          itemId
        );
        await ctx.botService.answerCallbackQuery(cbId, "🗑️ Item removido do carrinho!");
      } else {
        updatedCart = await CartService.updateQuantityByTelegramUser(
          ctx.store.id,
          telegramUser.id,
          itemId,
          item.quantity - 1
        );
        await ctx.botService.answerCallbackQuery(cbId, "➖ Quantidade reduzida!");
      }

      const { text, replyMarkup } = formatCartMessage(updatedCart, ctx.miniAppUrl);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    // 9. Remove item completely
    if (cbData.startsWith("cart_rem:")) {
      const itemId = cbData.replace("cart_rem:", "").trim();
      const updatedCart = await CartService.removeItemByTelegramUser(
        ctx.store.id,
        telegramUser.id,
        itemId
      );
      const { text, replyMarkup } = formatCartMessage(updatedCart, ctx.miniAppUrl);
      await ctx.botService.answerCallbackQuery(cbId, "🗑️ Item removido!");
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
      return true;
    }

    return false;
  } catch (error: any) {
    console.error(`[BOT CART] Error handling callback query ${cbData} for store ${ctx.store.id}:`, error);
    const friendlyMsg =
      error.message?.includes("não encontrado") || error.message?.includes("disponível")
        ? (error.message?.toLowerCase().includes("combo")
            ? "⚠️ Este combo não está mais disponível."
            : "⚠️ Este produto não está mais disponível.")
        : "⚠️ Não foi possível alterar o carrinho no momento.";

    await ctx.botService.answerCallbackQuery(cbId, friendlyMsg, true);
    return true;
  }
}
