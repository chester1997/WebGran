import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Check if order_items has the right columns
  const orderItemsCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'order_items' ORDER BY ordinal_position`;
  console.log('order_items columns:', orderItemsCols.map((c: any) => c.column_name).join(', '));
  
  // Check orders
  const ordersCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position`;
  console.log('orders columns:', ordersCols.map((c: any) => c.column_name).join(', '));
  
  // Check if tables exist
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log('All tables:', tables.map((t: any) => t.table_name).join(', '));
}

main().catch(console.error);
