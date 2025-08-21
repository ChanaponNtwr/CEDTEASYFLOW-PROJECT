"use client";

import React, { useState } from "react";
import { FaFileAlt } from "react-icons/fa";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

interface TestCase {
  input: string;
  output: string;
  score: number;
}

function Dolab() {
  const [testCases] = useState<TestCase[]>([
    { input: "1", output: "32", score: 5 },
    { input: "i = 1", output: "true", score: 5 },
  ]);

  const [symbols, setSymbols] = useState({
    input: 0,
    output: 0,
    declare: 0,
    assign: 0,
    if: 5,
    call: 2,
  });

  const updateSymbolCount = (type: string, delta: number) => {
    setSymbols((prev) => ({
      ...prev,
      [type]: Math.max(0, prev[type as keyof typeof symbols] + delta),
    }));
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <Navbar />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col p-6 md:p-20">
          {/* ปุ่ม Dolab */}
          <div className="flex justify-end mb-2">
            <button
              className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition"
              aria-label="Dolab"
            >
              Dolab
            </button>
          </div>

          {/* Due + Submit ชิดกัน */}
          <div className="flex justify-end items-center gap-4 mb-6">
            <p className="text-gray-500 text-sm">Due Mar 4, 2024, 11:59 PM</p>
            <button
              className="bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700 transition"
              aria-label="Submit"
            >
              Submit
            </button>
          </div>


          {/* Title */}
          <div className="flex items-center mb-6">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mr-4">
              <FaFileAlt className="w-14 h-14 text-gray-500" />
            </div>
            <h2 className="text-4xl font-semibold">
              Lab 3 <span className="text-xs align-top">(11 points)</span>
            </h2>
          </div>

          {/* Description */}
          <div className="ml-0 md:ml-10">
            <p className="mb-6 text-gray-700">
              รายวิชาการเขียนโปรแกรมคอมพิวเตอร์ 1 คะแนนเก็บ ครั้งที่ 1 ทำ N ครั้งตามที่กำหนด
              <br />
              คำสั่ง: ทำตามขั้นตอนใน N ครั้งตามที่กำหนดให้ครบถ้วน
            </p>
            <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

            {/* Main Content */}
            <div className="flex flex-col md:flex-row gap-6">
              {/* Symbol Section */}
              <div className="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-medium text-gray-700 mb-4">Symbol</h3>
                <div className="space-y-4">
                  {["input", "output"].map((type) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className={`px-3 py-1 rounded-md ${
                        type === "input" ? "bg-blue-200 text-blue-800" : "bg-green-200 text-green-800"
                      }`}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateSymbolCount(type, -1)} className="text-gray-500">-</button>
                        <span>{symbols[type as keyof typeof symbols]}</span>
                        <button onClick={() => updateSymbolCount(type, 1)} className="text-gray-500">+</button>
                        <input type="checkbox" className="ml-2" defaultChecked />
                        <label className="text-sm text-gray-600">Unlimited</label>
                      </div>
                    </div>
                  ))}

                  {/* Variables */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Variables</h4>
                    {["declare", "assign"].map((type) => (
                      <div key={type} className="flex items-center justify-between mb-4">
                        <div className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-md">
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateSymbolCount(type, -1)} className="text-gray-500">-</button>
                          <span>{symbols[type as keyof typeof symbols]}</span>
                          <button onClick={() => updateSymbolCount(type, 1)} className="text-gray-500">+</button>
                          <input type="checkbox" className="ml-2" defaultChecked />
                          <label className="text-sm text-gray-600">Unlimited</label>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Control */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Control</h4>
                    {["if", "call"].map((type) => (
                      <div key={type} className="flex items-center justify-between mb-4">
                        <div className={`px-3 py-1 rounded-md ${
                          type === "if" ? "bg-pink-200 text-pink-800" : "bg-purple-200 text-purple-800"
                        }`}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateSymbolCount(type, -1)} className="text-gray-500">-</button>
                          <span>{symbols[type as keyof typeof symbols]}</span>
                          <button onClick={() => updateSymbolCount(type, 1)} className="text-gray-500">+</button>
                          <input type="checkbox" className="ml-2" />
                          <label className="text-sm text-gray-600">Unlimited</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Test Cases Section */}
              <div className="flex-1">
                <table className="w-full border-collapse bg-white shadow-md rounded-lg">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border p-2 text-left">Testcase</th>
                      <th className="border p-2 text-left">NO</th>
                      <th className="border p-2 text-left">Output</th>
                      <th className="border p-2 text-left">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testCases.map((testCase, index) => (
                      <tr key={index} className="border">
                        <td className="border p-2">{index + 1}</td>
                        <td className="border p-2">{testCase.input}</td>
                        <td className="border p-2">{testCase.output}</td>
                        <td className="border p-2">{testCase.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dolab;
