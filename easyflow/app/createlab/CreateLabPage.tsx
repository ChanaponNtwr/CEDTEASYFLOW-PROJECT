"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import { useRouter } from "next/navigation";
import { apiCreateTestcase, apiCreateLab } from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

interface TestCase {
  input: string;
  output: string;
  hiddenInput: string;
  hiddenOutput: string;
  score: string | number;
}

export default function CreateLabPage() {
  const MAX_LINES = 15;
  const MAX_CHARS = 2500;

  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const { data: session } = useSession();

  const [name, setName] = useState("");
  const [dateline, setDateline] = useState("");
  const [problem, setProblem] = useState("");

  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" },
  ]);

  const [symbols, setSymbols] = useState({
    input: 0,
    output: 0,
    declare: 0,
    assign: 0,
    if: 0,
    for: 0,
    while: 0,
    do: 0,
  });

  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState<{ name?: string; problem?: string }>({});

  const [tcErrors, setTcErrors] = useState<
    { input?: string; output?: string; score?: string; hiddenInput?: string; hiddenOutput?: string }[]
  >(testCases.map(() => ({})));

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalAction, setModalAction] = useState<(() => void) | null>(null);

  const openModal = (title: string, message: string, action: (() => void) | null) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalAction(() => action);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    try {
      if (modalAction) modalAction();
    } catch (err) {
      console.error("modal action error:", err);
    } finally {
      setModalAction(null);
    }
  };

  const handleProblemChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;

    if (value.length > MAX_CHARS) return;

    const lines = value.split("\n").length;
    if (lines > MAX_LINES) return;

    setProblem(value);

    if (value && value.trim()) {
      setErrors((prev) => ({ ...prev, problem: undefined }));
    }
  };

  const addTestCase = () => {
    setTestCases((prev) => [
      ...prev,
      { input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" },
    ]);
    setTcErrors((prev) => [...prev, {}]);
  };

  const removeTestCase = (index: number) => {
    if (testCases.length === 1) return;
    const updated = [...testCases];
    updated.splice(index, 1);
    setTestCases(updated);

    const updatedErr = [...tcErrors];
    updatedErr.splice(index, 1);
    setTcErrors(updatedErr);
  };

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: string) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);

    setTcErrors((prev) => {
      const copy = [...prev];
      copy[index] = { ...(copy[index] || {}) };
      if ((copy[index] as any)[field]) {
        delete (copy[index] as any)[field];
      }
      return copy;
    });
  };

  const handleSymbolChange = (symbolData: any) => {
    setSymbols(symbolData);
  };

  const handleCancel = () => {
    if (from === "Selectlab") {
      router.push("/Selectlab");
    } else {
      router.push("/mylab");
    }
  };

  const parseValues = (raw: string) => {
    if (!raw) return [];
    const hasComma = raw.indexOf(",") !== -1;
    const parts = hasComma ? raw.split(",") : raw.split(/\s+/);
    return parts
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map((s) => {
        const n = Number(s);
        return Number.isNaN(n) ? s : n;
      });
  };

  const toISODueDate = (dateOnly: string) => {
    if (!dateOnly) return null;
    return new Date(`${dateOnly}T23:59:59Z`).toISOString();
  };

  const handleCreate = async () => {
    const newErrors: { name?: string; problem?: string } = {};
    if (!name || !name.trim()) {
      newErrors.name = "กรุณากรอกชื่อ Lab";
    }
    if (!problem || !problem.trim()) {
      newErrors.problem = "กรุณากรอก Problem Solving";
    }

    const newTcErrors: {
      input?: string;
      output?: string;
      score?: string;
      hiddenInput?: string;
      hiddenOutput?: string;
    }[] = testCases.map(() => ({}));
    let hasTcError = false;

    testCases.forEach((tc, idx) => {
      if (!tc.input || !String(tc.input).trim()) {
        newTcErrors[idx].input = "กรุณากรอก Input";
        hasTcError = true;
      }
      if (!tc.output || !String(tc.output).trim()) {
        newTcErrors[idx].output = "กรุณากรอก Output";
        hasTcError = true;
      }
      if (!tc.hiddenInput || !String(tc.hiddenInput).trim()) {
        newTcErrors[idx].hiddenInput = "กรุณากรอก Hidden Input";
        hasTcError = true;
      }
      if (!tc.hiddenOutput || !String(tc.hiddenOutput).trim()) {
        newTcErrors[idx].hiddenOutput = "กรุณากรอก Hidden Output";
        hasTcError = true;
      }
      if (
        tc.score === "" ||
        tc.score === null ||
        tc.score === undefined ||
        String(tc.score).trim() === ""
      ) {
        newTcErrors[idx].score = "กรุณากรอก Score";
        hasTcError = true;
      } else {
        const n = Number(tc.score);
        if (Number.isNaN(n)) {
          newTcErrors[idx].score = "Score ต้องเป็นตัวเลข";
          hasTcError = true;
        }
      }
    });

    setErrors(newErrors);
    setTcErrors(newTcErrors);

    if (Object.keys(newErrors).length > 0 || hasTcError) {
      return;
    }

    setErrors({});
    setTcErrors(testCases.map(() => ({})));
    setSubmitting(true);

    try {
      const dueDateIso = toISODueDate(dateline);

      const userSession = session?.user as any;
      const rawId = userSession?.id || userSession?.userId;
      if (!rawId) {
        console.warn(
          "⚠️ Warning: ไม่พบ ID ของ User ใน Session! ระบบจะใช้ค่า Default: 1 (โปรดตรวจสอบการตั้งค่า NextAuth Callbacks)",
        );
      }
      const ownerId = rawId ? Number(rawId) : 1;
      console.log("Creating Lab with Owner ID:", ownerId);

      const labPayload: any = {
        ownerUserId: ownerId,
        labname: name || "Untitled Lab",
        problemSolving: problem || "",
        status: "active",
        inSymVal: Number(symbols.input) || 0,
        outSymVal: Number(symbols.output) || 0,
        declareSymVal: Number(symbols.declare) || 0,
        assignSymVal: Number(symbols.assign) || 0,
        ifSymVal: Number(symbols.if) || 0,
        forSymVal: Number(symbols.for) || 0,
        whileSymVal: Number(symbols.while) || 0,
      };

      if (dueDateIso) {
        labPayload.dueDate = dueDateIso;
      }

      labPayload.testcases = testCases.map((tc) => ({
        inputVal: parseValues(tc.input),
        outputVal: parseValues(tc.output),
        score: Number(tc.score) || 0,
        inHiddenVal:
          tc.hiddenInput && tc.hiddenInput.trim() ? parseValues(tc.hiddenInput) : null,
        outHiddenVal:
          tc.hiddenOutput && tc.hiddenOutput.trim() ? parseValues(tc.hiddenOutput) : null,
      }));

      console.log("[Createlab] sending apiCreateLab payload:", labPayload);

      const createLabResp = await apiCreateLab(labPayload);
      console.log("[Createlab] createLabResp ->", createLabResp);

      const labId =
        createLabResp && createLabResp.lab && createLabResp.lab.labId
          ? createLabResp.lab.labId
          : createLabResp?.labId ?? null;

      if (!labId) {
        console.error("[Createlab] labId not found in createLabResp", createLabResp);
        throw new Error("ไม่พบ labId ในการตอบกลับจาก server");
      }

      const serverCreatedTestcases =
        !!(
          (createLabResp.lab &&
            Array.isArray(createLabResp.lab.testcases) &&
            createLabResp.lab.testcases.length >= labPayload.testcases.length) ||
          (Array.isArray(createLabResp.testcases) &&
            createLabResp.testcases.length >= labPayload.testcases.length)
        );

      const baseLabLocal = {
        id: Date.now(),
        labId,
        name,
        dateline,
        problem,
        testCases,
        symbols,
        createdAt: new Date().toISOString(),
        remoteCreated: true,
        authorEmail: session?.user?.email,
        author: session?.user?.name,
      };

      if (!serverCreatedTestcases && labPayload.testcases.length > 0) {
        console.log(
          "[Createlab] backend did not create testcases; falling back to apiCreateTestcase per item",
        );
        const promises = labPayload.testcases.map((payload: any, idx: number) =>
          apiCreateTestcase(String(labId), payload)
            .then((res) => ({ status: "fulfilled", value: res }))
            .catch((err) => {
              console.error(`[Createlab] testcase[${idx}] error ->`, err);
              return { status: "rejected", reason: err };
            }),
        );

        const results = await Promise.all(promises);
        const rejected = results.filter((r: any) => r.status === "rejected");

        const newLabLocal = {
          ...baseLabLocal,
          testcaseUploadStatus: rejected.length > 0 ? "partial-failure" : "all-ok",
        };

        const stored = localStorage.getItem("labs");
        const labs = stored ? JSON.parse(stored) : [];
        labs.push(newLabLocal);
        localStorage.setItem("labs", JSON.stringify(labs));

        if (rejected.length > 0) {
          openModal(
            "สร้าง Lab เสร็จ (บาง Testcase ล้มเหลว)",
            "สร้าง Lab สำเร็จ แต่มีบาง Testcase ส่งไป server ไม่สำเร็จ",
            () => {
              if (from === "selectlab" || from === "Selectlab") {
                router.push("/Selectlab");
              } else {
                router.push("/mylab");
              }
            },
          );
        } else {
          openModal(
            "สร้าง Lab สำเร็จ",
            "สร้าง Lab และส่ง Testcase ขึ้น server เรียบร้อยแล้ว",
            () => {
              if (from === "selectlab" || from === "Selectlab") {
                router.push("/Selectlab");
              } else {
                router.push("/mylab");
              }
            },
          );
        }
      } else {
        const newLabLocal = {
          ...baseLabLocal,
          testcaseUploadStatus: "all-ok",
        };

        const stored = localStorage.getItem("labs");
        const labs = stored ? JSON.parse(stored) : [];
        labs.push(newLabLocal);
        localStorage.setItem("labs", JSON.stringify(labs));

        openModal(
          "สร้าง Lab สำเร็จ",
          "สร้าง Lab เรียบร้อยแล้ว",
          () => {
            if (from === "selectlab" || from === "Selectlab") {
              router.push("/Selectlab");
            } else {
              router.push("/mylab");
            }
          },
        );
      }
    } catch (err) {
      console.error("handleCreate error:", err);
      openModal(
        "เกิดข้อผิดพลาด",
        "เกิดข้อผิดพลาด ข้อมูลอาจจะยังไม่ถูกส่ง กรุณาดู console",
        null,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isErrorModal = () => {
    if (!modalTitle) return false;
    const t = modalTitle.toLowerCase();
    return (
      t.includes("ผิด") ||
      t.includes("ไม่สำเร็จ") ||
      t.includes("ล้มเหลว") ||
      t.includes("ข้อผิดพลาด")
    );
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };

  const successModal = !isErrorModal();

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <div className="pl-60">
        <Navbar />
        <div className="flex">
          <Sidebar />

          <div className="flex-1 flex flex-col p-6 md:p-10">
            <div className="flex justify-end space-x-4 mb-6">
              <button
                onClick={handleCancel}
                className="bg-red-500 text-white px-4 py-2 rounded-full flex items-center hover:bg-red-600"
              >
                Cancel
              </button>

              <button
                onClick={handleCreate}
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>

            <h2 className="text-3xl md:text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-6">
              Create Lab
            </h2>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-lg font-medium mb-4">Name</label>
                    <input
                      type="text"
                      value={name}
                      placeholder="Name"
                      onChange={(e) => {
                        setName(e.target.value);
                        if (e.target.value && e.target.value.trim()) {
                          setErrors((prev) => ({ ...prev, name: undefined }));
                        }
                      }}
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-lg font-medium mb-4">
                    Problem Solving
                    <span className="ml-2 text-xs text-gray-400">
                      ({problem.length}/2500)
                    </span>
                  </label>

                  <textarea
                    value={problem}
                    placeholder="Problem Solving"
                    rows={15}
                    onChange={handleProblemChange}
                    className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md resize-none overflow-hidden leading-6"
                  />
                  {errors.problem && (
                    <p className="mt-1 text-sm text-red-600">{errors.problem}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Create Testcase</h3>

                  {testCases.map((tc, idx) => (
                    <div
                      key={idx}
                      className="relative border rounded-lg p-4 mb-4 shadow bg-gray-50"
                    >
                      <button
                        onClick={() => removeTestCase(idx)}
                        className="absolute top-2 right-2 text-red-500"
                      >
                        ✕
                      </button>

                      <div className="mb-2 font-semibold">Testcase {idx + 1}</div>

                      <div className="grid grid-cols-12 gap-4 mb-3 ml-5">
                        <div className="col-span-6">
                          <label>Input</label>
                          <input
                            type="text"
                            value={tc.input as string}
                            onChange={(e) =>
                              handleTestCaseChange(idx, "input", e.target.value)
                            }
                            placeholder="เช่น 10,20,30 หรือ 10 20 30"
                            className="w-full p-2 border bg-white rounded-md"
                          />
                          {tcErrors[idx]?.input && (
                            <p className="mt-1 text-sm text-red-600">
                              {tcErrors[idx].input}
                            </p>
                          )}
                        </div>

                        <div className="col-span-6">
                          <label>Output</label>
                          <input
                            type="text"
                            value={tc.output as string}
                            onChange={(e) =>
                              handleTestCaseChange(idx, "output", e.target.value)
                            }
                            placeholder="เช่น 60"
                            className="w-full p-2 border bg-white rounded-md"
                          />
                          {tcErrors[idx]?.output && (
                            <p className="mt-1 text-sm text-red-600">
                              {tcErrors[idx].output}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 ml-5">
                        <div className="col-span-6">
                          <label>Hidden Input</label>
                          <input
                            type="text"
                            value={tc.hiddenInput as string}
                            onChange={(e) =>
                              handleTestCaseChange(idx, "hiddenInput", e.target.value)
                            }
                            placeholder="เช่น 10,20,30 หรือ 10 20 30"
                            className="w-full p-2 border bg-white rounded-md"
                          />
                          {tcErrors[idx]?.hiddenInput && (
                            <p className="mt-1 text-sm text-red-600">
                              {tcErrors[idx].hiddenInput}
                            </p>
                          )}
                        </div>

                        <div className="col-span-6">
                          <label>Hidden Output</label>
                          <input
                            type="text"
                            value={tc.hiddenOutput as string}
                            onChange={(e) =>
                              handleTestCaseChange(idx, "hiddenOutput", e.target.value)
                            }
                            placeholder="เช่น 60"
                            className="w-full p-2 border bg-white rounded-md"
                          />
                          {tcErrors[idx]?.hiddenOutput && (
                            <p className="mt-1 text-sm text-red-600">
                              {tcErrors[idx].hiddenOutput}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 mt-3 ml-5">
                        <div className="col-span-6">
                          <label>Score</label>
                          <input
                            type="number"
                            value={tc.score as number | string}
                            onChange={(e) =>
                              handleTestCaseChange(idx, "score", e.target.value)
                            }
                            placeholder="เช่น 5"
                            className="w-full p-2 border bg-white rounded-md"
                          />
                          {tcErrors[idx]?.score && (
                            <p className="mt-1 text-sm text-red-600">
                              {tcErrors[idx].score}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end mt-4">
                    <button
                      onClick={addTestCase}
                      className="text-sm hover:underline"
                    >
                      + Add Testcase
                    </button>
                  </div>
                </div>
              </div>

              <SymbolSection onChange={handleSymbolChange} />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {modalVisible && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            aria-modal="true"
            role="dialog"
            onClick={() => {}}
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              aria-hidden
            />

            <motion.div
              className="relative z-50 w-full max-w-lg mx-auto transform"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              role="document"
              aria-labelledby="modal-title"
              aria-describedby="modal-desc"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
                <div
                  className={`px-6 pt-8 pb-6 flex flex-col items-center ${
                    isErrorModal() ? "bg-red-50" : "bg-green-50"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-20 h-20 rounded-xl ${
                      isErrorModal() ? "bg-red-600" : "bg-green-600"
                    } shadow-md`}
                  >
                    {isErrorModal() ? (
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M6 6L18 18M6 18L18 6"
                          stroke="#fff"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="#fff"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>

                  <h3
                    id="modal-title"
                    className={`mt-4 text-2xl font-extrabold ${
                      isErrorModal() ? "text-red-700" : "text-green-700"
                    }`}
                  >
                    {modalTitle}
                  </h3>
                </div>

                <div className="px-6 pb-6 pt-4">
                  <p
                    id="modal-desc"
                    className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${
                      successModal ? "text-center text-lg font-semibold" : ""
                    }`}
                  >
                    {modalMessage}
                  </p>

                  <div className="w-full border-t border-gray-200 my-4" />

                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={closeModal}
                      className="inline-flex items-center justify-center px-6 py-2 rounded-full border border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 text-sm font-medium shadow-sm"
                    >
                      ปิด
                    </button>
                  </div>
                </div>

                <button
                  onClick={closeModal}
                  aria-label="close"
                  className="absolute top-4 right-4 bg-white border border-gray-200 rounded-full w-9 h-9 flex items-center justify-center shadow"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M6 6L18 18M6 18L18 6"
                      stroke="#666"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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

