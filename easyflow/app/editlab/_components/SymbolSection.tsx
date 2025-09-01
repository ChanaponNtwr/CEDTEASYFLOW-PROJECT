"use client"; // ระบุว่าเป็น client component

import React, { useState } from "react";
import Image from "next/image";

// กำหนดประเภทสำหรับ SymbolItem
interface SymbolItem {
  label: string;
  bgColor: string;
  textColor: string;
  count: number;
  isUnlimited: boolean;
  imageSrc: string; // เพิ่ม field สำหรับ path ของภาพ
}

// Props สำหรับ SymbolSection
interface SymbolSectionProps {
  onChange?: (symbols: {
    input: number;
    output: number;
    declare: number;
    assign: number;
    if: number;
    call: number;
    while: number;
    for: number;
    do: number;
  }) => void; // Callback เพื่อส่งข้อมูลการเปลี่ยนแปลงไปยัง parent
}

const SymbolSection: React.FC<SymbolSectionProps> = ({ onChange }) => {
  // State สำหรับจัดการจำนวนและสถานะ Unlimited ของแต่ละ symbol
  const [symbols, setSymbols] = useState<{
    input: SymbolItem;
    output: SymbolItem;
    declare: SymbolItem;
    assign: SymbolItem;
    if: SymbolItem;
    call: SymbolItem;
    while: SymbolItem;
    for: SymbolItem;
    do: SymbolItem;
  }>({
    input: { label: "Input", bgColor: "bg-blue-200", textColor: "text-blue-800", count: 0, isUnlimited: true, imageSrc: "/images/input.png" },
    output: { label: "Output", bgColor: "bg-green-200", textColor: "text-green-800", count: 0, isUnlimited: true, imageSrc: "/images/output.png" },
    declare: { label: "Declare", bgColor: "bg-yellow-200", textColor: "text-yellow-800", count: 0, isUnlimited: true, imageSrc: "/images/declare.png" },
    assign: { label: "Assign", bgColor: "bg-yellow-200", textColor: "text-yellow-800", count: 0, isUnlimited: true, imageSrc: "/images/assign.png" },
    if: { label: "IF", bgColor: "bg-pink-200", textColor: "text-pink-800", count: 5, isUnlimited: false, imageSrc: "/images/if.png" },
    call: { label: "Call", bgColor: "bg-purple-200", textColor: "text-purple-800", count: 2, isUnlimited: false, imageSrc: "/images/call.png" },
    while: { label: "While", bgColor: "bg-indigo-200", textColor: "text-indigo-800", count: 3, isUnlimited: false, imageSrc: "/images/while.png" },
    for: { label: "For", bgColor: "bg-teal-200", textColor: "text-teal-800", count: 3, isUnlimited: false, imageSrc: "/images/for.png" },
    do: { label: "Do", bgColor: "bg-orange-200", textColor: "text-orange-800", count: 2, isUnlimited: false, imageSrc: "/images/do.png" },
  });

  // Handler สำหรับการเปลี่ยนแปลง count
  const handleCountChange = (key: keyof typeof symbols, increment: boolean) => {
    setSymbols((prev) => {
      const newSymbols = { ...prev };
      const newCount = increment
        ? newSymbols[key].count + 1
        : Math.max(0, newSymbols[key].count - 1);
      newSymbols[key] = { ...newSymbols[key], count: newCount };

      // ส่งข้อมูลกลับไปยัง parent ถ้ามี onChange
      onChange?.({
        input: newSymbols.input.count,
        output: newSymbols.output.count,
        declare: newSymbols.declare.count,
        assign: newSymbols.assign.count,
        if: newSymbols.if.count,
        call: newSymbols.call.count,
        while: newSymbols.while.count,
        for: newSymbols.for.count,
        do: newSymbols.do.count,
      });

      return newSymbols;
    });
  };

  // Handler สำหรับการเปลี่ยนแปลงสถานะ Unlimited
  const handleUnlimitedChange = (key: keyof typeof symbols, checked: boolean) => {
    setSymbols((prev) => {
      const newSymbols = { ...prev };
      newSymbols[key] = { ...newSymbols[key], isUnlimited: checked };

      // ส่งข้อมูลกลับไปยัง parent ถ้ามี onChange
      onChange?.({
        input: newSymbols.input.count,
        output: newSymbols.output.count,
        declare: newSymbols.declare.count,
        assign: newSymbols.assign.count,
        if: newSymbols.if.count,
        call: newSymbols.call.count,
        while: newSymbols.while.count,
        for: newSymbols.for.count,
        do: newSymbols.do.count,
      });

      return newSymbols;
    });
  };

  // Component สำหรับแสดงแต่ละ Symbol Item
  const SymbolItemComponent: React.FC<{
    item: SymbolItem;
    symbolKey: keyof typeof symbols;
  }> = ({ item, symbolKey }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Image
          src={item.imageSrc}
          alt={item.label}
          width={120}
          height={60}
          className={`${item.bgColor} ${item.textColor}`}
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          className="w-8 h-8 bg-gray-200 text-lg rounded flex items-center justify-center text-gray-600 hover:bg-gray-300 active:bg-gray-400 transition-colors cursor-pointer"
          aria-label={`Decrease ${item.label} count`}
          onClick={() => handleCountChange(symbolKey, false)}
        >
          -
        </button>
        <span className="w-12 text-center text-lg">{item.count}</span>
        <button
          className="w-8 h-8 bg-gray-200 text-lg rounded flex items-center justify-center text-gray-600 hover:bg-gray-300 active:bg-gray-400 transition-colors cursor-pointer"
          aria-label={`Increase ${item.label} count`}
          onClick={() => handleCountChange(symbolKey, true)}
        >
          +
        </button>
        <input
          type="checkbox"
          className="ml-2 w-5 h-5"
          checked={item.isUnlimited}
          onChange={(e) => handleUnlimitedChange(symbolKey, e.target.checked)}
        />
        <label className="text-sm text-gray-600">Unlimited</label>
      </div>
    </div>
  );

  return (
    <div className="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-medium text-gray-700 mb-4">SYMBOL</h3>

      {/* Input/Output */}
      <div className="space-y-4">
        <SymbolItemComponent item={symbols.input} symbolKey="input" />
        <SymbolItemComponent item={symbols.output} symbolKey="output" />
      </div>

      {/* Variables */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">VARIABLES</h4>
        <div className="space-y-4">
          <SymbolItemComponent item={symbols.declare} symbolKey="declare" />
          <SymbolItemComponent item={symbols.assign} symbolKey="assign" />
        </div>
      </div>

      {/* Control */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">CONTROL</h4>
        <div className="space-y-4">
          <SymbolItemComponent item={symbols.if} symbolKey="if" />
          <SymbolItemComponent item={symbols.call} symbolKey="call" />
          <SymbolItemComponent item={symbols.while} symbolKey="while" />
          <SymbolItemComponent item={symbols.for} symbolKey="for" />
          <SymbolItemComponent item={symbols.do} symbolKey="do" />
        </div>
      </div>
    </div>
  );
};

export default SymbolSection;