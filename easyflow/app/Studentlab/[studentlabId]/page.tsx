"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection"; 

// Icons
import { FaPlay, FaPaperPlane, FaTimes, FaCalendarAlt, FaCheckCircle, FaExclamationCircle, FaSpinner } from "react-icons/fa";
import { IoHardwareChipOutline } from "react-icons/io5";

import { 
  apiGetTestcases, 
  apiGetLab, 
  apiPostFlowchart, 
  apiGetSubmissionsByLab,
  apiSubmitFlowchart,
  apiCancelSubmission
} from "@/app/service/FlowchartService";

// --- Interfaces ---
interface TestCase {
  no: number;
  input: string;
  output: string;
  score: number;
  [k: string]: any;
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

interface SubmissionResult {
  testcaseId?: number;
  status: string;
  output?: string;
  score?: number;
  userId?: number;
}

// --- Helpers ---
function formatDueDate(d?: string | null) { 
  if (!d) return "No due date";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
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
        const items = content.split(",").map((part) => part.trim());
        return parseVal(items);
      }
      if (!trimmed.includes(",") && trimmed.includes(" ")) {
        return trimmed.split(/\s+/).map((s) => s.trim()).filter(Boolean);
      }
      return val;
    }
  }
  if (Array.isArray(val)) return val.map(parseVal);
  return val;
};

const flattenDeep = (arr: any[]): any[] =>
  arr.reduce((acc, v) => (Array.isArray(v) ? acc.concat(flattenDeep(v)) : acc.concat(v)), []);

