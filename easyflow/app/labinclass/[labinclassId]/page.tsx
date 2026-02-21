"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { FaFilter, FaCheck, FaTimes, FaSearch, FaChevronDown, FaSpinner, FaExclamationTriangle, FaQuestionCircle, FaInfoCircle, FaCube, FaPlus } from "react-icons/fa";
import { IoCheckmarkCircle, IoCloseCircle, IoRemoveCircleOutline } from "react-icons/io5";
import Link from "next/link";
import SymbolSection from "./_components/SymbolSection";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";

import { 
  apiGetLab, 
  apiGetTestcases, 
  apiGetSubmissionDetailsByLab, 
  apiConfirmSubmission,
  apiRejectSubmission
} from "@/app/service/FlowchartService";

// --- Interfaces ---
interface TestCase {
  testcaseId: number;
  no: number;
  input: string;
  output: string;
  score: number;
}

interface PageLabData {
  labId: number;
  labname: string;
  detail: string;
  totalScore: number;
  testCases: TestCase[];
  inSymVal: number;
  outSymVal: number;
  declareSymVal: number;
  assignSymVal: number;
  ifSymVal: number;
  forSymVal: number;
  whileSymVal: number;
}

interface TestResult {
  status: string;
  score: number;   
  maxScore: number; 
}

interface StudentSubmission {
  studentId: number | string | undefined;
  submissionId?: number | string;
  name: string;
  status: string; 
  score: number;
  maxScore: number;
  selected: boolean;
  results: TestResult[]; 
}

type ModalVariant = "danger" | "success" | "info";

