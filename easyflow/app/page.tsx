"use client";
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import { motion } from "framer-motion";

export default function Home() {
  return (  
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Background Image with subtle zoom */}
      <motion.div
        className="absolute top-0 left-0 w-full h-full z-0"
        initial={{ scale: 1 }}
        animate={{ scale: 1.05 }}
        transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
      >
        <Image
          src="/images/grid.jpg"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
      </motion.div>

      {/* Overlay สีดำโปร่ง */}
      <div className="absolute inset-0 z-0 bg-black opacity-50"></div>

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

          {/* Animated Button */}
          <motion.button
            className="text-2xl mt-6 px-6 py-3 bg-yellow-500 text-white font-bold rounded-full cursor-pointer shadow-lg"
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
          </motion.button>

          <motion.p
            className="ml-2 mt-2 text-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.5 }}
          >
            Get Started for Free
          </motion.p>
        </header>
      </motion.div>
    </div>
  );
}
