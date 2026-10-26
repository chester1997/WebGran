import { TelegramBotService } from "./bot";
import { CartService, CartDTO } from "@/lib/cart/cart-service";
import { ComboService, ActiveComboDTO, ActiveProgressivePromotionDTO } from "@/lib/combos/combo-service";
import { db } from "@/db";
import { products, telegramCustomers } from "@/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import { isDuplicateTelegramCallback } from "./update-dedup";
import { parseSupportConfig } from "@/lib/support/support-helper";
import { AccessService } from "@/lib/orders/access-service";

interface BotCartContext {
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
    const emptyText =
      `🛒 *Seu Carrinho está vazio!*\n\n` +
      `Você ainda não adicionou nenhum produto ao carrinho desta loja.\n\n` +
      `Explore nosso catálogo no Mini App ou aproveite nossas ofertas com desconto progressivo!`;

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
            text: "📦 Ver Produtos",
            callback_data: "cart_cat",
          },
        ],
      ],
    };

    return { text: emptyText, replyMarkup: emptyKeyboard };
  }

  let text = `🛒 *Seu Carrinho de Compras*\n\n`;

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
      const tiersSummary = cart.progressivePromotion.appliedTiers
        .map((t) => `${t.count}x (${t.minQuantity} un por R$ ${(t.priceCents / 100).toFixed(2).replace(".", ",")})`)
        .join(", ");
      text += `🏷️ *Faixa aplicada:* ${tiersSummary}\n`;
    }
  } else {
    text += `💵 *Total:* *R$ ${cart.total.toFixed(2).replace(".", ",")}*\n`;
  }

  text += `📦 *Total de Itens:* ${cart.itemCount}\n`;

  // Display next tier progress message if available
  const nextTier = cart.progressivePromotion?.nextTierProgress;
  if (nextTier && nextTier.unitsRemaining > 0) {
    const targetPriceFormatted = `R$ ${(nextTier.targetTierPriceCents / 100).toFixed(2).replace(".", ",")}`;
    const verb = nextTier.unitsRemaining === 1 ? "Falta" : "Faltam";
    const unitsWord = nextTier.unitsRemaining === 1 ? "produto" : "produtos";
    text += `\n🚀 *Oferta:* ${verb} *${nextTier.unitsRemaining} ${unitsWord}* para desbloquear *${nextTier.targetQuantity} por ${targetPriceFormatted}*!\n`;
  }

  text += `\n_Dica: Você pode alterar quantidades ou finalizar sua compra pelo Mini App a qualquer momento._`;

  const inlineKeyboardRows: any[][] = [];

  // Per-item action controls: [➖] [Qtd] [➕] [🗑️]
  for (const item of cart.items) {
    const titleSnippet = item.title.length > 15 ? `${item.title.slice(0, 15)}...` : item.title;
    inlineKeyboardRows.push([
      {
        text: `➖`,
        callback_data: `cart_dec:${item.id}`,
      },
      {
        text: `${item.quantity}x ${titleSnippet}`,
        callback_data: `cart_noop`,
      },
      {
        text: `➕`,
        callback_data: item.isCombo ? `combo_add:${item.id}` : `cart_inc:${item.id}`,
      },
      {
        text: `🗑️`,
        callback_data: `cart_rem:${item.id}`,
      },
    ]);
  }

  // Action buttons
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

  return {
    text,
    replyMarkup: { inline_keyboard: inlineKeyboardRows },
  };
}

/**
 * Formats a catalog list for quick item addition via Telegram chat.
 */
