// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma"; // Make sure your prisma client is imported

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: "jwt", 
  },

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      // 1. Sync the user to the database to ensure an integer ID exists
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name ?? "Unknown",
            fname: user.name?.split(" ")[0] ?? "",
            lname: user.name?.split(" ")[1] ?? "",
            image: user.image ?? null,
          },
        });
      }
      return true;
    },

    async jwt({ token }) {
      // 2. Look up the user in the database by email to get the correct Integer ID
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });

        if (dbUser) {
          token.id = dbUser.id; // This assigns the integer (e.g., 1, 2, 3) instead of Google's ID
        }
      }
      return token;
    },

    async session({ session, token }) {
      // 3. Pass the integer ID to the client-side session
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};