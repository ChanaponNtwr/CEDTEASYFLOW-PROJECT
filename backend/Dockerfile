FROM node:20

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=9000

RUN npx prisma generate

EXPOSE 9000

CMD ["node", "src/server.js"]
