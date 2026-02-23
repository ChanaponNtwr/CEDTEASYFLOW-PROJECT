// app/page.tsx
"use client";
import React from "react";
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import ParticleCanvas3D from "@/components/ParticleCanvas3D";

export default function Home() {
  // useSession สำหรับเช็คสถานะ login
  const { data: session } = useSession();

  return (
    <div className="h-screen w-screen overflow-hidden relative" style={{ background: 'black' }}>
      {/* Background Image with subtle zoom */}
      <motion.div
        className="absolute top-0 left-0 w-full h-full z-0"
        initial={{ scale: 1 }}
        animate={{ scale: 1.06 }}
        transition={{ duration: 22, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
      >
        <Image
          src="/images/grid.jpg"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
      </motion.div>

      {/* Overlay dark translucent */}
      <div className="absolute inset-0 z-0 bg-black opacity-60"></div>

      {/* 3D Particle canvas */}
      <ParticleCanvas3D enabled={true} amount={120} />

      {/* Content */}
      <motion.div
        className="relative z-10 h-full w-full text-white flex flex-col items-start justify-center pl-10"
      >
        <Navbar />
        <header className="text-left max-w-xl">
          <motion.h1
            className="text-6xl font-bold"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            Create Flowcharts<br />In Minutes!
          </motion.h1>
          <motion.p
            className="mt-4 text-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 1 }}
          >
            Easily Visualize Processes, Workflows, And Ideas With<br />
            Our Intuitive Drag-And-Drop Editor
          </motion.p>

          {/* ปุ่มจะแสดง Get Started เมื่อล็อกเอาท์ — ถ้าล็อกอินแล้วจะแสดง Upgrade */}
          {session ? (
            <Link href="/upgrade">
              {/* ถ้าต้องการแสดงปุ่มแบบอื่นเมื่อ session มี ให้ใส่โค้ดตรงนี้ */}
            </Link>
          ) : (
            <Link href="/trial">
              <motion.div 
                className="inline-block text-2xl mt-6 px-6 py-3 bg-yellow-500 text-white font-bold rounded-full cursor-pointer shadow-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                whileHover={{
                  scale: 1.1,
                  boxShadow: "0px 0px 20px rgba(255,255,0,0.6)",
                  y: -3,
                  transition: { type: "spring", stiffness: 300 },
                }}
                whileTap={{ scale: 0.95 }}
              >
                Get Started
              </motion.div>
            </Link>
          )}
        </header>
      </motion.div>
    </div>
  );
}