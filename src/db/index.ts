import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;

if (!dbUrl) {
  throw new Error("DATABASE_URL não configurada nas variáveis de ambiente do Vercel. Adicione DATABASE_URL nas configurações do Vercel (Project Settings -> Environment Variables).");
}

const sql = neon(dbUrl);
export const db = drizzle(sql, { schema });
