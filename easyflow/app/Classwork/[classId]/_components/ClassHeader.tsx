"use client";

import Image from "next/image";

interface ClassHeaderProps {
  code?: string;
  teacher?: string;
  schedule?: string;
  backgroundImage?: string;
}

function ClassHeader({
  code = "N/A",
  teacher = "Unknown",
  schedule = "No schedule",
  backgroundImage = "/default-bg.jpg",
}: ClassHeaderProps) {
  return (
    <div className="relative w-full h-56 md:h-72 rounded-2xl overflow-hidden shadow-sm group border border-gray-200">
      {/* Background image */}
      <Image
        src={backgroundImage}
        alt="Class background"
        fill
        className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
        priority
      />

      {/* Gradient Overlay: ให้อ่าน Text ได้ชัดเจนขึ้น */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 text-white z-10">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-2">{code}</h1>
        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-gray-100 text-sm md:text-lg font-medium">
            <span>{teacher}</span>
            <span className="hidden md:inline w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
            <span className="opacity-90">{schedule}</span>
        </div>
      </div>
    </div>
  );
}

export default ClassHeader;