# Stage 1: Install Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install OpenSSL (จำเป็นสำหรับ Prisma บน Debian/Slim)
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy package files
COPY package.json ./

# [FIX] ลบ package-lock.json และสั่ง install ใหม่
# เพื่อให้มั่นใจว่าได้ Dependencies ที่รองรับ Linux (และ Next.js 15)
RUN rm -f package-lock.json && npm install

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app

# [FIX] Copy Source Code เข้ามาก่อน
COPY . .

# [FIX] แล้วค่อย Copy node_modules จาก deps มาทับ
# เพื่อป้องกัน node_modules จากเครื่อง Local (Windows/Mac) ที่อาจติดมาทำลายระบบ
COPY --from=deps /app/node_modules ./node_modules

# Generate Prisma Client
# กำหนด ENV เพื่อลด Warning ของ Prisma
ENV PRISMA_CLI_BINARY_TARGETS=native,debian-openssl-3.0.x
RUN npx prisma generate

# Build Next.js
# หากแก้โค้ดหน้า page.tsx แล้ว คำสั่งนี้จะผ่านฉลุย
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