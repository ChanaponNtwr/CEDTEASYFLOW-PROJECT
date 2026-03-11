// lib/auth.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        const imageUrl = profile.picture ?? null;
        const highResImage =
          imageUrl?.includes("googleusercontent.com")
            ? imageUrl.replace(/=s\d+(-c)?/, "=s400-c")
            : imageUrl;

        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: highResImage,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      // สร้างหรืออัปเดต user ใน DB เพื่อให้มี dbUser.id (Int)
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
      } else {
        await prisma.user.update({
          where: { email: user.email },
          data: {
            name: user.name ?? existing.name,
            fname: user.name?.split(" ")[0] ?? existing.fname,
            lname: user.name?.split(" ")[1] ?? existing.lname,
            image: user.image ?? existing.image,
          },
        });
      }

      return true;
    },

    async jwt({ token }) {
      // เติมข้อมูลจาก DB ลงใน token (ให้ token.id เป็น dbUser.id เป็นสตริง)
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });
        if (dbUser) {
          token.id = dbUser.id.toString(); // เก็บเป็น string สะดวกส่งกลับใน session
          token.name = dbUser.name;
          token.picture = dbUser.image;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (!session.user) return session;

      (session.user as any).userId = token.id as string; // dbUser.id เป็น string เช่น "3"
      session.user.name = token.name ?? null;
      session.user.email = token.email ?? null;
      session.user.image = token.picture ?? null;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};