import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const bannerCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'banners' ORDER BY ordinal_position`;
  console.log('banners columns:', bannerCols.map((c: any) => c.column_name).join(', '));
  
  // Check if banners table has storeId
  const storeIdExists = bannerCols.find((c: any) => c.column_name === 'store_id');
  if (!storeIdExists) {
    console.log('Missing store_id in banners! Adding...');
    await sql`ALTER TABLE banners ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE`;
    console.log('✓ store_id added to banners');
  } else {
    console.log('store_id already exists in banners');
  }
}

main().catch(console.error);
