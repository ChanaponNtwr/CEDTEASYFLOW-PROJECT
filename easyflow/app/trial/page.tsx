"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
// import Link from "next/link"; // ไม่ได้ใช้ใน logic ปัจจุบัน
import { apiStartTrial, apiGetLab, apiGetTestcases } from "@/app/service/FlowchartService";
import { useRouter, useSearchParams } from "next/navigation";

// --- Interfaces ---

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
  inSymVal?: number;
  outSymVal?: number;
  declareSymVal?: number;
  assignSymVal?: number;
  ifSymVal?: number;
  forSymVal?: number;
  whileSymVal?: number;
  [k: string]: any;
}

// Helper: Format Date
function formatDueDate(d?: string) {
  if (!d) return "No due date";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString();
  } catch {
    return d;
  }
}

function Trial() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // รับ labId จาก URL (Default 19)
  const labIdParam = searchParams?.get("labId") ?? "19";

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [lab, setLab] = useState<RemoteLab | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // State สำหรับปุ่ม Do Lab (กันกดซ้ำ)
  const [isStarting, setIsStarting] = useState(false);

  // --- Data Fetching Logic (ดึงข้อมูล Lab มาแสดง) ---
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await apiGetLab(String(labIdParam));
        const remoteLab: RemoteLab = resp?.lab ?? resp ?? null;

        if (!mounted) return;
        setLab(remoteLab);

        let list: any[] = [];
        if (remoteLab && (remoteLab.testcases || remoteLab.testCases)) {
          list = remoteLab.testcases ?? remoteLab.testCases ?? [];
        } else {
          const tcResp = await apiGetTestcases(String(labIdParam));
          list = Array.isArray(tcResp)
            ? tcResp
            : tcResp?.data ?? tcResp?.testcases ?? tcResp ?? [];
        }

        // Helper parsers
        const parseVal = (val: any): any => {
          if (typeof val === "string") {
            const trimmed = val.trim();
            try {
              const parsed = JSON.parse(val);
              return parseVal(parsed);
            } catch {
              if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                const content = trimmed.slice(1, -1);
                const items = content.split(",").map((part) => {
                  const p = part.trim();
                  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
                    return p.slice(1, -1);
                  }
                  return p;
                });
                return parseVal(items);
              }
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
          const rawInput = parseVal(tc.inputVal ?? tc.input ?? tc.inHiddenVal ?? tc.inHidden ?? []);
          const rawOutput = parseVal(tc.outputVal ?? tc.output ?? tc.outHiddenVal ?? tc.outHidden ?? []);

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
            score: Number(tc.score ?? 0),
          } as TestCase;
        });

        if (!mounted) return;
        setTestCases(mapped);
      } catch (err: any) {
        console.error("Failed to load lab/testcases", err);
        if (mounted) setError("Failed to load lab details.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [labIdParam]);

  // --- Prepare Data for Display ---
  const totalPoints = testCases.reduce((s, t) => s + (t.score ?? 0), 0);
  const labTitle = lab?.labname ?? lab?.name ?? `Lab ${labIdParam}`;
  const labProblem = lab?.problemSolving ?? lab?.problem ?? "No description available.";
  const dueText = lab?.dueDate ?? lab?.dateline ?? undefined;

  const symbolLabData = lab
    ? {
        inSymVal: lab.inSymVal,
        outSymVal: lab.outSymVal,
        declareSymVal: lab.declareSymVal,
        assignSymVal: lab.assignSymVal,
        ifSymVal: lab.ifSymVal,
        forSymVal: lab.forSymVal,
        whileSymVal: lab.whileSymVal,
      }
    : undefined;

  // --- Action Handler: Start Trial ---
  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsStarting(true);

    try {
      const currentLabId = labIdParam; 
      const result = await apiStartTrial(currentLabId);
      console.log("Start Trial Response:", result);

      if (result && result.ok && result.trialId) {
        router.push(`/dolabtrial/${result.trialId}`);
      } else {
        throw new Error("Invalid response from server (missing trialId)");
      }

    } catch (error: any) {
      console.error("Failed to start lab:", error);
      alert(`Failed to start lab: ${error.message || "Unknown error"}`);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 font-sans text-gray-900">
      <div className="pt-20 pl-0 md:pl-52 transition-all duration-300">
        <Navbar />
        <div className="flex min-h-screen">
          <Sidebar />
          
          <main className="flex-1 p-6 md:p-10">
            <div className="max-w-6xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              
              {/* Header: Title & Button */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 pb-6 mb-8 gap-4">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm">
                    {/* ใช้ img หรือ Image component ก็ได้ */}
                    <img src="/images/lab.png" className="w-10 h-10 object-contain" alt="Lab Icon" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-800 tracking-tight">
                      {labTitle}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {totalPoints} Points
                       </span>
                       {/* <span className="text-sm text-gray-500">
                          Due: {formatDueDate(dueText)}
                       </span> */}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleClick}
                  disabled={loading || isStarting}
                  className={`px-8 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5
                    ${loading || isStarting 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' 
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'}
                  `}
                >
                  {isStarting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Starting...
                    </span>
                  ) : "Do lab"}
                </button>
              </div>

              {/* Description Content */}
              <div className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Problem Description</h3>
                <div className="bg-gray-50/50 p-6 rounded-xl border border-gray-100 text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {labProblem}
                </div>
              </div>

              {loading && <div className="text-center py-12 text-gray-500">Loading lab data...</div>}
              {error && <div className="text-center py-12 text-red-500 bg-red-50 rounded-xl">{error}</div>}

              {/* Test Case Table */}
              {!loading && !error && (
                <div className="mb-10">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">Test Cases</h3>
                   <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">No.</th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Input</th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Expected Output</th>
                          <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {testCases.length > 0 ? (
                          testCases.map((tc, index) => (
                            <tr key={tc.no} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">{tc.no}</td>
                              <td className="px-6 py-4 text-sm text-gray-700 font-mono bg-gray-50/30">
                                <span className="px-2 py-1 rounded bg-gray-100 text-gray-800 border border-gray-200">{tc.input}</span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700 font-mono">
                                <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100">{tc.output}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-600 text-center">{tc.score}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                              No testcases available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Symbols Section */}
              {!loading && (
                <div className="pt-2">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Available Symbols</h3>
                  <SymbolSection labData={symbolLabData} />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default Trial;