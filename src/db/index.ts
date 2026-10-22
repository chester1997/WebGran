import { neon, Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleWs } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

const isServer = typeof window === 'undefined';
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;

if (isServer && !dbUrl) {
  throw new Error("DATABASE_URL não configurada nas variáveis de ambiente do Vercel. Adicione DATABASE_URL em Vercel Dashboard -> Project Settings -> Environment Variables.");
}

if (typeof WebSocket !== 'undefined' && !neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = WebSocket;
}

const sql = neon(dbUrl || 'postgresql://placeholder:placeholder@localhost/placeholder');
export const db = drizzleHttp(sql, { schema });

// Suporte oficial a transações atômicas interativas no Neon via WebSockets (drizzle-orm/neon-serverless).
// O driver neon-http é stateless e não suporta transações interativas (BEGIN/COMMIT).
// Instanciamos o Pool sob demanda exclusivamente quando uma transação for solicitada.
let transactionPool: Pool | null = null;
let transactionDb: ReturnType<typeof drizzleWs> | null = null;

(db as any).transaction = async <T>(
  transactionFn: (tx: any) => Promise<T>,
  config?: any
): Promise<T> => {
  if (!transactionPool) {
    transactionPool = new Pool({
      connectionString: dbUrl || 'postgresql://placeholder:placeholder@localhost/placeholder',
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
  }
  if (!transactionDb) {
    transactionDb = drizzleWs(transactionPool, { schema });
  }
  return await transactionDb.transaction(transactionFn, config);
};
