import 'dotenv/config';
import { db } from './index';
import { stores, telegramBots } from './schema';
import { validateProductTelegramChat } from '../lib/telegram/product-chat-validator';

async function main() {
  console.log("=== WEBGRAN FASE 10 — TESTE OBRIGATÓRIO DO PRODUTO (VALIDAÇÃO DE GRUPO) ===");

  const targetChatId = "-1003982066404";
  console.log(`Testando validação para Chat ID: ${targetChatId}`);

  // 1. Get first store with bot
  const botRecord = await db.query.telegramBots.findFirst({
    with: {
      store: true
    }
  });

  if (!botRecord || !botRecord.storeId) {
    console.error("❌ Nenhum bot cadastrado no banco de dados para teste.");
    return;
  }

  console.log(`Store ID: ${botRecord.storeId}`);
  console.log(`Bot username: @${botRecord.username || 'unknown'}`);

  // 2. Execute validateProductTelegramChat
  const validation = await validateProductTelegramChat(botRecord.storeId, targetChatId);

  console.log("\n[Resultado da Validação]:");
  console.log(JSON.stringify(validation, null, 2));

  if (validation.success) {
    console.log("\n✅ SEÇÃO 18 VALIDAÇÃO PASSOU:");
    console.log(`✓ Chat encontrado: "${validation.chat?.title}" (Tipo: ${validation.chat?.type})`);
    console.log(`✓ Bot administrador: @${validation.bot?.username}`);
    console.log(`✓ Convites: pode convidar usuários (${validation.canInvite})`);
  } else {
    console.log("\nℹ️ Validação retornou diagnóstico de erro conforme especificação:");
    console.log(`Código: ${validation.code}`);
    console.log(`Mensagem:\n${validation.error}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
