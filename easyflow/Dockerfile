# Stage 1: Install Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install OpenSSL (จำเป็นสำหรับ Prisma บน Debian/Slim)
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy package files
COPY package.json ./

# [FIX 1] ลบ package-lock.json (ถ้ามีติดมา) แล้วสั่ง install ใหม่
# เพื่อแก้ปัญหาไฟล์ lock จาก Windows/Mac ไม่มี dependency ของ Linux
RUN rm -f package-lock.json && npm install

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app

# [FIX 2] สลับลำดับ: Copy Source Code เข้ามาก่อน
COPY . .

# [FIX 2] แล้วค่อย Copy node_modules ที่ถูกต้อง (Linux) จาก deps มาทับ
# วิธีนี้จะกันไม่ให้ node_modules จากเครื่อง local (Windows/Mac) หลุดเข้ามาทำลายระบบ
COPY --from=deps /app/node_modules ./node_modules

# Generate Prisma Client (ตอนนี้จะเจอ engine ของ linux แน่นอน)
RUN npx prisma generate

# Build Next.js
# ตอนนี้ lightningcss จะทำงานได้แล้ว เพราะใช้ไฟล์ของ Linux แท้ๆ
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