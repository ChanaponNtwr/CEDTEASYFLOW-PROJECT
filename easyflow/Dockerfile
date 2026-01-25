# Stage 1: Install Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install OpenSSL (จำเป็นสำหรับ Prisma ในขั้นตอน npm install)
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy package files
COPY package.json ./

# [FIX] ลบ package-lock.json และ install ใหม่ เพื่อแก้ปัญหา OS mismatch และ Lockfile
# หมายเหตุ: การลบ lockfile อาจทำให้ version library อัปเดต (เช่น Next.js 15) ซึ่งเป็นสาเหตุของ Error ปัจจุบัน
# หากต้องการ fix version เดิม แนะนำให้แก้ใน package.json ให้เป็น version ที่แน่นอน (ไม่ต้องใส่ ^)
RUN rm -f package-lock.json && npm install

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app

# [FIX] ต้องลง OpenSSL ใน Stage นี้ด้วย เพื่อให้ Prisma Generate ตรวจจับ OS ถูกต้อง
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy Source Code
COPY . .

# Copy node_modules จาก deps
COPY --from=deps /app/node_modules ./node_modules

# [FIX] Prisma Generate
# ปล่อยให้ Prisma ตรวจจับ Binary Target เอง (debian-openssl-3.0.x สำหรับ node:20-slim)
RUN npx prisma generate

# Build Next.js
# ขั้นตอนนี้จะฟ้อง Error ถ้าไม่ได้แก้ไฟล์ page.tsx ตามข้อ 1
RUN npm run build

# Stage 3: Runner (Production Image)
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install OpenSSL for production runtime (จำเป็นมากสำหรับการต่อ DB)
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# สร้าง user เพื่อความปลอดภัย
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy ไฟล์จำเป็นจาก Builder
COPY --from=builder /app/public ./public

# Copy Standalone build (ลดขนาด Image)
# Next.js จะสร้าง folder นี้ให้อัตโนมัติเมื่อ build ถ้าใน next.config.js มี output: 'standalone'
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]