# Stage 1: Install Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install OpenSSL (Required for Prisma on Debian-based images)
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy package files
COPY package.json package-lock.json* ./

# Copy prisma schema directory
# [Note] Ensure 'prisma' is NOT in your .dockerignore file
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
# Note: Prisma on slim needs the openssl we installed in deps? 
# Actually, builder needs its own environment, let's ensure it has what it needs.
# But usually node_modules contains the engine.
RUN npx prisma generate

# Build Next.js
# ตอนนี้ใช้ slim (glibc) ปัญหา lightningcss/swc จะหายไป
RUN npm run build

# Stage 3: Runner (Production Image)
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install OpenSSL for production runtime (Prisma needs it)
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# สร้าง user เพื่อความปลอดภัย
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy ไฟล์จำเป็นจาก Builder (โหมด Standalone)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]