// --- Main Component ---
function LabInClass() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  
  const rawId = params?.labinclassId;
  const labId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [labData, setLabData] = useState<PageLabData | null>(null);
  const [students, setStudents] = useState<StudentSubmission[]>([]);
  const [filterStatus, setFilterStatus] = useState("All");
  const [error, setError] = useState<string | null>(null);

  // processing state for confirm/reject actions
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [processingType, setProcessingType] = useState<"confirm" | "reject" | null>(null);

  // --- Modal state (use same pattern as StudentLabPage) ---
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalAction, setModalAction] = useState<(() => Promise<void> | void) | null>(null);
  const [modalVariant, setModalVariant] = useState<ModalVariant>("info");

  const openModal = (title: string, message: string, action: (() => Promise<void> | void) | null = null, variant: ModalVariant = "info") => {
    setModalTitle(title);
    setModalMessage(message);
    setModalAction(() => action);
    setModalVariant(variant);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalTitle("");
    setModalMessage("");
    setModalAction(null);
    setModalVariant("info");
  };
  // --- end modal ---

  const fetchData = useCallback(async () => {
    if (!labId) return;
    
    try {
      setError(null);
      // keep page-level loading as originally used
      // but we set studentsLoading around submissions fetch
      const [labResp, tcResp] = await Promise.all([
         apiGetLab(String(labId)),
         apiGetTestcases(String(labId))
      ]);

      const remoteLab = labResp?.lab ?? labResp ?? null;
      
      let tcs: TestCase[] = [];
      const rawTcs = Array.isArray(tcResp) ? tcResp : (tcResp?.data ?? remoteLab?.testcases ?? []);
      
      tcs = rawTcs.map((tc: any, index: number) => ({
          testcaseId: tc.testcaseId ?? tc.id,
          no: index + 1,
          input: String(tc.inputVal || tc.input || ""),
          output: String(tc.outputVal || tc.output || ""),
          score: Number(tc.score || 0)
      }));

      const totalScore = tcs.reduce((acc, tc) => acc + tc.score, 0);

      setLabData({
          labId: Number(labId),
          labname: remoteLab?.labname ?? remoteLab?.name ?? "Unknown Lab",
          detail: remoteLab?.problemSolving ?? remoteLab?.problem ?? "",
          totalScore: totalScore,
          testCases: tcs,
          inSymVal: remoteLab?.inSymVal ?? 0,
          outSymVal: remoteLab?.outSymVal ?? 0,
          declareSymVal: remoteLab?.declareSymVal ?? 0,
          assignSymVal: remoteLab?.assignSymVal ?? 0,
          ifSymVal: remoteLab?.ifSymVal ?? 0,
          forSymVal: remoteLab?.forSymVal ?? 0,
          whileSymVal: remoteLab?.whileSymVal ?? 0,
      });

      // --- Fetch Submissions ---
      setStudentsLoading(true);
      try {
        const subResp = await apiGetSubmissionDetailsByLab(String(labId));
        const rawData = subResp?.data ?? subResp ?? [];
        const rawSubs = Array.isArray(rawData) ? rawData : [];

        const mappedStudents: StudentSubmission[] = rawSubs.map((item: any) => {
            const userObj = item.user || item.User || item.student || item.Student || item;
            const join = (f: any, l: any) => `${f || ""} ${l || ""}`.trim();

            let studentName = "Unknown Student";
            if (item.userName) studentName = item.userName;
            else if (userObj.firstname || userObj.lastname) studentName = join(userObj.firstname, userObj.lastname);
            else if (userObj.firstName || userObj.lastName) studentName = join(userObj.firstName, userObj.lastName);
            else if (userObj.name) studentName = userObj.name;
            else if (userObj.username) studentName = userObj.username;
            else if (userObj.email) studentName = userObj.email;

            const rawResults = item.testcases || item.results || item.submission?.results || [];

            let finalStatus = "PENDING"; 
            if (item.status) finalStatus = item.status;
            else if (item.submission?.status) finalStatus = item.submission.status;
            else if (Array.isArray(item.submissions) && item.submissions.length > 0) finalStatus = item.submissions[0].status;

            if ((!finalStatus || finalStatus === "PENDING") && rawResults.length > 0) {
                const firstTc = rawResults[0];
                if (firstTc && firstTc.status) {
                    finalStatus = firstTc.status;
                }
            }

            const score = item.totalScore ?? item.submission?.score ?? 0;
            const submissionId = item.flowchartId ?? item.submission?.id ?? item.submissionId ?? undefined;

            const results: TestResult[] = tcs.map((tc) => {
                const match = rawResults.find((r: any) => {
                    if (r.testcaseId !== undefined) return r.testcaseId === tc.testcaseId;
                    return false;
                });
                const rStatus = match?.status ?? "PENDING";
                let rScore = 0;
                if (match?.scoreAwarded !== undefined) rScore = Number(match.scoreAwarded);
                else if (match?.score !== undefined) rScore = Number(match.score);
                else if (rStatus === "PASS" || rStatus === "CONFIRMED") rScore = tc.score;

                return { 
                    status: rStatus,
                    score: rScore,
                    maxScore: tc.score
                };
            });

            const studentId = item.userId ?? userObj.id ?? userObj.userId ?? userObj.studentId;

            return {
                studentId: studentId,
                submissionId: submissionId,
                name: studentName,
                status: finalStatus || "Pending", 
                score: score,
                maxScore: totalScore,
                selected: false,
                results: results
            };
        });

        setStudents(mappedStudents);
      } catch (subErr) {
        console.error("Failed to fetch submissions:", subErr);
        setStudents([]);
        // do not override overall error unless needed
      } finally {
        setStudentsLoading(false);
      }

    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      setError(String(err?.message ?? err ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [labId]);

  useEffect(() => {
      setLoading(true);
      fetchData();
  }, [fetchData]);

  // --- Handlers ---
  const handleSelectAll = (checked: boolean) => {
    const updated = students.map((std) =>
      (filterStatus === "All" || std.status.toLowerCase() === filterStatus.toLowerCase())
        ? { ...std, selected: checked }
        : std
    );
    setStudents(updated);
  };

  // toggle selection by stable key (prefer submissionId, fallback to studentId)
  const handleSelectStudent = (key: string | number | undefined) => {
    if (key === undefined) return;
    setStudents((prev) =>
      prev.map((s) => {
        const myKey = s.submissionId ?? s.studentId;
        if (String(myKey) === String(key)) {
          return { ...s, selected: !s.selected };
        }
        return s;
      })
    );
  };

  const handleSubmitAll = async () => {
    const user = session?.user as any;
    const reviewerId = user?.id || user?.userId || user?.sub;
    if (!reviewerId) {
      openModal("กรุณา Login ใหม่", "กรุณา Login ใหม่", null, "info");
      return;
    }

    const selectedStudents = students.filter(s => s.selected);
    if (selectedStudents.length === 0) return;

    // split into those with valid userId and those without
    const withUserId = selectedStudents.filter(s => s.studentId !== undefined && s.studentId !== null && s.studentId !== "");
    const withoutUserId = selectedStudents.filter(s => !(s.studentId !== undefined && s.studentId !== null && s.studentId !== ""));

    if (withUserId.length === 0) {
      openModal("ไม่มี studentId ที่ถูกต้อง", "ไม่มี studentId ที่ถูกต้องสำหรับการส่งคำขอ Pass — ยกเลิกการทำงาน", null, "danger");
      return;
    }

    // Prepare modal message and action (action executes only for withUserId)
    const message = withoutUserId.length > 0
      ? `${withUserId.length} รายการจะถูกส่งสำหรับการ 'Pass' แต่ ${withoutUserId.length} รายการจะถูกข้าม (ไม่มี userId). ดำเนินการต่อหรือไม่?`
      : `ยืนยันการให้ผ่าน (Pass) นักเรียน ${withUserId.length} คน?`;

    const action = async () => {
      setIsProcessingAction(true);
      setProcessingType("confirm");

      const failed: Array<{ id: string | number | undefined; error: any }> = [];
      await Promise.all(withUserId.map(async (student) => {
        try {
          // call API with studentId (user id). This avoids FK violation from sending submissionId as userId.
          await apiConfirmSubmission(String(labId), String(student.studentId), String(reviewerId));
        } catch (err) {
          console.error("confirm error for", student.studentId, err);
          failed.push({ id: student.studentId ?? student.submissionId, error: err });
        }
      }));

      setIsProcessingAction(false);
      setProcessingType(null);

      if (failed.length > 0) {
        openModal("บางรายการไม่สำเร็จ", `บางรายการไม่สำเร็จ: ${failed.length} รายการ (ดู console สำหรับรายละเอียด)`, null, "danger");
      } else {
        openModal("Success!", "Success!", null, "success");
      }

      await fetchData();
    };

    openModal("ยืนยันการให้ผ่าน", message, action, "info");
  };

  const handleRejectAll = async () => {
    const user = session?.user as any; 
    const reviewerId = user?.id || user?.userId || user?.sub;
    if (!reviewerId) {
      openModal("กรุณา Login ใหม่", "กรุณา Login ใหม่", null, "info");
      return;
    }

    const selectedStudents = students.filter(s => s.selected);
    if (selectedStudents.length === 0) return;

    const withUserId = selectedStudents.filter(s => s.studentId !== undefined && s.studentId !== null && s.studentId !== "");
    const withoutUserId = selectedStudents.filter(s => !(s.studentId !== undefined && s.studentId !== null && s.studentId !== ""));

    if (withUserId.length === 0) {
      openModal("ไม่มี studentId ที่ถูกต้อง", "ไม่มี studentId ที่ถูกต้องสำหรับการส่งคำขอ Reject — ยกเลิกการทำงาน", null, "danger");
      return;
    }

    const message = withoutUserId.length > 0
      ? `${withUserId.length} รายการจะถูกส่งสำหรับการ 'Reject' แต่ ${withoutUserId.length} รายการจะถูกข้าม (ไม่มี userId). ดำเนินการต่อหรือไม่?`
      : `ยืนยันการปฏิเสธ (Reject) นักเรียน ${withUserId.length} คน?`;

    const action = async () => {
      setIsProcessingAction(true);
      setProcessingType("reject");

      const failed: Array<{ id: string | number | undefined; error: any }> = [];
      await Promise.all(withUserId.map(async (student) => {
        try {
          await apiRejectSubmission(String(labId), String(student.studentId), String(reviewerId));
        } catch (err) {
          console.error("reject error for", student.studentId, err);
          failed.push({ id: student.studentId ?? student.submissionId, error: err });
        }
      }));

      setIsProcessingAction(false);
      setProcessingType(null);

      if (failed.length > 0) {
        openModal("บางรายการไม่สำเร็จ", `บางรายการไม่สำเร็จ: ${failed.length} รายการ (ดู console สำหรับรายละเอียด)`, null, "danger");
      } else {
        openModal("Rejected successfully", "Rejected successfully", null, "success");
      }

      await fetchData();
    };

    openModal("ยืนยันการปฏิเสธ", message, action, "danger");
  };

  const handleViewStudent = (submissionId?: number | string) => {
      if (submissionId) router.push(`/Dolab/${submissionId}`);
  };

  const filteredStudents = filterStatus === "All"
      ? students
      : students.filter((student) => student.status.toLowerCase() === filterStatus.toLowerCase());

  const isAllChecked = filteredStudents.length > 0 && filteredStudents.every((s) => s.selected);
  const selectedCount = students.filter(s => s.selected).length;

  // <-- Added "Error" option here -->
  const filterOptions = ["All", "Confirmed", "Pass", "Submitted", "Pending", "Fail", "Error"];

  const renderStatusBadge = (status: string) => {
      const s = String(status || "").toUpperCase();
      let badgeStyle = "bg-gray-100 text-gray-600 border-gray-200"; 
      let dotColor = "bg-gray-400";

      if (["PASS", "PASSED", "CONFIRMED", "GRADED", "SUCCESS"].includes(s)) {
          badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
          dotColor = "bg-emerald-500";
      }
      // <-- include ERROR in fail group so it shows red -->
      else if (["FAIL", "FAILED", "REJECTED", "WRONG", "ERROR"].includes(s)) {
          badgeStyle = "bg-red-50 text-red-700 border-red-200";
          dotColor = "bg-red-500";
      }
      else if (["SUBMITTED", "SUBMIT"].includes(s)) {
          badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";
          dotColor = "bg-blue-500";
      }
      else if (["PENDING", "WAITING", "UNKNOWN"].includes(s) || s === "") {
          badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
          dotColor = "bg-amber-500";
      }

      return (
          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border inline-flex items-center gap-2 capitalize ${badgeStyle}`}>
              <span className={`w-2 h-2 rounded-full ${s === "PENDING" ? "animate-pulse" : ""} ${dotColor}`}></span>
              {status?.toLowerCase() || "pending"}
          </span>
      );
  };

  // NOTE: removed the early full-page loading and "lab not found" returns
  // so the UI renders immediately and only section-level spinners/placeholders appear.

  return (
    <div className="min-h-screen w-full bg-[#F9FAFB]">
      <div className="pt-20 pl-0 md:pl-64 transition-all duration-300">
        <Navbar />
        <Sidebar />
        
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
            
          {/* Header Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-red-50 to-white rounded-xl flex items-center justify-center flex-shrink-0 border border-red-100 shadow-sm">
                <img src="/images/lab.png" className="w-7 h-auto object-contain" alt="Lab Icon" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">{labData?.labname ?? (loading ? 'Loading...' : 'Lab not found')}</h1>
                <div className="flex items-center gap-3 mt-1.5 text-sm">
                    <span className="text-gray-300">|</span>
                    <span className="font-medium text-gray-700">{labData ? `${labData.totalScore} Points` : (loading ? '...' : '0 Points')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Section (Full Width) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
                <div className="w-1 h-5 bg-red-500 rounded-full"></div>
                <h3 className="text-base font-bold text-gray-800">Problem Description</h3>
            </div>

            {/* If still loading and no labData yet, show a section-level loader rather than full-page loader */}
            {loading && !labData ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
                <div>Loading lab details...</div>
              </div>
            ) : (
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm">
                  {labData?.detail || "No details provided."}
              </p>
            )}

            {/* Test Cases Table (Inside Details) */}
            {labData?.testCases && labData.testCases.length > 0 ? (
                <div className="mt-6 border rounded-xl overflow-hidden border-gray-100">
                    <div className="px-4 py-3 bg-gray-50/50 text-xs font-semibold text-gray-500 border-b border-gray-100 uppercase tracking-wider">
                        Test Cases Reference
                    </div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-white">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">No.</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Input</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Output</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {labData.testCases.map((tc, index) => (
                                <tr key={index}>
                                    <td className="px-4 py-2 text-xs text-gray-500">{tc.no}</td>
                                    <td className="px-4 py-2 text-xs font-mono text-gray-700 bg-gray-50/30">{tc.input}</td>
                                    <td className="px-4 py-2 text-xs font-mono text-blue-600">{tc.output}</td>
                                    <td className="px-4 py-2 text-xs text-center font-bold text-gray-900">{tc.score}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            ) : (
              // When labData exists but has no test cases, show nothing (preserves UI). If labData is null and not loading, show a small notice.
              labData ? null : (!loading && (
                <div className="mt-6 border rounded-xl overflow-hidden border-gray-100 px-6 py-8 text-center text-sm text-gray-400">Lab not found or no test cases available.</div>
              ))
            )}
          </div>

          {/* Student Submissions Table (Full Width) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            
            {/* Toolbar */}
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-red-500 transition-colors">
                            <FaFilter />
                        </div>
                        <select
                          className="pl-10 pr-10 py-2.5 text-sm border-gray-200 bg-gray-50 rounded-xl text-gray-700 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer hover:bg-gray-100 hover:border-gray-300 border w-full sm:w-48 appearance-none"
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                        >
                          {filterOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                           <FaChevronDown size={10} />
                        </div>
                    </div>
                    <div className="h-8 w-[1px] bg-gray-200 hidden sm:block"></div>
                    <div className="text-sm text-gray-500 font-medium hidden sm:block">
                        Total: <span className="text-gray-900">{filteredStudents.length}</span>
                    </div>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                    <button
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                        ${selectedCount > 0
                            ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 shadow-sm"
                            : "bg-gray-50 text-gray-300 border border-transparent cursor-not-allowed"
                        }`}
                        onClick={handleRejectAll}
                        disabled={selectedCount === 0 || isProcessingAction}
                    >
                        {isProcessingAction && processingType === "reject" ? <FaSpinner className="animate-spin" /> : <FaTimes size={14} />} 
                        {isProcessingAction && processingType === "reject" ? ` Rejecting (${selectedCount})` : ` Reject (${selectedCount})`}
                    </button>

                    <button
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm
                        ${selectedCount > 0
                            ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md hover:-translate-y-0.5"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                        onClick={handleSubmitAll}
                        disabled={selectedCount === 0 || isProcessingAction}
                    >
                        {isProcessingAction && processingType === "confirm" ? <FaSpinner className="animate-spin" /> : <FaCheck size={14} />} 
                        {isProcessingAction && processingType === "confirm" ? ` Processing (${selectedCount})` : ` Confirm (${selectedCount})`}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto relative">
              {/* studentsLoading overlay / inline loader */}
              {studentsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <div>Loading submissions...</div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left w-14">
                          <div className="flex items-center">
                              <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer transition-colors"
                                  checked={isAllChecked}
                                  onChange={(e) => handleSelectAll(e.target.checked)}
                              />
                          </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[200px]">Student Info</th>
                      { (labData?.testCases ?? []).map((tc, idx) => (
                           <th key={idx} className="px-2 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider w-16">
                              <span className="block" title={`Input: ${tc.input}`}>TC{tc.no}</span>
                           </th>
                      ))}
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Score</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredStudents.length === 0 ? (
                        <tr><td colSpan={10} className="px-6 py-16 text-center text-gray-400 italic bg-gray-50/30">No students found matching your filter.</td></tr>
                    ) : (
                        filteredStudents.map((student, index) => {
                          // use submissionId as primary key, fallback to studentId, then index
                          const uniqueKey = student.submissionId ?? student.studentId ?? index;
                          const keyForStudent = student.submissionId ?? student.studentId;

                          return (
                            <tr key={String(uniqueKey)} className={`group hover:bg-gray-50 transition-colors duration-150 ${student.selected ? 'bg-red-50/40' : ''}`}>
                              <td className="px-6 py-4 whitespace-nowrap align-middle">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                  checked={!!student.selected}
                                  onChange={() => handleSelectStudent(keyForStudent)}
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap align-middle">
                                  {renderStatusBadge(student.status)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap align-middle">
                                  <div className="flex flex-col">
                                      <span className="text-sm font-semibold text-gray-900">{student.name}</span>
                                  </div>
                              </td>
                              
                              {/* Dynamic Test Case Columns - SHOW SCORE AS "got / max" */}
                              {(labData?.testCases ?? []).map((tc, idx2) => {
                                  const res = student.results[idx2];
                                  const got = (res?.score !== undefined && res?.score !== null) ? res.score : 0;
                                  const max = (res?.maxScore !== undefined && res?.maxScore !== null) ? res.maxScore : tc.score;

                                  const isPass = res?.status === "PASS" || res?.status === "CONFIRMED";
                                  const isFail = res?.status === "FAIL" || res?.status === "REJECTED";

                                  let scoreTextClasses = "text-sm font-mono text-gray-700";
                                  if (got === max && max > 0) scoreTextClasses = "text-sm font-mono font-semibold text-emerald-600";
                                  else if ((isFail || got === 0) && !isPass) scoreTextClasses = "text-sm font-mono text-red-600";

                                  return (
                                      <td key={idx2} className="px-2 py-4 whitespace-nowrap text-center align-middle">
                                          <div className="flex justify-center items-center">
                                              <span className={scoreTextClasses}>{got}/{max}</span>
                                          </div>
                                      </td>
                                  );
                              })}
                              
                              <td className="px-6 py-4 whitespace-nowrap text-right align-middle">
                                  <div className="inline-flex items-baseline gap-1">
                                      <span className={`font-bold text-base ${student.score === student.maxScore ? 'text-emerald-600' : 'text-gray-900'}`}>
                                          {student.score}
                                      </span>
                                      <span className="text-gray-400 text-xs font-medium">/ {student.maxScore}</span>
                                  </div>
                              </td>
                              
                              <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                                <button 
                                  onClick={() => handleViewStudent(student.submissionId)}
                                  disabled={!student.submissionId}
                                  className={`text-xs px-4 py-2 rounded-lg font-medium transition-all border ${
                                      student.submissionId 
                                      ? "border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 bg-white shadow-sm" 
                                      : "border-transparent text-gray-300 bg-gray-50 cursor-not-allowed"
                                  }`}
                                >
                                  Review
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 text-xs text-gray-500 flex justify-between items-center">
                <span>Showing <span className="font-semibold text-gray-700">{filteredStudents.length}</span> students</span>
                <span className={`${selectedCount > 0 ? 'text-red-600 font-medium' : ''}`}>
                    {selectedCount > 0 ? `${selectedCount} selected` : 'No items selected'}
                </span>
            </div>
          </div>

{/* Configuration Section (Moved to Bottom) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-10">
               <div className="flex items-center gap-2 mb-6 border-b border-gray-50 pb-3">
                    <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                    <h2 className="text-lg font-bold text-gray-800">Configuration</h2>
               </div>
               <SymbolSection labData={labData} />
          </div>

        </div>
      </div>

      {/* Modal (AnimatePresence) - same visual pattern as StudentLabPage */}
      <AnimatePresence>
        {modalVisible && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-modal="true"
            role="dialog"
            onClick={() => { /* do nothing on backdrop click */ }}
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-hidden
            />

            <motion.div
              className="relative z-50 w-full max-w-lg mx-auto transform"
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              role="document"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
                <div className={`px-6 pt-8 pb-6 flex flex-col items-center ${modalVariant === "danger" ? "bg-red-50" : modalVariant === "success" ? "bg-green-50" : "bg-blue-50"}`}>
                  <div className={`flex items-center justify-center w-20 h-20 rounded-xl ${modalVariant === "danger" ? "bg-red-600" : modalVariant === "success" ? "bg-green-600" : "bg-blue-600"} shadow-md`}>
                    {modalVariant === "danger" ? (
                      <FaCube size={36} className="text-white" />
                    ) : (
                      <FaPlus size={36} className="text-white" />
                    )}
                  </div>

                  <h3 className={`mt-4 text-2xl font-extrabold ${modalVariant === "danger" ? "text-red-700" : modalVariant === "success" ? "text-green-700" : "text-blue-700"}`}>
                    {modalTitle}
                  </h3>
                </div>

                <div className="px-6 pb-6 pt-4">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap text-center">
                    {modalMessage}
                  </p>

                  <div className="w-full border-t border-gray-200 my-4" />

                  <div className="mt-6 flex items-center justify-center gap-4">
                    <button
                      onClick={closeModal}
                      className="inline-flex items-center justify-center px-6 py-2 rounded-full border border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 text-sm font-medium shadow-sm"
                    >
                      ยกเลิก
                    </button>

                    {modalAction && (
                      <button
                        onClick={async () => {
                          try {
                            if (modalAction) await modalAction();
                          } catch (err) {
                            console.error("modal action error:", err);
                          } finally {
                            closeModal();
                          }
                        }}
                        className={`inline-flex items-center justify-center px-6 py-2 rounded-full text-white focus:outline-none focus:ring-2 focus:ring-offset-2 text-sm font-medium shadow-sm ${modalVariant === "danger" ? "bg-red-600 hover:bg-red-700 focus:ring-red-200" : modalVariant === "success" ? "bg-green-600 hover:bg-green-700 focus:ring-green-200" : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-200"}`}
                      >
                        ยืนยัน
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={closeModal}
                  aria-label="close"
                  className="absolute top-4 right-4 bg-white border border-gray-200 rounded-full w-9 h-9 flex items-center justify-center shadow"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6 6L18 18M6 18L18 6" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LabInClass;