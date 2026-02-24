FROM node:20

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=9000

EXPOSE 9000

CMD ["node", "src/server.js"]
