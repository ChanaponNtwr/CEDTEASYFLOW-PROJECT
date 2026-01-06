"use client";

import React, { useEffect, useState } from "react";
import { FaFileAlt } from "react-icons/fa";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";
import { apiGetTestcases, apiGetLab } from "@/app/service/FlowchartService";
import { useSearchParams } from "next/navigation";

interface TestCase {
  no: number;
  input: string;
  output: string;
  score: number;
}

interface RemoteLab {
  labId?: number | string;
  labname?: string;
  name?: string;
  dueDate?: string;
  dateline?: string;
  testcases?: any[];
  testCases?: any[];
  problemSolving?: string;
  problem?: string;
  [k: string]: any;
}

function formatDueDate(d?: string) {
  if (!d) return "No due";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString();
  } catch {
    return d;
  }
}

function Labinfo() {
  const searchParams = useSearchParams();
  const labIdParam = searchParams?.get("labId") ?? "2"; // fallback to 2
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [lab, setLab] = useState<RemoteLab | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State for symbol counts
  const [symbols, setSymbols] = useState({
    input: 0,
    output: 0,
    declare: 0,
    assign: 0,
    if: 0,
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

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) Try to get lab info first
        const resp = await apiGetLab(String(labIdParam));
        // resp might be { ok: true, lab: { ... } } OR direct lab object
        const remoteLab: RemoteLab = resp?.lab ?? resp ?? null;

        if (!mounted) return;
        setLab(remoteLab);

        // 2) Get testcases: prefer remoteLab.testcases if present, otherwise call apiGetTestcases
        let list: any[] = [];
        if (remoteLab && (remoteLab.testcases || remoteLab.testCases)) {
          list = remoteLab.testcases ?? remoteLab.testCases ?? [];
        } else {
          // fallback: call apiGetTestcases
          const tcResp = await apiGetTestcases(String(labIdParam));
          // api may return array directly or { data: [...] } or { testcases: [...] }
          list = Array.isArray(tcResp)
            ? tcResp
            : tcResp?.data ?? tcResp?.testcases ?? tcResp ?? [];
        }

        // parsing helpers (your original logic, preserved)
        const parseVal = (val: any): any => {
          if (typeof val === "string") {
            const trimmed = val.trim();
            // try JSON.parse
            try {
              const parsed = JSON.parse(val);
              return parseVal(parsed);
            } catch {
              // handle bracketed list like "[1,2,3]" or strings like "1 2 3"
              if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                const content = trimmed.slice(1, -1);
                // split by comma but be tolerant of spaces
                const items = content.split(",").map((part) => {
                  const p = part.trim();
                  if (
                    (p.startsWith('"') && p.endsWith('"')) ||
                    (p.startsWith("'") && p.endsWith("'"))
                  ) {
                    return p.slice(1, -1);
                  }
                  return p;
                });
                return parseVal(items);
              }
              // split by whitespace if no comma found
              const hasComma = trimmed.indexOf(",") !== -1;
              if (!hasComma && trimmed.indexOf(" ") !== -1) {
                return trimmed.split(/\s+/).map((s) => s.trim()).filter(Boolean);
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
          return arr.reduce((acc, val) => (Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val)), []);
        };

        const mapped = (list ?? []).map((tc: any, index: number) => {
          // support both inputVal / input / inHiddenVal etc
          const rawInput = parseVal(tc.inputVal ?? tc.input ?? tc.inHiddenVal ?? tc.inHidden ?? []);
          const rawOutput = parseVal(tc.outputVal ?? tc.output ?? tc.outHiddenVal ?? tc.outHidden ?? []);

          const format = (v: any) => {
            if (Array.isArray(v)) {
              // flatten nested arrays and join
              return flattenDeep(v).join(", ");
            }
            return String(v ?? "");
          };

          return {
            no: index + 1,
            input: format(rawInput),
            output: format(rawOutput),
            score: Number(tc.score ?? 0),
          } as TestCase;
        });

        if (!mounted) return;
        setTestCases(mapped);
      } catch (err: any) {
        console.error("Failed to load lab/testcases in labinfo", err);
        if (mounted) setError("Failed to load lab/testcases");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [labIdParam]);

  const totalPoints = testCases.reduce((s, t) => s + (t.score ?? 0), 0);
  const labTitle = lab?.labname ?? lab?.name ?? `Lab ${labIdParam}`;
  const labProblem = lab?.problemSolving ?? lab?.problem ?? "";
  const dueText = lab?.dueDate ?? lab?.dateline ?? null;

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
                  href={`/editlab?labId=${encodeURIComponent(labIdParam)}`}
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
                    <img src="/images/lab.png" className="w-12 h-14" alt="lab" />
                  </div>
                  <h2 className="text-4xl font-semibold">
                    {labTitle} <span className="text-xs ">&nbsp;({totalPoints} points)</span>
                  </h2>
                </div>
                <p className="text-gray-500 text-sm">{dueText ? formatDueDate(dueText) : "No due date"}</p>
              </div>

              {/* Description */}
              <div className="ml-0 md:ml-10">
                <p className="mb-6 text-gray-700">
                  {labProblem || "รายละเอียดการบ้านยังไม่มี"}
                </p>
                <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

                {loading && <div className="mb-4 text-sm text-gray-600">Loading testcases...</div>}
                {error && <div className="mb-4 text-sm text-red-600">Error: {error}</div>}

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
                      {testCases.length === 0 && !loading && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                            No testcases found for this lab.
                          </td>
                        </tr>
                      )}
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
