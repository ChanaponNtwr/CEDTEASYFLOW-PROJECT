import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}


async function connectDB() {
  try {
    await prisma.$connect()
    console.log("✅ Prisma connected to database")
  } catch (error) {
    console.error("❌ Prisma connection error:", error)
  }
}

connectDB()

export default prisma
