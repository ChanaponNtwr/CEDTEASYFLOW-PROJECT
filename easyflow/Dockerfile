# Use Node.js 20 Alpine as the base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Add libc6-compat for Alpine Node base image compatibility
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
# Use npm ci for clean installation
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js telemetry is disabled
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client before building
RUN npx prisma generate

# Build Next.js application after Prisma Client is ready
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create standard nodejs user and group
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public folder containing static assets
COPY --from=builder /app/public ./public

# Set the correct permissions for the .next cache folder
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# Based on standalone output in next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to exactly 0.0.0.0 mapping
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