// --- Main ---
export default function StudentLabPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const labIdResolved = params?.studentlabId as string;

  const [lab, setLab] = useState<RemoteLab | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [tcResults, setTcResults] = useState<SubmissionResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // --- Fetch Data ---
  useEffect(() => {
    if (!labIdResolved) return;
    if (session === undefined) return; 

    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setIsSubmitted(false);
      setTcResults([]);

      try {
        const labResp = await apiGetLab(labIdResolved);
        const remoteLab: RemoteLab = labResp?.lab ?? labResp ?? null;
        if (!mounted) return;

        setLab(remoteLab);

        let list: any[] = [];
        if (remoteLab && (remoteLab.testcases || remoteLab.testCases)) {
          list = remoteLab.testcases ?? remoteLab.testCases ?? [];
        } else {
          try {
            const tcResp = await apiGetTestcases(labIdResolved);
            list = Array.isArray(tcResp)
              ? tcResp
              : tcResp?.data ?? tcResp?.testcases ?? tcResp ?? [];
          } catch {
            list = [];
          }
        }

        const mappedTC = (list ?? []).map((tc: any, idx: number) => {
          const rawInput = parseVal(tc.inputVal ?? tc.input ?? []);
          const rawOutput = parseVal(tc.outputVal ?? tc.output ?? []);
          const format = (v: any) => (Array.isArray(v) ? flattenDeep(v).join(", ") : String(v ?? ""));

          return {
            no: typeof tc.no === "number" ? tc.no : idx + 1,
            input: format(rawInput) || "-",
            output: format(rawOutput) || "-",
            score: Number(tc.score ?? tc.points ?? 0),
            raw: tc,
          } as TestCase;
        });

        if (mounted) setTestCases(mappedTC);

        if (session?.user) {
          const user = session.user as any;
          const currentUserId = Number(user.id || user.userId || user.sub);

          try {
            const apiResponse = await apiGetSubmissionsByLab(labIdResolved);
            const allSubs = apiResponse?.data?.[0]?.submissions || apiResponse?.submissions || apiResponse?.data || [];
            const arrSubs = Array.isArray(allSubs) ? allSubs : (Array.isArray(apiResponse) ? apiResponse : []);
            const mySubs = (arrSubs ?? []).filter(
              (s: any) => Number(s.userId) === currentUserId
            );

            if (mySubs.length > 0) {
              setTcResults(mySubs);
              setIsSubmitted(true);
            } else {
              setTcResults([]);
              setIsSubmitted(false);
            }
          } catch {
            setIsSubmitted(false);
            setTcResults([]);
          }
        }

        if (mounted) setLoading(false);

      } catch (err: any) {
        if (mounted) {
          setError(err?.message ?? "Failed to load lab data.");
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [labIdResolved, session]);

  // --- Handlers ---
  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!session?.user) { alert("Please login first!"); return; }

    setIsStarting(true);
    try {
      const user = session.user as any;
      const userId = user.id || user.userId || user.sub;

      const payload = { 
        userId: Number(userId), 
        labId: Number(labIdResolved),
        clientRequestId: `${userId}-${Date.now()}`
      };

      const result = await apiPostFlowchart(payload);
      const targetId = result.id || result.flowchartId || result.trialId;

      if (targetId) {
        router.push(`/Dolab/${targetId}`);
      } else {
        throw new Error("API did not return a valid flowchart ID");
      }
    } catch (error: any) {
      alert(`Failed to start lab: ${error.message || "Unknown error"}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSubmit = async () => {
    if (!session?.user) return alert("กรุณาเข้าสู่ระบบก่อนส่งงาน");
    if (!labIdResolved) return alert("Missing lab id");

    const user = session.user as any;
    const userId = user.id || user.userId || user.sub;

    setIsSubmitting(true);
    try {
      const payload = { 
        userId: Number(userId), 
        labId: Number(labIdResolved),
        clientRequestId: `${userId}-${Date.now()}`
      };
      const flowchartResult = await apiPostFlowchart(payload);
      const targetFlowchartId = flowchartResult.id || flowchartResult.flowchartId || flowchartResult.trialId;

      if (!targetFlowchartId) throw new Error("ไม่พบ Flowchart ID สำหรับการส่งงาน");

      await apiSubmitFlowchart(Number(targetFlowchartId), Number(userId));

      try {
        const apiResponse = await apiGetSubmissionsByLab(labIdResolved);
        const allSubs = apiResponse?.data?.[0]?.submissions || apiResponse?.submissions || apiResponse?.data || [];
        const arrSubs = Array.isArray(allSubs) ? allSubs : (Array.isArray(apiResponse) ? apiResponse : []);
        const mySubs = (arrSubs ?? []).filter((s: any) => Number(s.userId) === Number(userId));

        if (mySubs.length > 0) {
          setTcResults(mySubs);
          setIsSubmitted(true);
        } else {
          setTcResults([]);
          setIsSubmitted(true);
        }
      } catch {
        setIsSubmitted(true);
      }
      alert("ส่งงานเรียบร้อย");
    } catch (err: any) {
      console.error("Submit error:", err);
      const msg = err?.response?.data?.message || err?.message || "Unknown error";
      alert(`ไม่สามารถส่งงานได้: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnsubmit = async () => {
    if (!session?.user) return alert("กรุณาเข้าสู่ระบบก่อน");
    if (!confirm("คุณต้องการยกเลิกการส่งงานใช่หรือไม่?")) return;

    const user = session.user as any;
    const userId = user.id || user.userId || user.sub;

    setIsCancelling(true);
    try {
      await apiCancelSubmission(Number(labIdResolved), Number(userId));
      setIsSubmitted(false);
      setTcResults([]);
      
      try {
        const apiResponse = await apiGetSubmissionsByLab(labIdResolved);
        const allSubs = apiResponse?.data?.[0]?.submissions || apiResponse?.submissions || apiResponse?.data || [];
        const arrSubs = Array.isArray(allSubs) ? allSubs : (Array.isArray(apiResponse) ? apiResponse : []);
        const mySubs = (arrSubs ?? []).filter((s: any) => Number(s.userId) === Number(userId));
        if (mySubs.length > 0) {
          setIsSubmitted(true);
          setTcResults(mySubs);
        }
      } catch { /* ignore */ }

      alert("ยกเลิกการส่งงานเรียบร้อย");
    } catch (err: any) {
      console.error("Unsubmit error:", err);
      alert(`ไม่สามารถยกเลิกการส่งงานได้: ${err?.message ?? "Unknown error"}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const totalPoints = testCases.reduce((s, t) => s + (t.score ?? 0), 0);
  const labTitle = lab?.labname ?? lab?.name ?? `Lab ${labIdResolved}`;
  const labProblem = lab?.problemSolving ?? lab?.problem ?? "";
  const dueText = lab?.dueDate ?? lab?.dateline ?? undefined;

  const symbolLabData = lab ? {
    inSymVal: lab.inSymVal ?? 0,
    outSymVal: lab.outSymVal ?? 0,
    declareSymVal: lab.declareSymVal ?? 0,
    assignSymVal: lab.assignSymVal ?? 0,
    ifSymVal: lab.ifSymVal ?? 0,
    forSymVal: lab.forSymVal ?? 0,
    whileSymVal: lab.whileSymVal ?? 0,
  } : undefined;

  const renderStatusBadge = (status: string) => {
    if (!status) return <span className="text-gray-300 font-mono">-</span>;
    const s = String(status).toUpperCase();
    
    let styles = "bg-gray-100 text-gray-500 border-gray-200";
    let icon = null;

    if (["PASS", "PASSED", "CORRECT", "OK", "SUCCESS"].includes(s)) {
      styles = "bg-emerald-50 text-emerald-700 border-emerald-200";
      icon = <FaCheckCircle className="mr-1" />;
    } else if (["FAIL", "FAILED", "INCORRECT", "WRONG"].includes(s)) {
      styles = "bg-red-50 text-red-700 border-red-200";
      icon = <FaExclamationCircle className="mr-1" />;
    } else if (["ERROR", "ERR", "TIMEOUT", "CRASH"].includes(s)) {
      styles = "bg-amber-50 text-amber-700 border-amber-200";
      icon = <FaExclamationCircle className="mr-1" />;
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${styles}`}>
        {icon} {s}
      </span>
    );
  };

  // --- Render ---
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
                                <span className="w-2 h-2 rounded-full bg-blue-500 "></span>
                                <span className="font-medium text-gray-700">{totalPoints} Points</span>
                             </div>
                             <div className="hidden md:block w-[1px] h-4 bg-gray-300"></div>
                             <div className="flex items-center gap-1.5">
                                <FaCalendarAlt className="text-gray-400" />
                                <span>Due: {formatDueDate(dueText)}</span>
                             </div>
                             {isSubmitted && (
                                <>
                                  <div className="hidden md:block w-[1px] h-4 bg-gray-300"></div>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                                    Submitted
                                  </span>
                                </>
                             )}
                        </div>
                    </div>
                </div>

                {/* Buttons Group */}
                <div className="flex items-center gap-3 w-full md:w-auto self-end md:self-center">
                    <button
                      onClick={handleClick}
                      disabled={loading || isStarting || isSubmitted}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all
                        ${loading || isStarting || isSubmitted 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                            : 'bg-white border border-indigo-200 text-blue-600  hover:bg-indigo-50 hover:border-indigo-300'
                        }`}
                    >
                       {isStarting ? <FaSpinner className="animate-spin" /> : <FaPlay size={12} />} 
                       {isStarting ? "Creating..." : "Do Lab"}
                    </button>

                    {isSubmitted ? (
                        <button
                          onClick={handleUnsubmit}
                          disabled={isCancelling}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-70"
                        >
                            {isCancelling ? <FaSpinner className="animate-spin" /> : <FaTimes />}
                            {isCancelling ? "Cancelling..." : "Unsubmit"}
                        </button>
                    ) : (
                        <button
                          onClick={handleSubmit}
                          disabled={isSubmitting || loading}
                          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm text-white transition-all hover:shadow-md hover:-translate-y-0.5
                            ${isSubmitting || loading 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-blue-600  to-blue-600 hover:from-blue-700  hover:to-blue-700 '
                            }`}
                        >
                          {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaPaperPlane size={12} />}
                          {isSubmitting ? "Sending..." : "Submit"}
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Problem Description */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
                    <div className="w-1 h-5 bg-orange-400 rounded-full"></div>
                    <h3 className="text-lg font-bold text-gray-800">Problem Description</h3>
                </div>
                <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {labProblem || <span className="text-gray-400 italic">No description available for this lab.</span>}
                </div>
            </div>

            {/* 3. Test Cases */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-lg font-bold text-gray-800">Test Cases</h3>
                    </div>
                </div>
                
                {loading && <div className="p-8 text-center text-gray-400 animate-pulse">Loading data...</div>}
                {error && <div className="p-6 text-center text-red-500 bg-red-50 m-4 rounded-xl border border-red-100">Error: {error}</div>}

                {!loading && !error && (
                  <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-16">No.</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Input</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Output</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Score</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100 text-sm">
                          {testCases.length > 0 ? (
                            testCases.map((tc, index) => {
                                const result = tcResults[index];
                                const status = result?.status || "";
                                const obtainedScore = result?.score ?? 0;
                                const maxScore = tc.score;

                                return (
                                  <tr key={tc.no} className="hover:bg-gray-50/80 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-500">{tc.no}</td>
                                    <td className="px-6 py-4">
                                      <code className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono border border-gray-200">
                                        {tc.input}
                                      </code>
                                    </td>
                                    <td className="px-6 py-4">
                                      <code className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono border border-blue-100">
                                        {tc.output}
                                      </code>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      {isSubmitted ? (
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm border
                                          ${obtainedScore === maxScore 
                                            ? "bg-green-50 text-green-700 border-green-200" 
                                            : obtainedScore > 0 
                                              ? "bg-amber-50 text-amber-700 border-amber-200"
                                              : "bg-red-50 text-red-600 border-red-200"
                                          }
                                        `}>
                                          {obtainedScore} / {maxScore}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                          {maxScore} pts
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {renderStatusBadge(status)}
                                    </td>
                                  </tr>
                                );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No test cases found.</td>
                            </tr>
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
                        <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
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