FROM node:20

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=9000

# Generate Prisma client without relying on prisma being executable
RUN node node_modules/prisma/build/index.js generate

EXPOSE 9000

CMD ["node", "src/server.js"]
