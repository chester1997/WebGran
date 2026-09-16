const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });
const sql = neon(process.env.DATABASE_URL);
sql`TRUNCATE telegram_customers CASCADE;`.then(() => console.log('Truncated')).catch(console.error);
