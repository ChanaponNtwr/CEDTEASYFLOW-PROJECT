"use client";
import React, { useState } from "react";
import { FaFileAlt } from "react-icons/fa";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";

// Define TestCase interface
interface TestCase {
  no: number;
  input: string;
  output: string;
  score: number;
}

function Labinfo() {
  // State for test cases
  const [testCases] = useState<TestCase[]>([
    { no: 1, input: "n = 8", output: "32", score: 5 },
    { no: 2, input: "i = 1", output: "true", score: 5 },
    { no: 3, input: "i = 2", output: "false", score: 5 },
  ]);

  // State for symbol counts
  const [symbols, setSymbols] = useState({
    input: 0,
    output: 0,
    declare: 0,
    assign: 0,
    if: 5,
  });

  // Handler for updating symbol counts
  const updateSymbolCount = (newSymbols: {
    input: number;
    output: number;
    declare: number;
    assign: number;
    if: number;
  }) => {
    setSymbols(newSymbols);
  };

  return (
    <div className="min-h-screen w-full bg-gray-100">
      <div className="pt-20 pl-52">
        <Navbar />
        <div className="flex min-h-screen">
          <Sidebar />
            <div className="flex-1 flex justify-center p-6 md:p-10">
            <div className="w-full max-w-5xl bg-white p-6 rounded-lg shadow-md">
              {/* Buttons (Edit) */}
              <div className="flex justify-end space-x-4 mb-6">
                <Link
                  href="/editlab"
                  className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center hover:bg-blue-700"
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

              {/* Title and Points */}
              <div className="flex justify-between items-center border-b-2 border-gray-300 pb-1 mb-6">
                <div className="flex items-center">
                  <div className="w-20 h-20 bg-[#EEEEEE] rounded-full flex items-center justify-center mr-4">
                    <img src="/images/lab.png" className="w-12 h-14" />
                  </div>
                  <h2 className="text-4xl font-semibold">
                    Lab 3 <span className="text-xs ">(10 points)</span>
                  </h2>
                </div>
                <p className="text-gray-500 text-sm">Due Dec 31, 2024, 9:00 AM</p>
              </div>

              {/* Description */}
              <div className="ml-0 md:ml-10">
                <p className="mb-6 text-gray-700">
                  รายวิชาการเขียนโปรแกรมคอมพิวเตอร์ 1 คะแนนเก็บ ครั้งที่ 1 ทำ N
                  ครั้งตามที่กำหนด
                  <br />
                  คำสั่ง: ทำตามขั้นตอนใน N ครั้งตามที่กำหนดให้ครบถ้วน
                </p>
                <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

                {/* Test Case Table */}
                <div className="flex-1 mb-6">
                  <table className="w-4xl table-auto">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-left">No.</th>
                        <th className="px-4 py-2 text-left">Input</th>
                        <th className="px-4 py-2 text-left">Output</th>
                        <th className="px-4 py-2 text-left">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testCases.map((testCase) => (
                        <tr key={testCase.no} className="border-t">
                          <td className="px-4 py-2">{testCase.no}</td>
                          <td className="px-4 py-2">{testCase.input}</td>
                          <td className="px-4 py-2">{testCase.output}</td>
                          <td className="px-8 py-2">{testCase.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Symbols Section */}
                <div className="pt-5">
                  <h1 className="text-2xl font-bold text-gray-700 mb-2">Symbols</h1>
                  <SymbolSection onChange={updateSymbolCount} />
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
    </div>
  );
}

export default Labinfo;