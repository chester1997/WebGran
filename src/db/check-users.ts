import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  const allUsers = await db.query.users.findMany();
  console.log('--- ALL USERS IN DB ---');
  allUsers.forEach((u) => {
    console.log(`ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Role: ${u.role}`);
  });
}

main().catch(console.error);
