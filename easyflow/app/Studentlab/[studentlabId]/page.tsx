"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection"; 

import { 
  apiGetTestcases, 
  apiGetLab, 
  apiPostFlowchart, 
  apiGetSubmissionsByLab // ✅ ต้อง import อันนี้
} from "@/app/service/FlowchartService";

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
  isSubmitted?: boolean;
  submission?: any;
  submissions?: any[];
  status?: string;
  [k: string]: any;
}

// Interface สำหรับรับผลลัพธ์จาก API
interface SubmissionResult {
  testcaseId?: number;
  status: string; // "PASS", "FAIL", "ERROR"
  output?: string;
  score?: number;
}

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
        const items = content.split(",").map((part) => {
          const p = part.trim();
          if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
            return p.slice(1, -1);
          }
          return p;
        });
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

  useEffect(() => {
    if (!labIdResolved) return;
    if (session === undefined) return; 

    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`📌 DEBUG: Fetching Lab ID: ${labIdResolved}`);
        
        // 1. ดึงข้อมูล Lab
        const labResp = await apiGetLab(labIdResolved);
        const remoteLab: RemoteLab = labResp?.lab ?? labResp ?? null;

        if (!mounted) return;
        setLab(remoteLab);

        // 2. เช็คสถานะ isSubmitted เบื้องต้น
        let submittedFlag = false;
        if (remoteLab) {
            // เช็คจาก field ต่างๆ ที่อาจจะเป็นไปได้
            const hasSubmissionsArray = Array.isArray(remoteLab.submissions) && remoteLab.submissions.length > 0;
            submittedFlag = 
                remoteLab.isSubmitted === true || 
                remoteLab.status === "SUBMITTED" || 
                remoteLab.status === "completed" ||
                hasSubmissionsArray ||
                (remoteLab.submission && Object.keys(remoteLab.submission).length > 0);
            
            setIsSubmitted(submittedFlag);
        }

        // 3. จัดการ Testcases
        let list: any[] = [];
        if (remoteLab && (remoteLab.testcases || remoteLab.testCases)) {
          list = remoteLab.testcases ?? remoteLab.testCases ?? [];
        } else {
          try {
            const tcResp = await apiGetTestcases(labIdResolved);
            list = Array.isArray(tcResp)
              ? tcResp
              : tcResp?.data ?? tcResp?.testcases ?? tcResp ?? [];
          } catch (tcErr) {
            console.warn("Could not fetch separate testcases", tcErr);
            list = [];
          }
        }

        const mappedTC = (list ?? []).map((tc: any, idx: number) => {
          const rawInput = parseVal(tc.inputVal ?? tc.input ?? tc.inHiddenVal ?? tc.inHidden ?? tc.stdin ?? tc.args ?? []);
          const rawOutput = parseVal(tc.outputVal ?? tc.output ?? tc.outHiddenVal ?? tc.outHidden ?? tc.stdout ?? tc.expected ?? []);
          const format = (v: any) => (Array.isArray(v) ? flattenDeep(v).join(", ") : String(v ?? ""));

          return {
            no: typeof tc.no === "number" ? tc.no : idx + 1,
            input: format(rawInput) || "-",
            output: format(rawOutput) || "-",
            score: Number(tc.score ?? tc.points ?? 0),
            raw: tc,
          } as TestCase;
        });

        if (mounted) {
          setTestCases(mappedTC);
        }

        // 4. 🔥🔥 ดึงข้อมูล Submission (แก้ไขตาม Log) 🔥🔥
        if (session?.user) {
            try {
                const apiResponse = await apiGetSubmissionsByLab(labIdResolved);
                console.log("📌 DEBUG: Submissions Response:", apiResponse);

                // เจาะข้อมูลตามโครงสร้าง: { ok: true, data: [ { submissions: [...] } ] }
                if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data) && apiResponse.data.length > 0) {
                    
                    // เลือกรายการแรก (หรือจะ loop หา userId ที่ตรงกับ session ก็ได้)
                    const userRecord = apiResponse.data[0];
                    console.log("📌 DEBUG: User Record found:", userRecord);

                    if (userRecord && Array.isArray(userRecord.submissions)) {
                        console.log("📌 DEBUG: Found Results:", userRecord.submissions);
                        
                        // Set ค่าผลลัพธ์
                        setTcResults(userRecord.submissions);
                        
                        // ถ้ามีผลลัพธ์ ถือว่าส่งแล้ว
                        setIsSubmitted(true);
                    }
                } else if (Array.isArray(apiResponse)) {
                    // Fallback เผื่อโครงสร้างเปลี่ยน
                    setTcResults(apiResponse);
                }

            } catch (subErr) {
                console.warn("Failed to fetch submissions:", subErr);
            }
        }

        if (mounted) setLoading(false);

      } catch (err: any) {
        console.error("Fetch error:", err);
        if (mounted) {
          setError(err?.message ?? "Failed to load lab data.");
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [labIdResolved, session]);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!session?.user) { alert("Please login first!"); return; }
    setIsStarting(true);
    try {
      const user = session.user as any;
      const userId = user.id || user.userId || user.sub; 
      const payload = { userId: Number(userId), labId: Number(labIdResolved) };
      const result = await apiPostFlowchart(payload);
      const targetId = result.id || result.flowchartId || result.trialId;
      if (targetId) router.push(`/Dolab/${targetId}`);
      else throw new Error("API did not return a valid flowchart ID");
    } catch (error: any) {
      alert(`Failed to start lab: ${error.message || "Unknown error"}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleUnsubmitMock = () => {
    if (confirm("คุณต้องการยกเลิกการส่งงานใช่หรือไม่? (UI Only)")) {
        console.log("Unsubmit button clicked");
    }
  };

  const totalPoints = testCases.reduce((s, t) => s + (t.score ?? 0), 0);
  const labTitle = lab?.labname ?? lab?.name ?? `Lab ${labIdResolved}`;
  const labProblem = lab?.problemSolving ?? lab?.problem ?? "";
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

  // ✅ Function render Badge
  const renderStatusBadge = (status: string) => {
    if (!status) return <span className="text-gray-400">-</span>;
    const s = String(status).toUpperCase();
    
    if (["PASS", "PASSED", "CORRECT", "OK", "SUCCESS"].includes(s)) {
      return <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold border border-green-200">PASS</span>;
    }
    if (["FAIL", "FAILED", "INCORRECT", "WRONG"].includes(s)) {
      return <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold border border-red-200">FAIL</span>;
    }
    if (["ERROR", "ERR", "TIMEOUT", "CRASH"].includes(s)) {
        return <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">ERROR</span>;
    }
    return <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-bold border border-gray-200">{s}</span>;
  };

  return (
    <div className="min-h-screen w-full bg-gray-100">
      <div className="pt-20 pl-60">
        <Navbar />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex justify-center p-6 md:p-10">
            <div className="w-full max-w-5xl bg-white p-8 rounded-lg shadow-md min-h-[500px]">
              
              <div className="flex justify-end space-x-3 mb-6">
                <button
                  onClick={handleClick}
                  disabled={loading || isStarting || isSubmitted}
                  className={`px-6 py-2 rounded-full flex items-center justify-center text-white transition-colors shadow-sm font-medium
                    ${loading || isStarting || isSubmitted ? 'bg-gray-400 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-700'}
                  `}
                >
                  {isStarting ? "Creating..." : "Do lab"}
                </button>

                {isSubmitted ? (
                    <button onClick={handleUnsubmitMock} className="bg-red-600 text-white px-6 py-2 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-sm font-medium">
                        Unsubmit
                    </button>
                ) : (
                    <Link href="/" className="bg-[#133384] text-white px-6 py-2 rounded-full flex items-center justify-center hover:bg-[#1945B7] transition-colors shadow-sm font-medium">
                        Submit
                    </Link>
                )}
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-gray-100 pb-4 mb-6">
                <div className="flex items-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mr-4 shadow-sm border border-blue-100">
                    <img src="/images/lab.png" className="w-8 h-10 object-contain opacity-80" alt="lab" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-800">{labTitle}</h2>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-md">
                      {totalPoints} Points
                    </span>
                    {isSubmitted && <span className="ml-2 inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-md border border-blue-200">Submitted</span>}
                  </div>
                </div>
                <div className="mt-2 md:mt-0 text-gray-500 text-sm font-medium bg-gray-50 px-3 py-1 rounded-lg">
                   Due: {formatDueDate(dueText)}
                </div>
              </div>

              <div className="pl-0 md:pl-4">
                <div className="mb-8">
                   <h3 className="text-lg font-semibold text-gray-700 mb-2">Problem Description</h3>
                   <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {labProblem || "No description available for this lab."}
                   </div>
                </div>

                {loading && (
                  <div className="flex justify-center items-center py-12">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                     <span className="ml-3 text-gray-600">Loading lab data...</span>
                  </div>
                )}
                
                {error && (
                  <div className="p-4 mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg text-center">Error: {error}</div>
                )}

                {!loading && !error && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Test Cases</h3>
                    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">No.</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Input</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Output</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {testCases.length > 0 ? (
                            testCases.map((tc, index) => {
                                // 📌 Mapping ข้อมูลจาก tcResults โดยใช้ index
                                const result = tcResults[index]; 
                                const status = result?.status || ""; 

                                return (
                                  <tr key={tc.no} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-600 font-semibold">{tc.no}</td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{tc.input}</code>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-blue-700">
                                      <code className="bg-blue-50 px-2 py-1 rounded text-xs font-mono">{tc.output}</code>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {tc.score}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {renderStatusBadge(status)}
                                    </td>
                                  </tr>
                                );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                No test cases found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!loading && !error && (
                  <div className="pt-4 border-t border-gray-100 mt-8">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Flowchart Symbols</h3>
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