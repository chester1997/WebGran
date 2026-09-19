import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rawDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || '';
  
  const debugInfo = {
    nodeEnv: process.env.NODE_ENV || 'unknown',
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    databaseUrlPresent: rawDbUrl.length > 0,
    databaseUrlLength: rawDbUrl.length,
    databaseUrlStartsWithPostgres: rawDbUrl.startsWith('postgres'),
    databaseUrlHostHint: rawDbUrl.includes('neon.tech') ? 'neon.tech' : (rawDbUrl.length > 0 ? 'other' : 'none'),
    runtime: 'nodejs',
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    databaseConnection: 'UNKNOWN',
    dbError: null as string | null,
  };

  try {
    // Test server-side Neon DB connection with SELECT 1
    await db.execute(sql`SELECT 1`);
    debugInfo.databaseConnection = 'OK';
  } catch (err: any) {
    debugInfo.databaseConnection = 'FAILED';
    debugInfo.dbError = err?.message || String(err);
  }

  return NextResponse.json(debugInfo);
}
