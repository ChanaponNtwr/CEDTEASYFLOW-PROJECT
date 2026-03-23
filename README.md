# CE68-37 แพลตฟอร์มเพื่อศึกษาการเขียนโปรแกรมด้วยการเขียนผังงาน  
## Installation Guide

เอกสารฉบับนี้อธิบายขั้นตอนการติดตั้งและกำหนดค่าระบบของโครงการ **CEDTEASYFLOW-PROJECT** ซึ่งประกอบด้วย 2 ส่วนหลักคือ **Backend** และ **Frontend (easyflow)** เพื่อให้สามารถเริ่มใช้งานระบบได้อย่างถูกต้อง

---

## 1) ความต้องการของระบบ

ระบบที่เหมาะสมสำหรับการติดตั้งแบ่งออกเป็นความต้องการด้านฮาร์ดแวร์และซอฟต์แวร์ดังนี้

| รายการ | ขั้นต่ำ | แนะนำ |
|---|---:|---:|
| CPU | 2 คอร์ขึ้นไป | 4 คอร์ขึ้นไป |
| หน่วยความจำ (RAM) | 4 GB | 8 GB ขึ้นไป |
| พื้นที่เก็บข้อมูล | อย่างน้อย 10 GB ว่าง | 20 GB ขึ้นไป |
| ระบบปฏิบัติการ | Windows 10 / 11, Ubuntu 20.04+, macOS | Windows 11 / Ubuntu 22.04+ |
| เครือข่าย | เชื่อมต่ออินเทอร์เน็ตได้ | อินเทอร์เน็ตเสถียร |
| ฐานข้อมูล | PostgreSQL 16 หรือเทียบเท่า | PostgreSQL 16 แยกเครื่องหรือใช้ Docker |
| รันไทม์ | Node.js 20+ | Node.js 20 LTS |

> **หมายเหตุ:**  
> โครงสร้างของโครงการประกอบด้วย 2 ส่วนหลัก ได้แก่ Frontend ที่พัฒนาด้วย Next.js และ Backend ที่พัฒนาด้วย Node.js ดังนั้นควรติดตั้ง **Node.js 20 ขึ้นไป** สำหรับทั้งสองส่วน พร้อมฐานข้อมูล **PostgreSQL 16** เพื่อให้ระบบทำงานได้อย่างถูกต้องและลดปัญหาความเข้ากันได้

---

## 2) ขั้นตอนการติดตั้งโปรแกรม

### 2.1 การติดตั้งระบบแบบ Clone/Pull จาก Git

วิธีนี้เหมาะสำหรับผู้พัฒนาหรือผู้ดูแลระบบที่ต้องการติดตั้งจากซอร์สโค้ดโดยตรง

#### ขั้นตอน

1. ติดตั้งโปรแกรมพื้นฐานที่จำเป็น ได้แก่ **Git, Node.js 20+, npm และ PostgreSQL 16**  
   หรือเตรียม **Docker** และ **Docker Compose** ไว้ใช้งาน

2. เปิด Terminal หรือ Command Prompt แล้วคัดลอกโปรเจกต์จาก GitHub

```bash
git clone https://github.com/ChanaponNtwr/CEDTEASYFLOW-PROJECT.git
cd CEDTEASYFLOW-PROJECT
```

3. เข้าไปที่โฟลเดอร์ `backend` แล้วติดตั้ง dependency

```bash
cd backend
npm install
```

4. เข้าไปที่โฟลเดอร์ `easyflow` แล้วติดตั้ง dependency ของส่วนหน้าเว็บ

```bash
cd easyflow
npm install
```

5. สร้างไฟล์ `.env` ในแต่ละส่วนให้ครบถ้วน แล้วกรอกค่าการเชื่อมต่อฐานข้อมูลและคีย์ที่จำเป็น

ก่อนเริ่มใช้งาน ควรตรวจสอบและกำหนดค่า environment variables ให้ครบถ้วนตามตารางด้านล่าง

