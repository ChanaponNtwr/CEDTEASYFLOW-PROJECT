FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# 1. ลง Openssl
RUN apk add --no-cache openssl

# --- แก้ไขจุดที่ 1: ลบ --only=production ออก เพื่อให้ลง Prisma CLI มาด้วย ---
RUN npm ci 
# -------------------------------------------------------------------

COPY . .

# 2. สร้าง Prisma Client
RUN npx prisma generate

# (Optional) ถ้าอยากลดขนาด Image ให้เพิ่มบรรทัดนี้หลังจาก generate เสร็จ
# RUN npm prune --production

EXPOSE 9000
CMD ["node", "src/server.js"]