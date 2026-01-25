FROM node:18-slim AS builder

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY package*.json ./
COPY . .

WORKDIR /app/easyflow

RUN npm ci

COPY backend/prisma/schema.prisma ./prisma/schema.prisma

RUN npx prisma generate

ENV BASE_API="http://build-placeholder" \
    DATABASE_URL="postgresql://build-placeholder:5432/db" \
    GOOGLE_CLIENT_ID="build-placeholder" \
    GOOGLE_CLIENT_SECRET="build-placeholder" \
    NEXTAUTH_SECRET="build-placeholder" \
    NEXTAUTH_URL="http://build-placeholder" \
    SERVER_HOST="build-placeholder"

RUN npm run build

FROM node:18-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl

COPY --from=builder /app .
RUN npm prune --production

EXPOSE 3000
CMD ["npm", "start"]