"use client";
import React, { useState } from "react";
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
  status?: "Pass" | "Pending" | "Fail";
}

function Studentlab() {
  // State for test cases
  const [testCases, setTestCases] = useState<TestCase[]>([
    { no: 1, input: "n = 8", output: "32", score: 5 },
    { no: 2, input: "i = 1", output: "true", score: 4 },
    { no: 3, input: "i = 2", output: "false", score: 2 },
  ]);

  // Calculate and set status for each test case
  const computeStatus = (score: number): "Pass" | "Pending" | "Fail" => {
    if (score >= 5) return "Pass";
    if (score >= 3) return "Pending";
    return "Fail";
  };

  const enhancedTestCases = testCases.map((tc) => ({
    ...tc,
    status: computeStatus(tc.score),
  }));

  // State for symbol counts
  const [symbols, setSymbols] = useState({
    input: 0,
    output: 0,
    declare: 0,
    assign: 0,
    if: 5,
  });

  const updateSymbolCount = (newSymbols: typeof symbols) => {
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
              {/* Buttons */}
                <div className="flex justify-end mb-2">
                  <Link
                    href="/Dolab"
                    className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center justify-center hover:bg-blue-700 w-24"
                  >
                    Do lab
                  </Link>
                </div>
                <div className="flex justify-end mb-2">
                  <Link
                    href="/"
                    className="bg-[#133384] text-white px-4 py-2 rounded-full flex items-center justify-center hover:bg-[#1945B7] w-24"
                  >
                    Submit
                  </Link>
                </div>

              {/* Title */}
              <div className="flex justify-between items-center border-b-2 border-gray-300 pb-1 mb-6">
                <div className="flex items-center">
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                    <img src="/images/lab.png" className="w-12 h-14" />
                  </div>
                  <h2 className="text-4xl font-semibold">
                    Lab 3 <span className="text-xs">(10 points)</span>
                  </h2>
                </div>
                <p className="text-gray-500 text-sm">Due Dec 31, 2024, 9:00 AM</p>
              </div>

              {/* Description */}
              <div className="ml-0 md:ml-10 mb-6">
                <p className="mb-6 text-gray-700">
                  รายวิชาการเขียนโปรแกรมคอมพิวเตอร์ 1 คะแนนเก็บ ครั้งที่ 1 ทำ N
                  ครั้งตามที่กำหนด
                  <br />
                  คำสั่ง: ทำตามขั้นตอนใน N ครั้งตามที่กำหนดให้ครบถ้วน
                </p>
                <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

                {/* Test Case Table */}
                <div className="flex-1 mb-6 overflow-x-auto">
                  <table className="w-full table-auto border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left border-b">No.</th>
                        <th className="px-4 py-2 text-left border-b">Input</th>
                        <th className="px-4 py-2 text-left border-b">Output</th>
                        <th className="px-4 py-2 text-left border-b">Score</th>
                        <th className="px-4 py-2 text-left border-b">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enhancedTestCases.map((tc) => {
                        const statusClasses =
                          tc.status === "Pass"
                            ? "bg-green-100 text-green-800"
                            : tc.status === "Pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800";

                        return (
                          <tr key={tc.no} className="border-t hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2">{tc.no}</td>
                            <td className="px-4 py-2">{tc.input}</td>
                            <td className="px-4 py-2">{tc.output}</td>
                            {/* Score + Status */}
                            <td className="px-4 py-2 flex items-center gap-2">
                              <span>{tc.score}</span>
                            </td>
                            {/* Separate Status column */}
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded-full font-medium ${statusClasses}`}>
                                {tc.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
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

export default Studentlab;
