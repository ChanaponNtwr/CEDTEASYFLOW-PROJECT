"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection"; 
import Link from "next/link";
import { apiGetTestcases, apiGetLab } from "@/app/service/FlowchartService";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

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
    <div className="min-h-screen w-full bg-gray-100">
      <div className="pt-20 pl-52">
        <Navbar />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex justify-center p-6 md:p-10">
            <div className="w-full max-w-5xl bg-white p-6 rounded-lg shadow-md">
              
              {!labIdParam ? (
                <div className="text-center py-20">
                    <h2 className="text-xl font-bold text-red-500">Error: Lab ID Not Found</h2>
                    <Link href="/mylab" className="text-blue-600 underline mt-4 block">Back to My Labs</Link>
                </div>
              ) : (
                <>
                  <div className="flex justify-end space-x-4 mb-6">
                    {/* ✅ แก้ไข: ลิงก์ไป Dynamic Route /editlab/[editlabId] */}
                    <Link
                      href={`/editlab/${labIdParam}`}
                      className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center hover:bg-blue-700"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </Link>
                  </div>

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

                  <div className="ml-0 md:ml-10">
                    <p className="mb-6 text-gray-700 whitespace-pre-wrap">
                      {labProblem || "รายละเอียดการบ้านยังไม่มี"}
                    </p>
                    <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

                    {loading && (
                        <div className="flex justify-center items-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-gray-600">Loading data...</span>
                        </div>
                    )}
                    
                    {error && <div className="mb-4 text-sm text-red-600 text-center">Error: {error}</div>}

                    {!loading && !error && (
                        <div className="flex-1 mb-8 overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">No.</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Input</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Output</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {testCases.map((testCase, index) => (
                                <tr key={testCase.no} className={`transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                <td className="font-semibold px-6 py-4 whitespace-nowrap text-sm text-gray-600">{testCase.no}</td>
                                <td className="font-semibold px-6 py-4 text-sm text-gray-700">
                                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">{testCase.input}</code>
                                </td>
                                <td className="font-semibold px-6 py-4 text-sm text-gray-700">
                                    <code className="bg-blue-50 px-2 py-1 rounded text-xs text-blue-800">{testCase.output}</code>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-800">
                                    {testCase.score} pts
                                    </span>
                                </td>
                                </tr>
                            ))}
                            {testCases.length === 0 && (
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

                    <div className="pt-5">
                      <h1 className="text-2xl font-bold text-gray-700 mb-2">Symbols</h1>
                      <SymbolSection labData={symbolLabData} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>  
    </div>
  );
}

export default Labinfo;