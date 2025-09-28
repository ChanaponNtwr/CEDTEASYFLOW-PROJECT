// pages/pricing.js

"use client";
import React from "react";
import Link from "next/link";
import Navbar from '@/components/Navbar';
import Image from "next/image";

// 1. สร้างข้อมูลสำหรับแพ็กเกจต่างๆ ในรูปแบบ Array of Objects
const pricingPlans = [
  {
    name: 'Starter',
    price: 500,
    features: 'Add 70 class members',
    highlight: false,
  },
  {
    name: 'Advancedlan',
    price: 900,
    features: 'Add 100 class members',
    highlight: false, // คุณสามารถเปลี่ยนเป็น true ถ้าต้องการเน้นแพ็กเกจนี้
  },
  {
    name: 'Pro',
    price: 1299,
    features: 'Add unlimited class members',
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <div className="pt-10 h-screen w-screen overflow-hidden relative">
        <Navbar />

        {/* ใช้สีพื้นหลังและรูปภาพเหมือนในตัวอย่าง */}
        <div className="min-h-screen bg-gray-800 bg-[url('/Images/Pricing.png')] bg-cover bg-center text-white flex flex-col items-center justify-center p-4">
          
          <header className="text-center mb-12">
              {/* โลโก้และชื่อ */}
              <div className="flex justify-center mb-2">
                  {/* หากมีไฟล์โลโก้ สามารถใช้ <Image /> ของ Next.js ได้ */}
                  {/* <Image src="/logo.svg" alt="Easy Flow Logo" width={80} height={80} /> */}
            <Image src="/images/EsayFlowlogo1.png" alt="Easy Flow Logo" width={300} height={300} />
              </div>
          </header>

          {/* 2. ใช้ .map() เพื่อแสดงผลการ์ดราคา */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                // ใช้ backdrop-blur เพื่อสร้างเอฟเฟกต์กระจกฝ้า
                className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center flex flex-col"
              >
                <h2 className="text-3xl font-semibold mb-2">{plan.name}</h2>
                <hr className="border-white/20 my-4" />
                <p className="text-4xl font-bold my-4">
                  ฿{plan.price} <span className="text-xl font-normal text-gray-300">/ year</span>
                </p>
                <p className="text-gray-200 mb-8 flex-grow">{plan.features}</p>
                
                <button className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300">
                  Subscribe
                </button>
              </div>
            ))}
          </div>
        </div>
    </div>
  );
}