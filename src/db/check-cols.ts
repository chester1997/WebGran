import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position`;
  console.log('Products columns:', cols.map((c: any) => c.column_name).join(', '));
  
  const botCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'telegram_bots' ORDER BY ordinal_position`;
  console.log('TelegramBots columns:', botCols.map((c: any) => c.column_name).join(', '));
}

main().catch(console.error);
