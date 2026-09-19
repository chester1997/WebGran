import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const isServer = typeof window === 'undefined';
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;

if (isServer && !dbUrl) {
  throw new Error("DATABASE_URL não configurada nas variáveis de ambiente do Vercel. Adicione DATABASE_URL em Vercel Dashboard -> Project Settings -> Environment Variables.");
}

const sql = neon(dbUrl || 'postgresql://placeholder:placeholder@localhost/placeholder');
export const db = drizzle(sql, { schema });
