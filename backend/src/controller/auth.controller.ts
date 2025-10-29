import prisma from "../lib/prisma";
import { type JWT } from "next-auth/jwt";
import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";

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
    async signIn({ user }) {
      if (!user.email) return false;

      let dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      const imageUrl = (user as any).image ?? null;

      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            email: user.email,
            name: user.name ?? "Unknown",
            fname: user.name?.split(" ")[0] ?? "",
            lname: user.name?.split(" ")[1] ?? "",
            image: imageUrl,
          } as any,
        });
      } else {
        dbUser = await prisma.user.update({
          where: { email: user.email },
          data: {
            name: user.name ?? "Unknown",
            fname: user.name?.split(" ")[0] ?? "",
            lname: user.name?.split(" ")[1] ?? "",
            image: imageUrl,
          } as any,
        });
      }

      const existingAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: user.id.toString(),
          },
        },
      });

      if (!existingAccount) {
        await prisma.account.create({
          data: {
            userId: dbUser.id, // Prisma จะรับ UUID หรือ Int ตาม schema
            provider: "google",
            providerAccountId: user.id.toString(),
            type: "oauth",
            access_token: (user as any).accessToken ?? "",
          },
        });
      }

      return true;
    },

    async jwt({ token, user }): Promise<JWT> {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!dbUser) return token;

        return {
          ...token,
          userId: dbUser.id.toString(),
          name: dbUser.name ?? "Unknown",
          email: dbUser.email ?? "unknown@example.com",
          picture: dbUser.image ?? null,
        };
      }
      return token;
    },

    async session({ session }) {
    if (session?.user?.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      if (dbUser) {
        session.user.image = dbUser.image; // ใช้ค่าจาก DB
      }
    }
    return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
};
