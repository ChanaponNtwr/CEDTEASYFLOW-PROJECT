"use client";

import React from "react";
import Image from "next/image";

interface LabData {
  inSymVal?: number;
  outSymVal?: number;
  declareSymVal?: number;
  assignSymVal?: number;
  ifSymVal?: number;
  forSymVal?: number;
  whileSymVal?: number;
  [key: string]: number | undefined; // Index signature for dynamic access
}

interface SymbolItemConfig {
  label: string;
  imageSrc: string;
  dataKey: keyof LabData;
}

interface SymbolSectionProps {
  labData?: LabData;
}

// แยก Component ย่อยออกมาเพื่อ Performance ที่ดี และลด code ซ้ำซ้อน
const SymbolCard: React.FC<{ config: SymbolItemConfig; count: number; isUnlimited: boolean }> = ({
  config,
  count,
  isUnlimited,
}) => {
  return (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-4">
        {/* Image Container */}
        <div className="w-24 h-14 flex items-center justify-center bg-gray-50 rounded-lg p-1 border border-gray-100 overflow-hidden relative group">
          <Image
            src={config.imageSrc}
            alt={config.label}
            fill
            sizes="56px"
            className="object-contain p-1 group-hover:scale-110 transition-transform duration-300"
          />
        </div>
        <span className="font-bold text-gray-700 text-sm">{config.label}</span>
      </div>

      <div>
        {isUnlimited ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
            Unlimited
          </span>
        ) : (
          <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
            {count}
          </span>
        )}
      </div>
    </div>
  );
};

const SymbolSection: React.FC<SymbolSectionProps> = ({ labData }) => {
  // Helper ดึงข้อมูลและตรวจสอบ Unlimited
  const getSymbolData = (key: keyof LabData) => {
    const val = labData?.[key];
    const isUnlimited = val === -1;
    // ถ้าเป็น -1 หรือ undefined ให้แสดง logic ตามต้องการ (ที่นี่ count จะโชว์ 0 ถ้า undefined, แต่ badge จะโชว์ Unlimited ถ้า -1)
    const count = val === -1 || val === undefined ? 0 : val;
    return { count, isUnlimited };
  };

  const renderCard = (label: string, imageSrc: string, dataKey: keyof LabData) => {
    const { count, isUnlimited } = getSymbolData(dataKey);
    return <SymbolCard config={{ label, imageSrc, dataKey }} count={count} isUnlimited={isUnlimited} />;
  };

  return (
    <div className="w-full mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Input / Output */}
        <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 h-full">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Input / Output</h3>
          </div>
          <div className="space-y-3">
            {renderCard("Input", "/images/input.png", "inSymVal")}
            {renderCard("Output", "/images/output.png", "outSymVal")}
          </div>
        </div>

        {/* Column 2: Variables */}
        <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 h-full">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-yellow-500 rounded-full"></div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Variables</h3>
          </div>
          <div className="space-y-3">
            {renderCard("Declare", "/images/declare.png", "declareSymVal")}
            {renderCard("Assign", "/images/assign.png", "assignSymVal")}
          </div>
        </div>

        {/* Column 3: Control Flow */}
        <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 h-full">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-pink-500 rounded-full"></div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Control Flow</h3>
          </div>
          <div className="space-y-3">
            {renderCard("IF", "/images/if.png", "ifSymVal")}
            {renderCard("While", "/images/while.png", "whileSymVal")}
            {renderCard("For", "/images/for.png", "forSymVal")}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SymbolSection;