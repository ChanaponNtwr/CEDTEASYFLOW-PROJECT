import NextAuth, { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string; // ใช้ string ถ้าเป็น UUID
      name: string;
      email: string;
      image?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId: string; // ใช้ string ถ้าเป็น UUID
    name: string;
    email: string;
    picture?: string | null;
  }
}
