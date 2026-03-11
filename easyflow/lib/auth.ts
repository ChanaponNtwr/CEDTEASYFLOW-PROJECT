// // lib/auth.ts
// import NextAuth, { type NextAuthOptions } from "next-auth";
// import GoogleProvider from "next-auth/providers/google";
// import { PrismaAdapter } from "@next-auth/prisma-adapter";
// import { prisma } from "@/lib/prisma";

// export const authOptions: NextAuthOptions = {
//   adapter: PrismaAdapter(prisma),

//   providers: [
//     GoogleProvider({
//       clientId: process.env.GOOGLE_CLIENT_ID!,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//       profile(profile) {
//         const imageUrl = profile.picture ?? null;

//         const highResImage =
//           imageUrl?.includes("googleusercontent.com")
//             ? imageUrl.replace(/=s\d+(-c)?/, "=s400-c")
//             : imageUrl;

//         return {
//           id: profile.sub,
//           name: profile.name,
//           email: profile.email,
//           image: highResImage,
//         };
//       },
//     }),
//   ],

//   session: {
//     strategy: "jwt",
//   },

//   callbacks: {
//     async signIn({ user }) {
//       if (!user.email) return false;

//       const existing = await prisma.user.findUnique({
//         where: { email: user.email },
//       });

//       if (!existing) {
//         await prisma.user.create({
//           data: {
//             email: user.email,
//             name: user.name ?? "Unknown",
//             fname: user.name?.split(" ")[0] ?? "",
//             lname: user.name?.split(" ")[1] ?? "",
//             image: user.image ?? null,
//           },
//         });
//       } else {
//         await prisma.user.update({
//           where: { email: user.email },
//           data: {
//             name: user.name ?? existing.name,
//             fname: user.name?.split(" ")[0] ?? existing.fname,
//             lname: user.name?.split(" ")[1] ?? existing.lname,
//             image: user.image ?? existing.image,
//           },
//         });
//       }

//       return true;
//     },

//     async jwt({ token }) {
//       if (token.email) {
//         const dbUser = await prisma.user.findUnique({
//           where: { email: token.email },
//         });

//         if (dbUser) {
//           token.id = dbUser.id.toString();
//           token.name = dbUser.name;
//           token.picture = dbUser.image;
//         }
//       }

//       return token;
//     },

//     async session({ session, token }) {
//       if (!session.user) return session;

//       session.user.userId = token.id as string;
//       session.user.name = token.name ?? null;
//       session.user.email = token.email ?? null;
//       session.user.image = token.picture ?? null;

//       return session;
//     },
//   },

//   secret: process.env.NEXTAUTH_SECRET,
// };


// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  // 1. ปิด PrismaAdapter ออกไปก่อนเพื่อเช็คว่า OAuth Flow ทำงานได้ปกติไหม
  // adapter: PrismaAdapter(prisma), 

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: "jwt", // ใช้ JWT ในการเก็บ Session (ไม่ต้องพึ่งพา DB)
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // ให้ Return true ไปเลยเพื่อให้ล็อกอินผ่านแน่นอนตอนทดสอบ
      if (user.email) {
        return true;
      }
      return false;
    },
    async jwt({ token, user }) {
      // ถ้าเป็นการล็อกอินครั้งแรก (user จะมีค่า) ให้เก็บ id ลงใน token
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // ส่งค่า id กลับไปที่หน้าบ้าน (Client-side)
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },

  // สำคัญมาก: ต้องตรงกับใน .env
  secret: process.env.NEXTAUTH_SECRET,
};