"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection"; 
import Link from "next/link";
import { apiGetTestcases, apiGetLab } from "@/app/service/FlowchartService";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaEdit, FaCalendarAlt, FaCube, FaFlask } from "react-icons/fa"; // เพิ่ม Icons

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

function formatDueDate(d?: string) {
  if (!d) return "No due date";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString("th-TH", {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d;
  }
}

function Labinfo() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  // ✅ ดึง ID (รองรับทั้ง labinfoId, labId, id)
  const rawId = params?.labinfoId || params?.labId || params?.id; 
  const labIdParam = Array.isArray(rawId) ? rawId[0] : rawId;

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [lab, setLab] = useState<RemoteLab | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labIdParam) {
        if (params && Object.keys(params).length > 0) setLoading(false);
        return;
    }

    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await apiGetLab(String(labIdParam));
        const remoteLab: RemoteLab = resp?.lab ?? resp?.data ?? resp ?? null;

        if (!mounted) return;
        setLab(remoteLab);

        let list: any[] = [];
        if (remoteLab && (Array.isArray(remoteLab.testcases) || Array.isArray(remoteLab.testCases))) {
          list = remoteLab.testcases ?? remoteLab.testCases ?? [];
        } else {
          const tcResp = await apiGetTestcases(String(labIdParam));
          list = Array.isArray(tcResp)
            ? tcResp
            : tcResp?.data ?? tcResp?.testcases ?? tcResp ?? [];
        }

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
                  let p = part.trim();
                  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
                    p = p.slice(1, -1);
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
          if (Array.isArray(val)) return val.map(parseVal);
          return val;
        };

        const flattenDeep = (arr: any[]): any[] => {
          return arr.reduce((acc, val) => (Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val)), []);
        };

        const mapped = (list ?? []).map((tc: any, index: number) => {
          const rawInput = parseVal(tc.inputVal ?? tc.input ?? tc.inHiddenVal ?? tc.inHidden ?? []);
          const rawOutput = parseVal(tc.outputVal ?? tc.output ?? tc.outHiddenVal ?? tc.outHidden ?? []);

          const format = (v: any) => {
            if (Array.isArray(v)) return flattenDeep(v).join(", ");
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
        console.error("❌ Failed to load lab/testcases:", err);
        if (mounted) setError(err?.message || "Failed to load data");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [labIdParam, params]);

  // --- Render Error State ---
  if (!labIdParam && !loading) {
    return (
      <div className="min-h-screen w-full bg-[#F9FAFB] flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 text-center max-w-md">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <FaCube size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Error: Lab ID Not Found</h2>
            <Link href="/mylab" className="mt-6 inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Back to My Labs
            </Link>
        </div>
      </div>
    );
  }

  const totalPoints = testCases.reduce((s, t) => s + (t.score ?? 0), 0);
  const labTitle = lab?.labname ?? lab?.name ?? `Lab ${labIdParam || "?"}`;
  const labProblem = lab?.problemSolving ?? lab?.problem ?? "";
  const dueText = lab?.dueDate ?? lab?.dateline ?? null;

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

  return (
    <div className="min-h-screen w-full bg-[#F9FAFB]">
      <div className="pt-20 pl-0 md:pl-64 transition-all duration-300">
        <Navbar />
        <Sidebar />
        
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
            
            {/* 1. Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-white rounded-2xl flex items-center justify-center flex-shrink-0 border border-blue-100 shadow-sm">
                        <img src="/images/lab.png" className="w-8 h-auto object-contain" alt="Lab Icon" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 leading-tight">{labTitle}</h1>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                             <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                <span className="font-medium text-gray-700">{totalPoints} Points</span>
                             </div>
                             <div className="hidden md:block w-[1px] h-4 bg-gray-300"></div>
                             <div className="flex items-center gap-1.5">
                                <FaCalendarAlt className="text-gray-400" />
                                {dueText ? `Due: ${formatDueDate(dueText)}` : "No due date"}
                             </div>
                        </div>
                    </div>
                </div>

                <Link
                    href={`/editlab/${labIdParam}`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                >
                    <FaEdit /> Edit Lab
                </Link>
            </div>

            {/* 2. Problem Description */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
                    <div className="w-1 h-5 bg-orange-500 rounded-full"></div>
                    <h3 className="text-lg font-bold text-gray-800">Problem Description</h3>
                </div>
                <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {labProblem || <span className="text-gray-400 italic">No description available.</span>}
                </div>
            </div>

            {/* 3. Test Cases Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-lg font-bold text-gray-800">Test Cases</h3>
                    </div>
                    {testCases.length > 0 && (
                        <span className="bg-white border border-gray-200 text-gray-500 text-xs py-1 px-3 rounded-full font-medium shadow-sm">
                            {testCases.length} Cases
                        </span>
                    )}
                </div>

                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        <span className="ml-3 text-gray-500 font-medium">Loading data...</span>
                    </div>
                )}
                
                {error && <div className="p-8 text-center text-red-500 bg-red-50">Error: {error}</div>}

                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-16">No.</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Input</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Output</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Score</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100 text-sm">
                                {testCases.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic bg-gray-50/30">
                                            No testcases found for this lab.
                                        </td>
                                    </tr>
                                ) : (
                                    testCases.map((testCase, index) => (
                                        <tr key={testCase.no} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-500">{testCase.no}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-2">
                                                    <code className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono border border-gray-200 break-all max-w-xs md:max-w-md">
                                                        {testCase.input}
                                                    </code>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-2">
                                                    <code className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono border border-blue-100 break-all max-w-xs md:max-w-md">
                                                        {testCase.output}
                                                    </code>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                                                    {testCase.score}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 4. Configuration Section */}
            {!loading && !error && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-50 pb-3">
                        <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                        <h2 className="text-lg font-bold text-gray-800">Configuration</h2>
                    </div>
                    <SymbolSection labData={symbolLabData} />
                </div>
            )}

        </div>
      </div>  
    </div>
  );
}

export default Labinfo;