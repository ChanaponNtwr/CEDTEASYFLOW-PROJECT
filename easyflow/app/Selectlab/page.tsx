"use client";
import React, { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom"; // เพิ่ม useNavigate
import Link from "next/link";
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ClassCard from './_components/ClassCard';

function Selectlab() {


  const classes = [
    { code: 'OOP-53', teacher: 'Chanapon Nitiwirot', due: 'Due Today', problem: 'ปัญหา: การออกแบบซอฟต์แวร์' },
    { code: 'OOD-53', teacher: 'Chanapon Nitiwirot', due: 'Due May 7, 11:59 PM', problem: 'ปัญหา: การออกแบบซอฟต์แวร์ขั้นสูง' },
    { code: 'OOD-53', teacher: 'Chanapon Nitiwirot', due: 'Due May 7, 11:59 PM', problem: 'ปัญหา: การออกแบบซอฟต์แวร์ขั้นสูง' },
    
  ];
  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <Navbar />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col p-20">
          <div className="flex justify-end">
            <Link href="/Classwork"
              className="bg-[#0D3ACE] text-white px-10 py-2 rounded-4xl flex items-center hover:bg-[#0B2EA6] hover:shadow-lg transition-all duration-200"
            >
              Select
            </Link>
          </div>
          <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-4">My Labs</h2>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((classItem, index) => (
              <ClassCard key={index} {...classItem} />
            ))}
          </div>
        </div>
      </div>
    </div>

  );
}

export default Selectlab;