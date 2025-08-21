"use client";
import Navbar from '@/components/Navbar';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="h-screen w-screen overflow-hidden text-white relative">
      {/* Background image */}
      <Image 
        src="/images/fc.png" 
        alt="Background" 
        fill 
        priority
        className="object-cover z-0"
      />

      <Navbar />
      <header className="flex flex-col items-start justify-center h-full text-left pl-10 relative z-10 bg-black bg-opacity-50">
        <h1 className="text-5xl font-bold">Create Flowcharts<br />In Minutes!</h1>
        <p className="mt-4 text-lg">
          Easily Visualize Processes, Workflows, And Ideas With<br />
          Our Intuitive Drag-And-Drop Editor
        </p>
        <button className="mt-6 px-6 py-3 bg-yellow-500 text-white font-bold rounded-full hover:bg-yellow-600">
          Get Started
        </button>
        <p className="mt-2 text-sm">Get Started for Free</p>
      </header>
    </div>
  );
}