export async function formatCatalogMessage(
  storeId: string,
  miniAppUrl: string
): Promise<{ text: string; replyMarkup: any }> {
  const activeProducts = await db.query.products.findMany({
    where: and(eq(products.storeId, storeId), eq(products.status, "active")),
    limit: 6,
    orderBy: [desc(products.createdAt)],
  });

  if (!activeProducts || activeProducts.length === 0) {
    return {
      text: `📦 *Nenhum produto disponível no momento.*\n\nFique de olho em nossas novidades!`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "🎁 Ver Combos",
              callback_data: "combo_list",
            },
            {
              text: "🛍️ Abrir Loja",
              web_app: { url: miniAppUrl },
            },
          ],
        ],
      },
    };
  }

  let text = `📦 *Catálogo de Produtos*\n\nEscolha um produto abaixo para adicionar ao seu carrinho:\n`;

  const inlineKeyboardRows: any[][] = [];

  for (const prod of activeProducts) {
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
      text: "🔥 Ver Ofertas Progressivas",
      callback_data: "prog_view",
    },
    {
      text: "🎁 Ver Combos Promocionais",
      callback_data: "combo_list",
    },
  ]);

  inlineKeyboardRows.push([
    {
      text: "🛒 Ver Carrinho",
      callback_data: "cart_view",
    },
    {
      text: "🛍️ Abrir Loja Completa",
      web_app: { url: miniAppUrl },
    },
  ]);

  return {
    text,
    replyMarkup: { inline_keyboard: inlineKeyboardRows },
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
  chatId: number | string
) {
  try {
    const { text, replyMarkup } = await formatCatalogMessage(ctx.store.id, ctx.miniAppUrl);
    await ctx.botService.sendMessage(chatId, text, replyMarkup, "Markdown");
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
      `Assim que seu pagamento for confirmado via PIX ou cartão, seus links de acesso aos canais ou grupos VIP serão liberados aqui automaticamente!`;

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
      ],
    };

    return { text, replyMarkup };
  }

  let text =
    `📺 *Meus Acessos — ${store.name}*\n\n` +
    `Você possui *${accessesList.length}* ${accessesList.length === 1 ? "produto liberado" : "produtos liberados"} nesta loja:\n\n`;

  const inlineKeyboardRows: any[][] = [];

  for (const acc of accessesList) {
    const prodTitle = acc.product?.title || "Produto";
    text += `• *${prodTitle}*\n`;
    if (acc.inviteLink) {
      inlineKeyboardRows.push([
        {
          text: `▶️ Acessar: ${prodTitle.length > 25 ? prodTitle.slice(0, 22) + "..." : prodTitle}`,
          url: acc.inviteLink,
        },
      ]);
    }
  }

  text += `\n_Toque no botão acima para acessar seu canal/conteúdo ou gerencie pelo Mini App._`;

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

  // No-op click on item label
  if (cbData === "cart_noop") {
    await ctx.botService.answerCallbackQuery(cbId);
    return true;
  }

  try {
    // 1. Show catalog view
    if (cbData === "cart_cat") {
      const { text, replyMarkup } = await formatCatalogMessage(ctx.store.id, ctx.miniAppUrl);
      await ctx.botService.answerCallbackQuery(cbId);
      if (chatId && messageId) {
        await ctx.botService.editMessageText(chatId, messageId, text, replyMarkup, "Markdown");
      }
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

    // 5. Add product (supports cart_add: and prog_add:)
    if (cbData.startsWith("cart_add:") || cbData.startsWith("prog_add:")) {
      const productId = cbData.replace(/^(cart_add:|prog_add:)/, "").trim();
      if (!productId) {
        await ctx.botService.answerCallbackQuery(cbId, "⚠️ Produto inválido.", true);
        return true;
      }

      const cart = await CartService.addItemByTelegramUser(
        ctx.store.id,
        telegramUser.id,
        productId,
        1
      );
      const { text, replyMarkup } = formatCartMessage(cart, ctx.miniAppUrl);

      let toast = "✅ Produto adicionado ao carrinho!";
      if (cart.progressiveDiscount && cart.progressiveDiscount > 0) {
        toast = `🎉 Desconto ativado! Economia de R$ ${cart.progressiveDiscount.toFixed(2).replace(".", ",")}`;
      } else if (cart.progressivePromotion?.nextTierProgress?.unitsRemaining) {
        const remaining = cart.progressivePromotion.nextTierProgress.unitsRemaining;
        const targetQty = cart.progressivePromotion.nextTierProgress.targetQuantity;
        toast = `✅ Adicionado! Falta(m) ${remaining} para ${targetQty} com desconto!`;
      }

      await ctx.botService.answerCallbackQuery(cbId, toast);
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
    console.error("[BOT CART] Error handling callback query:", error);
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
