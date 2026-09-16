import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, stores } from "@/db/schema";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const userRecord = await db.query.users.findFirst({
          where: eq(users.email, credentials.email)
        });

        if (!userRecord) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, userRecord.password);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: userRecord.id,
          email: userRecord.email,
          name: userRecord.name,
          role: userRecord.role,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // Will be created later or we can rely on default
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    throw new Error("Unauthorized - Admin access required");
  }
  return user;
}

export async function requireSeller() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'seller') {
    throw new Error("Unauthorized - Seller access required");
  }
  return user;
}

export async function getCurrentStore() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'seller') {
    return null;
  }
  
  const userStore = await db.query.stores.findFirst({
    where: eq(stores.ownerId, user.id)
  });
  
  return userStore || null;
}
