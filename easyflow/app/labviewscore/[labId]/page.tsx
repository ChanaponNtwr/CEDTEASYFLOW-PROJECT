// app/(somepath)/Labviewscore.tsx
"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";
import { apiGetTestcases, apiGetLab } from "@/app/service/FlowchartService";
import { useSearchParams, usePathname } from "next/navigation";

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

export default function Labviewscore() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // resolve labId from query or pathname (flexible)
  const resolveLabId = (): string | null => {
    // 1) common query params
    const qCandidates = ["labId", "lab", "id"];
    for (const k of qCandidates) {
      const v = searchParams?.get(k);
      if (v) return v;
    }

    // 2) try parse from pathname segments
    try {
      const parts = pathname?.split("/").filter(Boolean) ?? [];
      if (parts.length === 0) return null;

      // if path contains 'labs' or 'lab' take the next segment
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].toLowerCase();
        if ((p === "labs" || p === "lab" || p === "labs-list") && parts[i + 1]) {
          return parts[i + 1];
        }
      }

      // otherwise prefer any numeric segment (e.g. /something/16/)
      const numeric = parts.find((seg) => /^\d+$/.test(seg));
      if (numeric) return numeric;

      // fallback: last segment (if looks like id-ish)
      const last = parts[parts.length - 1];
      if (last) return last;
    } catch {
      // ignore
    }
    return null;
  };

  const labIdResolved = resolveLabId();

  const [lab, setLab] = useState<RemoteLab | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [symbols, setSymbols] = useState({ input: 0, output: 0, declare: 0, assign: 0, if: 0 });

  // parsing helpers (robust)
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

  const updateSymbolCount = (newSymbols: { input: number; output: number; declare: number; assign: number; if: number }) =>
    setSymbols(newSymbols);

  useEffect(() => {
    if (!labIdResolved) return;

    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.info("Resolved labId:", labIdResolved);

        const labResp = await apiGetLab(String(labIdResolved));
        console.debug("apiGetLab:", labResp);
        const remoteLab: RemoteLab = labResp?.lab ?? labResp ?? null;
        if (!mounted) return;
        setLab(remoteLab);

        // prefer embedded testcases, otherwise call apiGetTestcases
        let list: any[] = [];
        if (remoteLab && (remoteLab.testcases || remoteLab.testCases)) {
          list = remoteLab.testcases ?? remoteLab.testCases ?? [];
        } else {
          const tcResp = await apiGetTestcases(String(labIdResolved));
          console.debug("apiGetTestcases:", tcResp);
          list = Array.isArray(tcResp) ? tcResp : tcResp?.data ?? tcResp?.testcases ?? tcResp ?? [];
        }

        const mapped = (list ?? []).map((tc: any, idx: number) => {
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

        if (!mounted) return;
        setTestCases(mapped);
      } catch (err: any) {
        console.error("Labviewscore fetch error:", err);
        if (mounted) setError(err?.message ?? "Failed to load lab/testcases");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labIdResolved]);

  // If still no labIdResolved, show helpful message + examples
  if (!labIdResolved) {
    return (
      <div className="min-h-screen w-full bg-gray-100 flex items-center justify-center">
        <div className="w-full max-w-lg bg-white p-6 rounded-lg shadow-md text-center space-y-4">
          <h2 className="text-2xl font-semibold">Missing labId</h2>
          <p className="text-gray-600">This page requires a <code>labId</code>. Provide it in the URL in one of these ways:</p>

          <div className="space-y-2">
            <div>
              <a href={`/labview?labId=16`} className="text-blue-600 underline">/labview?labId=16</a> — query param `labId`
            </div>
            <div>
              <a href={`/labs/16`} className="text-blue-600 underline">/labs/16</a> — path segment (will be parsed)
            </div>
            <div>
              <a href={`/lab/16`} className="text-blue-600 underline">/lab/16</a> — path segment variant
            </div>
          </div>

          <div className="text-sm text-gray-500">
            If you're using Next.js dynamic route like <code>app/labs/[labId]/page.tsx</code>, use <code>useParams()</code> server-side or ensure the client receives the id via query/path.
          </div>

          <div className="pt-3">
            <Link href="/labs" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Go to labs list</Link>
          </div>
        </div>
      </div>
    );
  }

  const totalPoints = testCases.reduce((s, t) => s + (t.score ?? 0), 0);
  const labTitle = lab?.labname ?? lab?.name ?? `Lab ${labIdResolved}`;
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
              {/* Buttons: View Score + Edit */}
              <div className="flex justify-end space-x-4 mb-6">
                <Link
                  href={`/labinclass?labId=${encodeURIComponent(String(labIdResolved))}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center hover:bg-blue-700"
                >
                  {/* Eye icon */}
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Score
                </Link>

                <Link
                  href={`/editlab?labId=${encodeURIComponent(String(labIdResolved))}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
                    {labTitle} <span className="text-xs">({totalPoints} points)</span>
                  </h2>
                </div>
                <p className="text-gray-500 text-sm">{dueText ? formatDueDate(dueText) : "No due date"}</p>
              </div>

              <div className="ml-0 md:ml-10">
                <p className="mb-6 text-gray-700">{labProblem || "รายละเอียดการบ้านยังไม่มี"}</p>
                <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

                {loading && <div className="mb-4 text-sm text-gray-600">Loading testcases...</div>}
                {error && <div className="mb-4 text-sm text-red-600">Error: {error}</div>}

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
                      {testCases.length === 0 && !loading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No testcases found for this lab.</td>
                        </tr>
                      ) : (
                        testCases.map((testCase, index) => (
                          <tr key={testCase.no} className={`transition-colors duration-150 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                            <td className="font-semibold px-6 py-4 whitespace-nowrap text-sm text-gray-600">{testCase.no}</td>
                            <td className="font-semibold px-6 py-4 text-sm text-gray-700"><span className="px-2 py-1 rounded text-xs text-gray-800">{testCase.input}</span></td>
                            <td className="font-semibold px-6 py-4 text-sm text-gray-700"><span className="px-2 py-1 rounded text-xs text-blue-800">{testCase.output}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-center"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-800">{testCase.score} pts</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="pt-5">
                  <h1 className="text-2xl font-bold text-gray-700 mb-2">Symbols</h1>
                  <SymbolSection onChange={updateSymbolCount}  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
