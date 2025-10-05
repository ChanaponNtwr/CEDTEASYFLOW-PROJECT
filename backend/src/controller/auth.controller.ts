// src/controller/auth.controller.ts
import prisma from "../lib/prisma";
import { type JWT } from "next-auth/jwt";
import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import classUser from "../service/user/classuser";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
  ],
  
  callbacks: {
  async signIn({ user, account, profile }) {
    if (!user?.email && !profile?.email) return false;

    const providerAccountId =
      (account as any)?.providerAccountId?.toString() ??
      (profile as any)?.sub?.toString() ??
      (user as any)?.id?.toString();

    const oauthUser = {
      id: providerAccountId,
      email: (user?.email ?? (profile as any)?.email) as string,
      name: (user?.name ?? (profile as any)?.name) as string,
      image: (profile as any)?.picture ?? (user as any)?.image ?? null,
      accessToken: (account as any)?.access_token ?? '',
    };

    try {
      await classUser.ensureUserAndAccount(oauthUser, (account as any)?.provider ?? 'google');
      return true;
    } catch (err) {
      console.error("signIn error:", err);
      return false;
    }
  },

  async jwt({ token, user }): Promise<JWT> {
    // ตอนแรกหลัง sign-in (จะมี user) -> โหลดจาก DB และเติม token
    if (user?.email) {
      const dbUser = await classUser.getUserByEmail(user.email);
      if (!dbUser) return token;
      return {
        ...token,
        userId: dbUser.id.toString(),
        name: dbUser.name ?? token.name ?? "Unknown",
        email: dbUser.email ?? token.email ?? "",
        picture: dbUser.image ?? token.picture ?? null,
      } as JWT;
    }

    // ถ้าต่อมา token มี email แต่ยังไม่มี picture -> เติมจาก DB
    if ((token as any)?.email) {
      const dbUser = await classUser.getUserByEmail((token as any).email as string);
      if (dbUser) {
        (token as any).userId = dbUser.id.toString();
        (token as any).name = (token as any).name ?? dbUser.name ?? "Unknown";
        (token as any).picture = (token as any).picture ?? dbUser.image ?? null;
      }
    }

    return token;
  },

    async session({ session, token }) {
      session.user = {
        ...(session.user as any),
        userId: (token as any).userId,
        name: token.name ?? "Unknown",
        email: token.email ?? "",
        image: token.picture ?? null,
      };
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
};
