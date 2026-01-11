"use client";

import React, { useState } from "react";
import Image from "next/image";

interface SymbolItem {
  label: string;
  bgColor: string;
  textColor: string;
  count: number;
  isUnlimited: boolean;
  imageSrc: string;
}

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
  }) => void;
}

const SymbolSection: React.FC<SymbolSectionProps> = ({ onChange }) => {
  const [symbols, setSymbols] = useState({
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

  const handleCountChange = (key: keyof typeof symbols, increment: boolean) => {
    setSymbols(prev => {
      const newSymbols = { ...prev };
      newSymbols[key].count = increment ? newSymbols[key].count + 1 : Math.max(0, newSymbols[key].count - 1);

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

  const handleUnlimitedChange = (key: keyof typeof symbols, checked: boolean) => {
    setSymbols(prev => {
      const newSymbols = { ...prev };
      newSymbols[key].isUnlimited = checked;

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

  const SymbolItemComponent: React.FC<{ item: SymbolItem; symbolKey: keyof typeof symbols }> = ({ item, symbolKey }) => (
    <div className="flex items-center justify-between w-92 p-2 border-b border-gray-200 ">
      {/* ซ้าย: รูป + label */}
      <div className="flex flex-col items-start">
        <Image src={item.imageSrc} alt={item.label} width={150} height={90} className={`${item.bgColor} ${item.textColor} rounded`} />
      </div>

      {/* ขวา: ปุ่ม + / -, จำนวน, checkbox Unlimited เรียงเป็นแถวเดียว */}
      <div className="flex items-center gap-3 ml-4">
        <button className="w-6 h-6 bg-gray-200 rounded text-gray-600" onClick={() => handleCountChange(symbolKey, false)}>-</button>
        <span className="text-sm w-6 text-center">{item.count}</span>
        <button className="w-6 h-6 bg-gray-200 rounded text-gray-600" onClick={() => handleCountChange(symbolKey, true)}>+</button>
        <label className="flex items-center text-xs gap-1">
          <input type="checkbox" className="w-3 h-3" checked={item.isUnlimited} onChange={(e) => handleUnlimitedChange(symbolKey, e.target.checked)} />
          Unlimited
        </label>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-white p-4 rounded-lg shadow-md">
      
        {/* Input/Output + Variables */}
        <div className="flex gap-16 overflow-x-auto mb-4">
          {/* Input / Output */}
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-medium text-gray-700 mb-2">Input / Output</h3>
            <SymbolItemComponent item={symbols.input} symbolKey="input" />
            <SymbolItemComponent item={symbols.output} symbolKey="output" />
          </div>

          {/* Variables */}
          <div className="flex flex-col gap-2 ml-16"> {/* เพิ่ม margin-left เพื่อเว้นระยะ */}
            <h3 className="text-lg font-medium text-gray-700 mb-2">Variables</h3>
            <SymbolItemComponent item={symbols.declare} symbolKey="declare" />
            <SymbolItemComponent item={symbols.assign} symbolKey="assign" />
          </div>
        </div>

      {/* Control */}
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium text-gray-700 mb-2">Control</h3>
        <SymbolItemComponent item={symbols.if} symbolKey="if" />
        <SymbolItemComponent item={symbols.call} symbolKey="call" />
        <SymbolItemComponent item={symbols.while} symbolKey="while" />
        <SymbolItemComponent item={symbols.for} symbolKey="for" />
        <SymbolItemComponent item={symbols.do} symbolKey="do" />
      </div>
    </div>
  );
};

export default SymbolSection;
