# Stage 1: Install Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install OpenSSL (จำเป็นสำหรับ Prisma)
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy package files
COPY package.json package-lock.json* ./

# Copy prisma schema directory
COPY prisma ./prisma/

# [FIX] ใช้ npm install แทน npm ci
# เพื่อบังคับให้โหลด Binary สำหรับ Linux (lightningcss-linux-x64-gnu)
# ที่อาจจะไม่มีใน package-lock.json ของ Windows/Mac
RUN npm install

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app

# Copy node_modules ที่ install มาใหม่ๆ จาก stage deps
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
# ตอนนี้จะมีไฟล์ lightningcss ครบแล้ว จะไม่ error
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