| ส่วนที่ใช้ | ตัวแปรที่ควรกำหนด | คำอธิบาย |
|---|---|---|
| Backend | `DATABASE_URL` | ใช้สำหรับเชื่อมต่อ PostgreSQL |
| Backend | `NEXTAUTH_SECRET` | ใช้สำหรับยืนยันตัวตนเข้าสู่ระบบ |
| Backend | `GOOGLE_CLIENT_ID` | ใช้สำหรับ Google OAuth |
| Backend | `GOOGLE_CLIENT_SECRET` | ใช้สำหรับ Google OAuth |
| Backend | `NEXTAUTH_URL` | URL หลักของระบบยืนยันตัวตน |
| Backend | `SMTP_HOST` | ใช้สำหรับส่งอีเมล |
| Backend | `SMTP_PORT` | พอร์ตของ SMTP Server |
| Backend | `SMTP_USER` | ชื่อผู้ใช้สำหรับ SMTP |
| Backend | `SMTP_PASS` | รหัสผ่านสำหรับ SMTP |
| Backend | `SMTP_FROM` | อีเมลผู้ส่ง |
| Frontend | `DATABASE_URL` | ใช้สำหรับเชื่อมต่อ PostgreSQL |
| Frontend | `NEXTAUTH_SECRET` | ใช้สำหรับยืนยันตัวตนเข้าสู่ระบบ |
| Frontend | `GOOGLE_CLIENT_ID` | ใช้สำหรับ Google OAuth |
| Frontend | `GOOGLE_CLIENT_SECRET` | ใช้สำหรับ Google OAuth |
| Frontend | `NEXTAUTH_URL` | URL หลักของระบบยืนยันตัวตน |
| Frontend | `BASE_API` | ใช้ระบุ URL ของ Backend ที่ Frontend ต้องเรียกใช้งาน |
| Prisma | `schema.prisma / migration` | ตรวจสอบ Table ให้ตรงกับฐานข้อมูลจริงก่อน generate หรือ migrate |

#### ตัวอย่างการใช้งานผ่าน Docker

หากใช้งานผ่าน Docker ให้ตรวจสอบว่าไฟล์ `Dockerfile` ของทั้งสองส่วนถูกอัปเดตและมีคำสั่ง build ที่ถูกต้อง โดย

- Frontend เปิดพอร์ต **3000**
- Backend เปิดพอร์ต **8080**

ตามค่าที่กำหนดไว้ในภาพรวมของโครงการ

6. รันคำสั่ง generate ของ Prisma เพื่อสร้าง Prisma Client ก่อนเริ่มใช้งาน

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

7. ติดตั้งและตั้งค่าฐานข้อมูล PostgreSQL ให้พร้อมใช้งาน จากนั้นสร้างฐานข้อมูลและผู้ใช้ตามที่ระบบกำหนด

| roleId | roleName |
|---:|---|
| 1 | teacher |
| 2 | student |
| 3 | ta |
| 4 | owner |

> ตาราง `Role` ต้องกำหนดให้สอดคล้องกับโครงสร้างที่แสดงในรูปตัวอย่าง

8. เริ่มการทำงานของ Backend และ Frontend แยกกันคนละหน้าต่างเทอร์มินัล

**Backend**

```bash
cd backend
npm run dev
```

**Frontend**

```bash
cd easyflow
npm run dev
```

---

### 2.2 การติดตั้งด้วยการอัปโหลดซอร์สโค้ด

กรณีที่ไม่ได้ใช้คำสั่ง Git สามารถอัปโหลดโค้ดไปยังเครื่องเซิร์ฟเวอร์หรือเครื่องพัฒนาโดยตรงได้

- ดาวน์โหลดไฟล์ซอร์สโค้ดจาก GitHub เป็นไฟล์ ZIP
- แตกไฟล์ ZIP ไปยังโฟลเดอร์ที่ต้องการติดตั้ง
- ตรวจสอบให้โครงสร้างโฟลเดอร์ยังคงมี `backend` และ `easyflow` ครบถ้วน
- ทำตามขั้นตอนติดตั้ง dependency และตั้งค่า `.env` เช่นเดียวกับวิธี Clone/Pull
- ทดสอบการรันระบบเพื่อยืนยันว่าทั้ง Frontend และ Backend เชื่อมต่อกันได้

---

## 3) การกำหนดค่าระบบ

ก่อนเริ่มใช้งาน ควรตรวจสอบและกำหนดค่า environment variables ให้ครบถ้วน

| ส่วนที่ใช้ | ตัวแปรที่ควรกำหนด | คำอธิบาย |
|---|---|---|
| Backend | `DATABASE_URL` | ใช้สำหรับเชื่อมต่อ PostgreSQL |
| Backend | `NEXTAUTH_SECRET` | ใช้สำหรับยืนยันตัวตนเข้าสู่ระบบ |
| Backend | `GOOGLE_CLIENT_ID` | ใช้สำหรับ Google OAuth |
| Backend | `GOOGLE_CLIENT_SECRET` | ใช้สำหรับ Google OAuth |
| Backend | `NEXTAUTH_URL` | URL หลักของระบบยืนยันตัวตน |
| Backend | `SMTP_HOST` | ใช้สำหรับส่งอีเมล |
| Backend | `SMTP_PORT` | พอร์ตของ SMTP Server |
| Backend | `SMTP_USER` | ชื่อผู้ใช้สำหรับ SMTP |
| Backend | `SMTP_PASS` | รหัสผ่านสำหรับ SMTP |
| Backend | `SMTP_FROM` | อีเมลผู้ส่ง |
| Frontend | `DATABASE_URL` | ใช้สำหรับเชื่อมต่อ PostgreSQL |
| Frontend | `NEXTAUTH_SECRET` | ใช้สำหรับยืนยันตัวตนเข้าสู่ระบบ |
| Frontend | `GOOGLE_CLIENT_ID` | ใช้สำหรับ Google OAuth |
| Frontend | `GOOGLE_CLIENT_SECRET` | ใช้สำหรับ Google OAuth |
| Frontend | `NEXTAUTH_URL` | URL หลักของระบบยืนยันตัวตน |
| Frontend | `BASE_API` | ใช้ระบุ URL ของ Backend ที่ Frontend ต้องเรียกใช้งาน |
| Prisma | `schema.prisma / migration` | ตรวจสอบ Table ให้ตรงกับฐานข้อมูลจริงก่อน generate หรือ migrate |

