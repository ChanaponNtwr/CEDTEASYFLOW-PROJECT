import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "../../../lib/prisma";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // ปล่อยให้ NextAuth จัดการ profile เอง
    }),
  ],
  callbacks: {
  async jwt({ token, user }) {
    if (user) {
      console.log("jwt callback user:", user);
      token.id = user.id;
      token.email = user.email;
      token.name = user.name;
      token.picture = user.image;
    } else {
      console.log("jwt callback no user, token:", token);
    }
    return token;
  },
  async session({ session, token }) {
    console.log("session callback token:", token);
    if (token) {
      session.user.id = token.id as string;
      session.user.email = token.email as string;
      session.user.name = token.name as string;
      session.user.image = token.picture as string;
    }
    return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
