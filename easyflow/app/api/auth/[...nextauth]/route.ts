import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { type JWT } from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        // ใช้ profile.picture แทน user.image
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture, // <- รับรูปจาก Google
          // providerAccountId: profile.sub,
        };
      },
    }),
  ],
  callbacks: {
  async signIn({ user, account, profile }) {
    if (!user.email) return false;

    // ตรวจสอบ user ใน database
    let dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    const imageUrl = (profile as any)?.picture ?? null;

    const highResImage = imageUrl?.includes("googleusercontent.com")
  ? imageUrl.replace(/=s\d+(-c)?/, "=s400-c") // s400 = ขนาดใหญ่
  : imageUrl;

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email: user.email,
          name: user.name ?? "Unknown",
          fname: user.name?.split(" ")[0] ?? "",
          lname: user.name?.split(" ")[1] ?? "",
          image: highResImage,
        },
      });
    } else {
      dbUser = await prisma.user.update({
        where: { email: user.email },
        data: {
          name: user.name ?? "Unknown",
          fname: user.name?.split(" ")[0] ?? "",
          lname: user.name?.split(" ")[1] ?? "",
          image: highResImage ?? dbUser.image,
        },
      });
    }

    // เช็คว่า account ไม่ null ก่อน
    if (account) {
      const existingAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
      });

      if (!existingAccount) {
        await prisma.account.create({
          data: {
            userId: dbUser.id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            type: account.type,
            access_token: account.access_token ?? "",
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            expires_at: account.expires_at ?? null,
          },
        });
      }
    }

    return true;
    },

    async jwt({ token }): Promise<JWT> {
      if (!token.email) return token;

      const dbUser = await prisma.user.findUnique({
        where: { email: token.email },
      });

      if (!dbUser) return token;

      token.userId = dbUser.id.toString();
      token.name = dbUser.name ?? "Unknown";
      token.email = dbUser.email ?? "";
      token.picture = dbUser.image ?? null;

      return token;
    },

//     async jwt({ token, user }) {
//   if (user) {
//     token.userId = user.id;
//     token.name = user.name;
//     token.email = user.email;
//     token.picture = user.image;
//   }
//   return token;
// },

    async session({ session, token }) {
      session.user = {
        userId: token.userId as string,
        name: token.name as string ?? "Unknown",
        email: token.email as string ?? "",
        image: token.picture as string | null ?? null,
      };
      return session;
    // async session({ session, user }) {
    // if (user) {
    //   session.user = {
    //     userId: user.id.toString(),
    //     name: user.name ?? "Unknown",
    //     email: user.email ?? "",
    //     image: user.image ?? null,
    //   };
    // }
    // return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  // session: { strategy: "database" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
