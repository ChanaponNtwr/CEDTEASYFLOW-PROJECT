// File: app/classwork/_components/ClassHeader.tsx
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
    <div
      className="
        relative
        h-60              /* 🔒 ล็อกความสูง */
        shrink-0          /* ❗ กัน flex ยืด */
        rounded-lg
        border-2
        p-6
        text-white
        mb-6
        overflow-hidden
      "
    >
      {/* Background image */}
      <Image
        src={backgroundImage}
        alt="Class background"
        fill
        className="object-cover object-center"
        sizes="100vw"
        priority
      />

      {/* Overlay (โปร่งใสเหมือนเดิม ไม่แตะ UI) */}
      <div className="absolute inset-0 rounded-lg z-0" />

      {/* Content */}
      <div className="relative z-10">
        <h1 className="text-3xl font-semibold">{code}</h1>
        <p className="text-lg">{teacher}</p>
        <p className="text-sm mt-2">{schedule}</p>
      </div>
    </div>
  );
}

export default ClassHeader;
