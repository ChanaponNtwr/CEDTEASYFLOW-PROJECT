// app/api/user/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.userId) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.userId) },
    select: {
      fname: true,
      image: true,
    },
  });

  return Response.json({ ok: true, user });
}