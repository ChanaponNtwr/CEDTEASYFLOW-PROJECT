import NextAuth from "next-auth";
import { authOptions } from "./options"; // 1. Import มาจากไฟล์ที่สร้างใหม่

const handler = NextAuth(authOptions);

// 2. Export แค่ GET และ POST เท่านั้น
export { handler as GET, handler as POST };