---

### 3.1 คำอธิบายตัวแปรสำคัญ

- **DATABASE_URL**  
  ใช้ระบุที่อยู่ของฐานข้อมูล PostgreSQL

- **NEXTAUTH_SECRET**  
  ใช้สำหรับเข้ารหัสและยืนยันตัวตนของระบบ NextAuth

- **GOOGLE_CLIENT_ID** และ **GOOGLE_CLIENT_SECRET**  
  ใช้สำหรับการเข้าสู่ระบบด้วย Google OAuth

- **NEXTAUTH_URL**  
  ใช้กำหนด URL หลักของระบบยืนยันตัวตน เพื่อให้ callback และ session ทำงานได้ถูกต้อง

- **SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM**  
  ใช้สำหรับตั้งค่าการส่งอีเมลจากระบบ เช่น อีเมลยืนยันตัวตนหรือแจ้งเตือน ผ่าน SMTP Server

- **BASE_API**  
  ใช้ระบุ URL ของ Backend ที่ Frontend ต้องเรียกใช้งาน API

- **Prisma (`schema.prisma / migration`)**  
  ใช้สำหรับกำหนดโครงสร้างฐานข้อมูล และต้องตรวจสอบให้ Table ใน schema ตรงกับฐานข้อมูลจริงก่อนทำการ generate หรือ migrate

---

## 4) การตรวจสอบหลังติดตั้ง

หลังติดตั้งเสร็จ ควรตรวจสอบการทำงานของระบบตามรายการต่อไปนี้

- เปิด Frontend ผ่านเว็บเบราว์เซอร์และตรวจสอบว่าหน้าแรกโหลดได้
- ทดสอบการเชื่อมต่อ Backend ว่าสามารถเรียก API ได้ตามปกติ
- ตรวจสอบว่าฐานข้อมูล PostgreSQL สามารถอ่าน/เขียนข้อมูลได้
- กรณีส่งอีเมลหรือใช้งานระบบยืนยันตัวตน ให้ทดสอบการทำงานของ SMTP และ NextAuth

---

### 4.1 ปัญหาที่พบบ่อยและแนวทางแก้ไข

- **ติดตั้ง dependency ไม่สำเร็จ**  
  ตรวจสอบเวอร์ชันของ Node.js และ npm ว่าเป็นเวอร์ชันที่รองรับ

- **เชื่อมต่อฐานข้อมูลไม่ได้**  
  ตรวจสอบค่า `DATABASE_URL`, ชื่อผู้ใช้, รหัสผ่าน และพอร์ตของ PostgreSQL

- **รัน Prisma ไม่ผ่าน**  
  ตรวจสอบว่าได้สั่ง `npx prisma generate` หลังติดตั้ง dependency แล้ว

- **Frontend ติดต่อ Backend ไม่ได้**  
  ตรวจสอบ URL ของ API และพอร์ตที่เปิดใช้งาน

- **ส่งอีเมลไม่ได้**  
  ตรวจสอบค่า SMTP และรหัสผ่านแอปพลิเคชันของบัญชีอีเมล

---

## 5) สรุป

เมื่อติดตั้งครบตามขั้นตอนแล้ว ระบบ **CE68-37** จะพร้อมใช้งานทั้งส่วนจัดการผังงาน ฝั่งผู้เรียน และส่วนจัดการหลังบ้าน โดยควรเก็บไฟล์ `.env` และข้อมูลฐานข้อมูลไว้เป็นความลับ รวมถึงสำรองข้อมูลก่อนอัปเดตหรือปรับแก้โครงสร้างระบบทุกครั้ง

---

## โครงสร้างที่แนะนำสำหรับโปรเจกต์

```text
CEDTEASYFLOW-PROJECT/
├─ backend/
│  ├─ prisma/
│  ├─ src/
│  ├─ .env
│  └─ package.json
└─ easyflow/
   ├─ app/
   ├─ components/
   ├─ .env
   └─ package.json
```
