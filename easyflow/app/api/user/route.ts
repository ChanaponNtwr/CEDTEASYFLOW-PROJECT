// /app/api/user/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";     // path ไป Prisma client ของคุณ

export async function GET() {
  try {
    // ดึง session ของผู้ใช้
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return new Response(
        JSON.stringify({ ok: false, user: null }),
        { status: 401 }
      );
    }

    // query user ใน database โดยเลือกเฉพาะ fname และ image
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        fname: true,
        image: true,
      },
    });

    return new Response(
      JSON.stringify({ ok: true, user }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching user:", error);
    return new Response(
      JSON.stringify({ ok: false, user: null, error: "Internal Server Error" }),
      { status: 500 }
    );
  }
}
