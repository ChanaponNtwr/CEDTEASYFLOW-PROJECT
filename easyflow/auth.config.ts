// easyflow/auth.config.ts
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth"; // 1. เปลี่ยน import เป็น NextAuthOptions

export const authConfig: NextAuthOptions = { // 2. เปลี่ยน Type ตรงนี้
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET!,
  session: {
    strategy: "jwt", // เพิ่ม strategy เพื่อให้มั่นใจว่าใช้ token
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        // 3. ใช้ as any เพื่อแก้ปัญหา TypeScript หา property 'id' ไม่เจอใน Default User type
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};