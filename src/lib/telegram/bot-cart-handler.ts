import { TelegramBotService } from "./bot";
import { CartService, CartDTO } from "@/lib/cart/cart-service";
import { ComboService, ActiveComboDTO } from "@/lib/combos/combo-service";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

interface BotCartContext {
  store: {
    id: string;
    name: string;
    slug: string;
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
      `Explore nosso catálogo no Mini App ou veja os destaques aqui pelo chat!`;

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
            text: "🎁 Ver Combos com Desconto",
            callback_data: "combo_list",
          },
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
  text += `📦 *Total de Itens:* ${cart.itemCount}\n\n`;
  text += `_Dica: Você pode alterar quantidades ou finalizar sua compra pelo Mini App a qualquer momento._`;

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
      text: "🎁 Ver Combos",
      callback_data: "combo_list",
    },
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
 * Handles interactive callback queries for cart and combo operations.
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
  if (!cbData.startsWith("cart_") && !cbData.startsWith("combo_")) {
    return false;
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

    // 5. Add product
    if (cbData.startsWith("cart_add:")) {
      const productId = cbData.replace("cart_add:", "").trim();
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
      await ctx.botService.answerCallbackQuery(cbId, "✅ Produto adicionado ao carrinho!");
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
      await ctx.botService.answerCallbackQuery(cbId, "➕ Quantidade aumentada!");
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
