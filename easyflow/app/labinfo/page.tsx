"use client";
import React, { useState, useEffect } from "react";
import { FaFileAlt } from "react-icons/fa";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";
import { apiGetTestcases } from "@/app/service/FlowchartService";

// Define TestCase interface
interface TestCase {
  no: number;
  input: string;
  output: string;
  score: number;
}

function Labinfo() {
  // State for test cases
  // State for test cases
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const LAB_ID = 2; // Mockup fixed Lab ID

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await apiGetTestcases(LAB_ID);
        const list = Array.isArray(data) ? data : (data?.data ?? data?.testcases ?? []);

        const parseVal = (val: any): any => {
          if (typeof val === "string") {
            const trimmed = val.trim();
            try {
              const parsed = JSON.parse(val);
              return parseVal(parsed);
            } catch {
              if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                const content = trimmed.slice(1, -1);
                const items = content.split(",").map(part => {
                  const p = part.trim();
                  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
                    return p.slice(1, -1);
                  }
                  return p;
                });
                return parseVal(items);
              }
              return val;
            }
          }
          if (Array.isArray(val)) {
            return val.map(parseVal);
          }
          return val;
        };

        const flattenDeep = (arr: any[]): any[] => {
          return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
        };

        const mapped = list.map((tc: any, index: number) => {
          const rawInput = parseVal(tc.inputVal);
          const rawOutput = parseVal(tc.outputVal);

          const format = (v: any) => {
            if (Array.isArray(v)) {
              return flattenDeep(v).join(", ");
            }
            return String(v ?? "");
          };

          return {
            no: index + 1,
            input: format(rawInput),
            output: format(rawOutput),
            score: Number(tc.score ?? 0)
          };
        });

        setTestCases(mapped);
      } catch (err) {
        console.error("Failed to load testcases in labinfo", err);
      }
    };
    fetchData();
  }, []);

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
                <div className="flex-1 mb-8 overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          No.
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Input
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Output
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {testCases.map((testCase, index) => (
                        <tr
                          key={testCase.no}
                          className={` transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                        >
                          <td className="font-semibold px-6 py-4 whitespace-nowrap text-sm text-gray-600 ">
                            {testCase.no}
                          </td>
                          <td className="font-semibold px-6 py-4 text-sm text-gray-700">
                            <span className=" px-2 py-1 rounded text-xs text-gray-800">
                              {testCase.input}
                            </span>
                          </td>
                          <td className="font-semibold px-6 py-4 text-sm text-gray-700">
                            <span className=" px-2 py-1 rounded text-xs text-blue-800">
                              {testCase.output}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-800">
                              {testCase.score} pts
                            </span>
                          </td>
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