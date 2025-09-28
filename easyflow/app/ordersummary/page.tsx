// pages/Ordersummary.tsx
"use client";
import React from "react";
import Link from "next/link";
import Navbar from '@/components/Navbar';
import Image from "next/image";

// ไอคอนสำหรับปุ่มอัปโหลด (SVG)
const UploadIcon = () => (
  <svg className="w-10 h-10 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

export default function Ordersummary() {
  return (
    // Container หลัก: กำหนดพื้นหลังและจัดให้อยู่กึ่งกลาง
    <div className="min-h-screen bg-gray-800 bg-[url('/Images/Pricing.png')] bg-cover bg-center text-white flex flex-col items-center justify-center p-4">
      <Navbar />
      
      {/* Grid Layout: สร้าง 2 คอลัมน์สำหรับจอขนาดกลางขึ้นไป */}
      <main className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-7xl p-4 md:p-8">
        
        {/* === คอลัมน์ซ้าย: Order summary === */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 flex flex-col items-center justify-center text-center">
          <h2 className="text-3xl font-semibold mb-6">Order summary</h2>
          
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg">
            {/* **สำคัญ:** ให้คุณนำไฟล์รูป QR Code ของคุณไปไว้ที่ public/images/qrcode.png 
              หรือเปลี่ยน path ตามที่คุณต้องการ
            */}
            <Image 
              src="/images/qrcode.png" // <--- แก้ไข path รูป QR Code ที่นี่
              alt="QR Code for payment"
              width={200}
              height={200}
              className="object-contain"
            />
          </div>
          <p className="mt-2 text-sm font-medium tracking-widest text-gray-300">SCAN IT</p>

          <p className="mt-6 text-2xl font-bold">Price ฿1299</p>
          <p className="text-gray-400">Pay before --:--</p>
        </div>

        {/* === คอลัมน์ขวา: Confirm Payment === */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 flex flex-col space-y-6">
          <h2 className="text-3xl font-semibold">Confirm Payment</h2>

          {/* Upload Slip */}
          <div>
            <label htmlFor="slip-upload" className="block text-gray-300 mb-2">Slip</label>
            <div className="border-2 border-dashed border-gray-500 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition">
              <input id="slip-upload" type="file" className="hidden" />
              <UploadIcon />
              <p className="mt-2 text-gray-400">Upload Image</p>
            </div>
          </div>
          
          {/* Email */}
          <div>
            <p className="block text-gray-300 mb-1">email</p>
            <p className="text-white">66015035@kmitl.ac.th</p>
          </div>

          {/* Notes */}
          <div>
            <p className="block text-gray-300 mb-1">Notes (Optional)</p>
            <div className="flex justify-between items-center text-white">
              <span>Pro</span>
              <span className="text-sm">฿1299 / year</span>
            </div>
            <p className="text-sm text-gray-400">Add unlimited class members</p>
          </div>

          {/* Confirm Button */}
          <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 mt-4">
            Confirm Payment
          </button>
        </div>

      </main>
    </div>
  );
}