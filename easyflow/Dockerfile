# Stage 1: Install Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install OpenSSL (จำเป็นสำหรับ Prisma)
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy package files
COPY package.json ./

# ลบ package-lock.json และสั่ง install ใหม่ (แก้ปัญหา Dependency OS ต่างกัน)
RUN rm -f package-lock.json && npm install

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app

# [FIX] ต้องลง OpenSSL ใน Stage นี้ด้วย เพื่อให้ Prisma Generate ตรวจจับ OS ถูกต้อง
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy Source Code เข้ามาก่อน
COPY . .

# Copy node_modules จาก deps มาทับ
COPY --from=deps /app/node_modules ./node_modules

# [FIX] ลบ ENV ที่เคยใส่ไว้ทิ้งไป (PRISMA_CLI_BINARY_TARGETS) 
# ปล่อยให้ Prisma ตรวจจับเองว่าต้องใช้ debian-openssl-3.0.x

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Stage 3: Runner (Production Image)
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install OpenSSL for production runtime
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# สร้าง user เพื่อความปลอดภัย
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy ไฟล์จำเป็นจาก Builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]