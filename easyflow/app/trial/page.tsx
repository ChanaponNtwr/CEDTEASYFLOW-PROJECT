"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";
// Update imports: ใช้ apiStartTrial แทน
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

        // Helper parsers (เหมือนเดิม)
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
        inSymVal: lab.inSymVal ?? 0,
        outSymVal: lab.outSymVal ?? 0,
        declareSymVal: lab.declareSymVal ?? 0,
        assignSymVal: lab.assignSymVal ?? 0,
        ifSymVal: lab.ifSymVal ?? 0,
        forSymVal: lab.forSymVal ?? 0,
        whileSymVal: lab.whileSymVal ?? 0,
      }
    : undefined;

  // --- Action Handler: Start Trial ---
  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    // 1. Set Loading State
    setIsStarting(true);

    try {
      const currentLabId = labIdParam; // ใช้ ID จาก URL หรือ Default

      // 2. Call API: POST /trial/start
      // (Backend จะสร้าง Flowchart และ trialId ให้เอง)
      const result = await apiStartTrial(currentLabId);

      console.log("Start Trial Response:", result);

      if (result && result.ok && result.trialId) {
        // 3. Success: Redirect to /Dolab/[trialId]
        router.push(`/dolabtrial/${result.trialId}`);
      } else {
        throw new Error("Invalid response from server (missing trialId)");
      }

    } catch (error: any) {
      console.error("Failed to start lab:", error);
      alert(`Failed to start lab: ${error.message || "Unknown error"}`);
    } finally {
      // 4. Reset Loading State
      setIsStarting(false);
    }
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
              <div className="flex justify-end mb-2 space-x-2">
                <button
                  onClick={handleClick}
                  disabled={loading || isStarting} // Disable ตอนโหลดหน้า หรือ ตอนกำลัง Start Trial
                  className={`px-4 py-2 rounded-full flex items-center justify-center w-28 text-white transition-colors
                    ${loading || isStarting 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'}
                  `}
                >
                  {isStarting ? "Starting..." : "Do lab"}
                </button>
                <Link
                  href="/"
                  className="bg-[#133384] text-white px-4 py-2 rounded-full flex items-center justify-center hover:bg-[#1945B7] w-24"
                >
                  Submit
                </Link>
              </div>

              {/* Title Section */}
              <div className="flex justify-between items-center border-b-2 border-gray-300 pb-1 mb-6">
                <div className="flex items-center">
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                    <img src="/images/lab.png" className="w-12 h-14" alt="Lab Icon" />
                  </div>
                  <h2 className="text-4xl font-semibold">
                    {labTitle} <span className="text-xs text-gray-500">({totalPoints} points)</span>
                  </h2>
                </div>
                <p className="text-gray-500 text-sm">
                  Due: {formatDueDate(dueText)}
                </p>
              </div>

              {/* Description & Content */}
              <div className="ml-0 md:ml-10 mb-6">
                <p className="mb-6 text-gray-700 whitespace-pre-wrap">
                  {labProblem}
                </p>
                <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

                {loading && <div className="text-center py-4 text-gray-500">Loading lab data...</div>}
                {error && <div className="text-center py-4 text-red-500">{error}</div>}

                {/* Test Case Table */}
                {!loading && !error && (
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
                        {testCases.length > 0 ? (
                          testCases.map((tc, index) => (
                            <tr
                              key={tc.no}
                              className={`transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-600">
                                {tc.no}
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                                <span className="px-2 py-1 rounded text-xs text-gray-800 bg-gray-100">
                                  {tc.input}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                                <span className="px-2 py-1 rounded text-xs text-blue-800 bg-blue-50">
                                  {tc.output}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                                {tc.score}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                              No testcases found for this lab.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Symbols Section */}
                {!loading && (
                  <div className="pt-5">
                    <h1 className="text-2xl font-bold text-gray-700 mb-2">Symbols</h1>
                    <SymbolSection labData={symbolLabData} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Trial;