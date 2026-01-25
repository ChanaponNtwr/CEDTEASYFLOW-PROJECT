# Dockerfile
FROM node:20-slim

# ตั้งค่า working dir
WORKDIR /usr/src/app

# ติดตั้งโปรเจกต์ dependencies แบบ deterministic
# คัดลอกไฟล์ package.json และ package-lock.json ก่อนเพื่อลด layer rebuild
COPY package.json package-lock.json ./

# ถ้าใช้ npm ci ให้แน่ใจว่า lockfile อยู่ด้วย
RUN npm ci --production=false

# คัดลอกโค้ดโปรเจกต์ทั้งหมด (ปรับตามโครงสร้าง repo ของคุณ)
COPY . .

# ถ้า schema.prisma อยู่ใน ../backend/prisma ใน log เดิม — ให้คัดลอกมาที่ prisma/
# (ปรับเส้นทางตามจริงของ repo)
RUN mkdir -p ./prisma \
 && if [ -f ./backend/prisma/schema.prisma ]; then cp ./backend/prisma/schema.prisma ./prisma/schema.prisma; fi

# สร้าง Prisma client (ใช้ npx เพื่อให้ CLI จัดการแพลตฟอร์มให้ถูกต้อง)
RUN npx prisma generate --schema=./prisma/schema.prisma

# สั่ง build ที่จำเป็น (เช่น next build หรือ build คอนเทนเนอร์อื่นๆ)
# ตัวอย่าง: ถ้าเป็น Next.js
# RUN npm run build

# ระบุคำสั่งเริ่มต้น (ปรับตามแอปของคุณ)
CMD ["node", "server.js"]
