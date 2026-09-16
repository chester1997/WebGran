import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
import { users, themes } from './schema';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log('Seeding database...');

  // 1. Create Admin User
  const hashedAdminPassword = bcrypt.hashSync('admin123', 10);
  
  await db.insert(users).values({
    name: 'Admin WebGran',
    email: 'admin@webgran.com',
    password: hashedAdminPassword,
    role: 'admin',
  }).onConflictDoUpdate({ 
    target: users.email,
    set: { password: hashedAdminPassword }
  });

  // 2. Create Initial Theme
  await db.insert(themes).values({
    name: 'Studio',
    slug: 'studio',
    description: 'Tema padrão da plataforma',
    config: {
      colors: {
        primary: '#000000',
        secondary: '#ffffff',
      },
      typography: {
        fontFamily: 'Inter, sans-serif',
      },
    },
    isActive: true,
  }).onConflictDoNothing({ target: themes.slug });

  console.log('Database seeded successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
