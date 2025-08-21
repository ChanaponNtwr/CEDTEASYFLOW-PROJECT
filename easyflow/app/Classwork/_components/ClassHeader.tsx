"use client"; // Mark as client component for Next.js App Router

import Image from "next/image";

// Define prop types using TypeScript
interface ClassHeaderProps {
  code?: string;
  teacher?: string;
  schedule?: string;
  backgroundImage?: string;
}

function ClassHeader({ code = "N/A", teacher = "Unknown", schedule = "No schedule", backgroundImage = "/default-bg.jpg" }: ClassHeaderProps) {
  return (
    <div className="relative h-60 rounded-lg border-2 p-6 text-white mb-6 overflow-hidden">
      {/* Background image using next/image */}
      {backgroundImage && (
        <Image
          src={backgroundImage}
          alt="Class background"
          fill
          className="object-cover object-center"
          priority={true} // Optional: Prioritize loading for above-the-fold images
          sizes="100vw"
        />
      )}
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-30 rounded-lg z-0"></div>
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