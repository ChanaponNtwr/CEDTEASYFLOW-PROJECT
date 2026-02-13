# builder
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=development

# copy lock and package first for better cache
COPY package*.json ./
RUN npm ci --silent

COPY . .
# build Next app
RUN npm run build

# production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# set PORT if needed
ENV PORT=3000

# copy build outputs and package files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
# copy prisma client if present (optional)
# COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# install production deps only
RUN npm ci --production --silent

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["npm", "start"]
