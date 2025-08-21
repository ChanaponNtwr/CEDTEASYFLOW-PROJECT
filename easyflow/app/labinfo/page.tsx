"use client";

import React, { useState } from "react";
import { FaFileAlt } from "react-icons/fa";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Link from "next/link";
// Define TestCase interface
interface TestCase {
  input: string;
  output: string;
  score: number;
}

function Labinfo() {
  // State for test cases
  const [testCases] = useState<TestCase[]>([
    { input: "1", output: "32", score: 5 },
    { input: "i = 1", output: "true", score: 5 },
  ]);

  // State for symbol counts
  const [symbols, setSymbols] = useState({
    input: 0,
    output: 0,
    declare: 0,
    assign: 0,
    if: 5,
    call: 2,
  });

  // Handler for updating symbol counts
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
        <div className="flex-1 flex flex-col p-6 md:p-20"> {/* ปรับ padding สำหรับ responsive */}
          {/* Buttons (Edit) */}
          <div className="flex justify-end space-x-4 mb-6">
            <Link href="/editlab"
              
              className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center hover:bg-blue-700"
              aria-label="Edit all submissions"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </Link>
          </div>

                    {/* Title and Points with Icon */}
                    <div className="flex justify-between items-center border-b-2 border-gray-300 pb-1 mb-6">
                      <div className="flex items-center">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mr-4">
                          <FaFileAlt className="w-14 h-14 text-gray-500" />
                        </div>
                        <h2 className="text-4xl font-semibold">
                          Lab 3 <span className="text-xs align-top">(11 points)</span>
                        </h2>
                      </div>
                      <p className="text-gray-500 text-sm">Due Mar 4, 2024, 11:59 PM</p>
                    </div>
          <div className="ml-0 md:ml-10"> {/* ปรับ margin สำหรับ responsive */}
            {/* Description */}
            <p className="mb-6 text-gray-700">
              รายวิชาการเขียนโปรแกรมคอมพิวเตอร์ 1 คะแนนเก็บ ครั้งที่ 1 ทำ N ครั้งตามที่กำหนด
              <br />
              คำสั่ง: ทำตามขั้นตอนใน N ครั้งตามที่กำหนดให้ครบถ้วน
            </p>
            <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>


          {/* Main Content */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Right Section: Symbol Selection */}
            <div className="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-gray-700 mb-4">Symbol</h3>
              <div className="space-y-4">
                {/* Input/Output */}
                <div className="flex items-center justify-between">
                  <div className="bg-blue-200 text-blue-800 px-3 py-1 rounded-md">Input</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSymbolCount("input", -1)}
                      className="text-gray-500"
                      aria-label="Decrease input count"
                    >
                      -
                    </button>
                    <span>{symbols.input}</span>
                    <button
                      onClick={() => updateSymbolCount("input", 1)}
                      className="text-gray-500"
                      aria-label="Increase input count"
                    >
                      +
                    </button>
                    <input type="checkbox" className="ml-2" defaultChecked />
                    <label className="text-sm text-gray-600">Unlimited</label>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="bg-green-200 text-green-800 px-3 py-1 rounded-md">Output</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSymbolCount("output", -1)}
                      className="text-gray-500"
                      aria-label="Decrease output count"
                    >
                      -
                    </button>
                    <span>{symbols.output}</span>
                    <button
                      onClick={() => updateSymbolCount("output", 1)}
                      className="text-gray-500"
                      aria-label="Increase output count"
                    >
                      +
                    </button>
                    <input type="checkbox" className="ml-2" defaultChecked />
                    <label className="text-sm text-gray-600">Unlimited</label>
                  </div>
                </div>
                {/* Variables */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Variables</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-md">Declare</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSymbolCount("declare", -1)}
                          className="text-gray-500"
                          aria-label="Decrease declare count"
                        >
                          -
                        </button>
                        <span>{symbols.declare}</span>
                        <button
                          onClick={() => updateSymbolCount("declare", 1)}
                          className="text-gray-500"
                          aria-label="Increase declare count"
                        >
                          +
                        </button>
                        <input type="checkbox" className="ml-2" defaultChecked />
                        <label className="text-sm text-gray-600">Unlimited</label>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-md">Assign</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSymbolCount("assign", -1)}
                          className="text-gray-500"
                          aria-label="Decrease assign count"
                        >
                          -
                        </button>
                        <span>{symbols.assign}</span>
                        <button
                          onClick={() => updateSymbolCount("assign", 1)}
                          className="text-gray-500"
                          aria-label="Increase assign count"
                        >
                          +
                        </button>
                        <input type="checkbox" className="ml-2" defaultChecked />
                        <label className="text-sm text-gray-600">Unlimited</label>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Control */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Control</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="bg-pink-200 text-pink-800 px-3 py-1 rounded-md">If</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSymbolCount("if", -1)}
                          className="text-gray-500"
                          aria-label="Decrease IF count"
                        >
                          -
                        </button>
                        <span>{symbols.if}</span>
                        <button
                          onClick={() => updateSymbolCount("if", 1)}
                          className="text-gray-500"
                          aria-label="Increase IF count"
                        >
                          +
                        </button>
                        <input type="checkbox" className="ml-2" />
                        <label className="text-sm text-gray-600">Unlimited</label>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="bg-purple-200 text-purple-800 px-3 py-1 rounded-md">Call</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSymbolCount("call", -1)}
                          className="text-gray-500"
                          aria-label="Decrease call count"
                        >
                          -
                        </button>
                        <span>{symbols.call}</span>
                        <button
                          onClick={() => updateSymbolCount("call", 1)}
                          className="text-gray-500"
                          aria-label="Increase call count"
                        >
                          +
                        </button>
                        <input type="checkbox" className="ml-2" />
                        <label className="text-sm text-gray-600">Unlimited</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Section: Test Case Table */}
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

export default Labinfo;