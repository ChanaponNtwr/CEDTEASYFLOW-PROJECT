// File: app/flowchart/_components/SymbolSection.tsx
"use client";

import React, { useEffect, useState, Dispatch, SetStateAction } from "react";
import Image from "next/image";
import { Edge, Node } from "@xyflow/react";
import { insertNode, deleteNode, editNode   } from "@/app/service/FlowchartService";


interface SymbolItem {
  key: string;
  label: string;
  imageSrc: string;
}

type FlowNode = Node & {
  id?: string;
  type?: string;
  label?: string;
  data?: any;
};

interface SymbolSectionProps {
  flowchartId: number;
  selectedEdgeId?: string;
  edge?: Edge;
  onAddNode?: (type: string, label: string, anchorId?: string) => void;
  nodeToEdit?: FlowNode | null;
  onUpdateNode?: (id: string, type: string, label: string) => void;
  onDeleteNode?: (id: string) => void;
  onCloseModal?: () => void;
  onRefresh?: () => Promise<void>;
}

/* --- helpers --- */
const validateConditionalExpression = (exp: string): string => {
  const trimmedExp = exp.trim();
  if (trimmedExp === "") return "กรุณาใส่เงื่อนไข (Condition)";
  const operators = /==|!=|>=|<=|>|</;
  if (!operators.test(trimmedExp)) return "เงื่อนไขไม่ถูกต้อง (ต้องมีตัวเปรียบเทียบ เช่น >, <, ==)";
  const parts = trimmedExp.split(/==|!=|>=|<=|>|</);
  if (parts.length < 2 || parts.some((p) => p.trim() === "")) {
    return "เงื่อนไขไม่สมบูรณ์ (เช่น 'a >' หรือ '< 10')";
  }
  return "";
};

const validateOutput = (output: string): string => {
  const trimmedOutput = output.trim();
  if (trimmedOutput === "") return "กรุณาใส่ค่าที่ต้องการแสดงผล";
  const startsWithQuote = trimmedOutput.startsWith('"');
  const endsWithQuote = trimmedOutput.endsWith('"');
  if (startsWithQuote && !endsWithQuote) return 'รูปแบบ String ไม่ถูกต้อง (ขาดเครื่องหมาย " ปิดท้าย)';
  if (!startsWithQuote && endsWithQuote) return 'รูปแบบ String ไม่ถูกต้อง (ขาดเครื่องหมาย " เปิด)';
  return "";
};

const toBackendType = (uiType: string) => {
  const t = uiType?.toLowerCase();
  switch (t) {
    case "input":
    case "in":
      return "IN";
    case "output":
    case "out":
      return "OU";
    case "declare":
    case "dc":
      return "DC";
    case "assign":
    case "as":
      return "AS";
    case "if":
      return "IF";
    case "while":
    case "wh":
      return "WH";
    case "for":
    case "fr":
      return "FR";
    case "do":
      return "DO";
    case "breakpoint":
    case "bp":
      return "BP";
    default:
      return uiType.toUpperCase();
  }
};

/* --- Field types --- */
type FieldSimple = {
  kind: "simple";
  key: string;
  placeholder?: string;
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
};

type FieldGroup = {
  kind: "group";
  key: string;
  fields: FieldSimple[];
};

type FieldDef = FieldSimple | FieldGroup;

type ModalConfig = {
  key: string;
  title: string;
  description: string;
  icon: string;
  fields: FieldDef[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
};

/* --- Component --- */
const SymbolSection: React.FC<SymbolSectionProps> = ({
  flowchartId,
  selectedEdgeId,
  edge,
  onAddNode,
  nodeToEdit,
  onUpdateNode,
  onDeleteNode,
  onCloseModal,
  onRefresh,
}) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // fields
  const [inputValue, setInputValue] = useState("");
  const [outputValue, setOutputValue] = useState("");
  const [ifExpression, setIfExpression] = useState("");
  const [whileExpression, setWhileExpression] = useState("");
  const [declareVariable, setDeclareVariable] = useState("");
  // single legacy state (kept for label building/backwards compat)
  const [declareDataType, setDeclareDataType] = useState("Integer");
  // NEW: allow multiple checkboxes for declare data types
  const [declareDataTypes, setDeclareDataTypes] = useState<Record<string, boolean>>({
    Integer: true,
    Real: false,
    String: false,
    Boolean: false,
  });

  const [assignVariable, setAssignVariable] = useState("");
  const [assignExpression, setAssignExpression] = useState("");
  const [forVariable, setForVariable] = useState("");
  const [forStart, setForStart] = useState("");
  const [forEnd, setForEnd] = useState("");
  const [forStep, setForStep] = useState("");
  const [doExpression, setDoExpression] = useState("");

  // helper to reset fields (for creating new node)
  const resetFields = () => {
    setInputValue("");
    setOutputValue("");
    setIfExpression("");
    setWhileExpression("");
    setDeclareVariable("");
    setDeclareDataType("Integer");
    setDeclareDataTypes({ Integer: true, Real: false, String: false, Boolean: false });
    setAssignVariable("");
    setAssignExpression("");
    setForVariable("");
    setForStart("");
    setForEnd("");
    setForStep("");
    setDoExpression("");
    setError("");
  };

const callUpdateOrAdd = async (nodeId: string | undefined, uiType: string, label: string, data?: any) => {
  setError("");
  if (!flowchartId) {
    setError("Missing flowchartId");
    return;
  }

  const backendType = toBackendType(uiType);
  const payloadNode = { type: backendType, label, data };

  try {
    setLoading(true);
    if (nodeId) {
      // --- EDIT existing node (PUT) ---
      console.info("Call editNode with:", { flowchartId, nodeId, payload: payloadNode });
      const res = await editNode(flowchartId, nodeId, payloadNode);
      console.info("editNode result:", res);

      if (onRefresh) {
        try {
          await onRefresh();
        } catch (refreshErr) {
          console.warn("refresh failed after edit:", refreshErr);
        }
      } else {
        // update local state via callback if provided
        onUpdateNode?.(nodeId, backendType, label);
      }
    } else {
      // --- INSERT new node (POST) ---
      if (!selectedEdgeId) {
        setError("กรุณาเลือกเส้น (edge) ที่ต้องการแทรก node ก่อน");
        return;
      }
      console.info("Call insertNode with:", { flowchartId, edgeId: selectedEdgeId, node: payloadNode });
      const res = await insertNode(flowchartId, selectedEdgeId, payloadNode);
      console.info("insertNode result:", res);

      if (onRefresh) {
        try {
          await onRefresh();
        } catch (refreshErr) {
          console.warn("refresh failed after insert:", refreshErr);
        }
      }

      // if inserting from modal while editing, call onUpdateNode to adjust parent local state label/type if needed
      if (nodeToEdit && onUpdateNode) {
        onUpdateNode(nodeId ?? "", backendType, label);
      }
    }

    // close modal & reset
    setActiveModal(null);
    onCloseModal?.();
  } catch (err: any) {
    console.error("Error in callUpdateOrAdd:", err);
    const msg = err?.response?.data?.message ?? err?.message ?? "เกิดข้อผิดพลาดในการเรียก API";
    setError(String(msg));
  } finally {
    setLoading(false);
    resetFields();
  }
};


const handleDeleteClick = async () => {
  if (!nodeToEdit) return;
  if (!flowchartId) {
    setError("Missing flowchartId");
    return;
  }

  const ok = window.confirm(
    "ต้องการลบ node นี้ใช่หรือไม่? การลบจะลบ node นี้พร้อม edges ที่เกี่ยวข้องและ nodes ที่ไม่สามารถเข้าถึงได้จาก Start"
  );
  if (!ok) return;

  const nodeId = nodeToEdit.id;
  if (!nodeId) {
    setError("Node id not found");
    return;
  }

  try {
    setError("");
    setLoading(true);
    console.info("Deleting node:", nodeId, "from flowchart:", flowchartId);
    const res = await deleteNode(flowchartId, nodeId);
    console.info("deleteNode response:", res);

    // ถ้ามี onRefresh ให้ใช้เพื่อโหลดข้อมูลใหม่ทั้งหมดจาก backend (recommended)
    if (onRefresh) {
      try {
        await onRefresh();
      } catch (refreshErr) {
        console.warn("onRefresh failed after delete:", refreshErr);
      }
    } else {
      // ถ้าไม่มี onRefresh ให้ notify parent เพื่อให้เค้าลบ node ทันทีจาก local state
      onDeleteNode?.(nodeId);
    }

    // ปิด modal
    setActiveModal(null);
    onCloseModal?.();
  } catch (err: any) {
    console.error("Failed to delete node:", err);
    // ถ้า backend ส่ง object { message: ... } ให้เอา message มาแสดง
    const msg = err?.message ?? (err?.response?.data?.message ?? "เกิดข้อผิดพลาดในการลบ node");
    setError(String(msg));
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    resetFields();
    if (!nodeToEdit) return;

    const rawType = String(nodeToEdit.type ?? nodeToEdit.data?.type ?? "").toUpperCase().trim();
    const rawLabel = String(
      nodeToEdit.label ??
        nodeToEdit.data?.label ??
        nodeToEdit.data?.message ??
        nodeToEdit.data?.condition ??
        ""
    ).trim();

    const stripQuotes = (s: any) => {
      const str = String(s ?? "");
      return str.startsWith('"') && str.endsWith('"') ? str.slice(1, -1) : str;
    };

    if (rawType === "IN" || rawType === "INPUT" || rawType === "INPUT_STATEMENT") {
      const varName =
        nodeToEdit.data?.variable ??
        nodeToEdit.data?.name ??
        rawLabel.replace(/^Input\s+/i, "").replace(/^IN\s+/i, "");
      setInputValue(String(varName ?? "").trim());
      setActiveModal("input");
      return;
    }

    if (rawType === "OU" || rawType === "OUT" || rawType === "OUTPUT" || rawType === "OUTPUT_STATEMENT") {
      const rawMsg =
        nodeToEdit.data?.message ??
        nodeToEdit.data?.value ??
        rawLabel.replace(/^Output\s+/i, "").replace(/^OUT\s+/i, "");
      setOutputValue(String(stripQuotes(rawMsg ?? "")).trim());
      setActiveModal("output");
      return;
    }

    if (rawType === "DC" || rawType === "DECLARE" || rawType === "DECL") {
      if (nodeToEdit.data?.name) {
        setDeclareVariable(String(nodeToEdit.data.name ?? ""));
        const vtRaw = nodeToEdit.data?.varType ?? nodeToEdit.data?.type ?? "integer";
        // ถ้า backend ส่ง "integer,real" ให้เอาแค่ค่าแรก
        const first = String(vtRaw).split(/[,|;\/\s]+/)[0] ?? "integer";
        setDeclareDataType(first.charAt(0).toUpperCase() + first.slice(1));
      } else {
        const parts = rawLabel.split(/\s+/);
        if (parts.length >= 2) {
          setDeclareDataType(parts[0]);
          setDeclareVariable(parts.slice(1).join(" "));
        } else {
          setDeclareVariable(rawLabel);
        }
      }
      setActiveModal("declare");
      return;
    }


    if (rawType === "AS" || rawType === "ASSIGN") {
      if (nodeToEdit.data?.variable) setAssignVariable(String(nodeToEdit.data.variable ?? ""));
      if (nodeToEdit.data?.value) setAssignExpression(String(nodeToEdit.data.value ?? ""));
      if (!nodeToEdit.data?.variable && !nodeToEdit.data?.value) {
        const m = rawLabel.split("=");
        if (m.length >= 2) {
          setAssignVariable(m[0].trim());
          setAssignExpression(m.slice(1).join("=").trim());
        } else {
          setAssignVariable(rawLabel);
        }
      }
      setActiveModal("assign");
      return;
    }

    if (rawType === "IF" || rawType === "IF_STATEMENT") {
      setIfExpression(String(nodeToEdit.data?.condition ?? rawLabel));
      setActiveModal("if");
      return;
    }

    if (rawType === "WH" || rawType === "WHILE") {
      setWhileExpression(String(nodeToEdit.data?.condition ?? rawLabel));
      setActiveModal("while");
      return;
    }

    if (rawType === "FR" || rawType === "FOR") {
      const init = String(nodeToEdit.data?.init ?? "");
      const condition = String(nodeToEdit.data?.condition ?? "");
      const increment = String(nodeToEdit.data?.increment ?? "");

      if (init || condition || increment) {
        const initMatch = init.match(/([a-zA-Z_]\w*)\s*=\s*([-\d]+)/);
        if (initMatch) {
          setForVariable(String(initMatch[1] ?? ""));
          setForStart(String(initMatch[2] ?? ""));
        } else {
          const forMatch = String(rawLabel).match(/^(.+?)\s*=\s*(.+?)\s+to\s+(.+)$/i);
          if (forMatch) {
            setForVariable(String(forMatch[1].trim() ?? ""));
            setForStart(String(forMatch[2].trim() ?? ""));
            setForEnd(String(forMatch[3].trim() ?? ""));
          } else {
            setForVariable(rawLabel);
          }
        }

        const condMatch =
          condition.match(/<\s*([-\d]+)/) ||
          condition.match(/<=\s*([-\d]+)/) ||
          condition.match(/to\s+([-\d]+)/i);
        if (condMatch) {
          setForEnd(String(condMatch[1] ?? ""));
        } else if (nodeToEdit.data?.end !== undefined) {
          setForEnd(String(nodeToEdit.data.end));
        }

        const stepMatch = increment.match(/(?:\+=|=\s*.+\+\s*)([-\d]+)/);
        if (stepMatch) setForStep(String(stepMatch[1] ?? ""));
        else if (nodeToEdit.data?.step !== undefined) setForStep(String(nodeToEdit.data.step));
      } else {
        const forMatch = String(rawLabel).match(/^(.+?)\s*=\s*(.+?)\s+to\s+(.+)$/i);
        if (forMatch) {
          setForVariable(String(forMatch[1].trim() ?? ""));
          setForStart(String(forMatch[2].trim() ?? ""));
          setForEnd(String(forMatch[3].trim() ?? ""));
        } else {
          setForVariable(rawLabel);
        }
      }
      setActiveModal("for");
      return;
    }

    if (rawType === "DO") {
      setDoExpression(String(nodeToEdit.data?.condition ?? rawLabel));
      setActiveModal("do");
      return;
    }
  }, [nodeToEdit]);

  const closeAll = () => {
    setActiveModal(null);
    setError("");
    onCloseModal?.();
  };

  /* --- Modal Configs --- */
  const modalConfigs: ModalConfig[] = [
    {
      key: "input",
      title: "Input Properties",
      description: "A Input Statement reads a value from the keyboard and stores it in a variable.",
      icon: "/images/Rectangle.png",
      fields: [{ kind: "simple", key: "variable", placeholder: "Variable name", value: inputValue, setValue: setInputValue }],
      onSubmit: (e) => {
        e.preventDefault();
        if (!inputValue.trim()) { setError("กรุณาใส่ชื่อ Variable"); return; }
        callUpdateOrAdd(nodeToEdit?.id, "input", `Input ${inputValue}`, {
          variable: inputValue,
          prompt: `Enter your ${inputValue}:`,
          varType: "string"
        });
      },
      onClose: () => { setInputValue(""); closeAll(); },
    },
    {
      key: "output",
      title: "Output Properties",
      description: "An Output Statement displays the result of an expression to the screen.",
      icon: "/images/Rectangle.png",
      fields: [{ kind: "simple", key: "value", placeholder: 'Variable or "string"', value: outputValue, setValue: setOutputValue }],
      onSubmit: (e) => {
        e.preventDefault();
        const validationError = validateOutput(outputValue);
        if (validationError) { setError(validationError); return; }
        callUpdateOrAdd(nodeToEdit?.id, "output", `Output ${outputValue}`, { message: outputValue });
      },
      onClose: () => { setOutputValue(""); closeAll(); },
    },
    {
      key: "declare",
      title: "Declare Properties",
      description: "A Declare Statement is used to create variables and arrays.",
      icon: "/images/shape_Declare.png",
      // NOTE: we include a dummy dataType field so UI renderer recognizes it and uses the special checkbox block
      fields: [
        { kind: "simple", key: "variable", placeholder: "e.g., a", value: declareVariable, setValue: setDeclareVariable },
        { kind: "simple", key: "dataType", placeholder: "", value: declareDataType, setValue: setDeclareDataType },
      ],
      onSubmit: (e) => {
        e.preventDefault();
        if (!declareVariable.trim()) { setError("กรุณาใส่ชื่อ Variable"); return; }
        const varTypePayload = declareDataType.toLowerCase(); // e.g., "integer"
        const labelPrefix = declareDataType; // e.g., "Integer"
        callUpdateOrAdd(nodeToEdit?.id, "declare", `${labelPrefix} ${declareVariable}`, {
          name: declareVariable,
          value: 0,
          varType: varTypePayload
        });
      },
      onClose: () => { setDeclareVariable(""); setDeclareDataType("Integer"); setDeclareDataTypes({ Integer: true, Real: false, String: false, Boolean: false }); closeAll(); },
    },
    {
      key: "assign",
      title: "Assign Properties",
      description: "An Assignment Statement stores the result of an expression in a variable.",
      icon: "/images/square.png",
      fields: [
        { kind: "simple", key: "variable", placeholder: "e.g., a", value: assignVariable, setValue: setAssignVariable },
        { kind: "simple", key: "expression", placeholder: "e.g., 10", value: assignExpression, setValue: setAssignExpression },
      ],
      onSubmit: (e) => {
        e.preventDefault();
        if (!assignVariable.trim() || !assignExpression.trim()) { setError("กรุณากรอกข้อมูล Variable และ Expression"); return; }
        callUpdateOrAdd(nodeToEdit?.id, "assign", `${assignVariable} = ${assignExpression}`, {
          variable: assignVariable,
          value: assignExpression
        });
      },
      onClose: () => { setAssignVariable(""); setAssignExpression(""); closeAll(); },
    },
    {
      key: "if",
      title: "If Properties",
      description: "An IF Statement checks a Boolean expression and executes a branch based on the result.",
      icon: "/images/shape_if.png",
      fields: [{ kind: "simple", key: "condition", placeholder: "e.g., a > 10", value: ifExpression, setValue: setIfExpression }],
      onSubmit: (e) => {
        e.preventDefault();
        const validationError = validateConditionalExpression(ifExpression);
        if (validationError) { setError(validationError); return; }
        callUpdateOrAdd(nodeToEdit?.id, "if", ifExpression, { condition: ifExpression });
      },
      onClose: () => { setIfExpression(""); closeAll(); },
    },
    {
      key: "while",
      title: "While Properties",
      description: "A WHILE Statement repeatedly executes code as long as the condition is true.",
      icon: "/images/shape_while.png",
      fields: [{ kind: "simple", key: "condition", placeholder: "e.g., count < 10", value: whileExpression, setValue: setWhileExpression }],
      onSubmit: (e) => {
        e.preventDefault();
        const validationError = validateConditionalExpression(whileExpression);
        if (validationError) { setError(validationError); return; }
        callUpdateOrAdd(nodeToEdit?.id, "while", whileExpression, {
          condition: whileExpression,
          varName: "x",
          increment: "x = x + 1"
        });
      },
      onClose: () => { setWhileExpression(""); closeAll(); },
    },
    {
      key: "for",
      title: "For Properties",
      description: "A For Loop increments or decrements a variable through a range of values.",
      icon: "/images/shape_while.png",
      fields: [
        { kind: "group", key: "group", fields: [
          { kind: "simple", key: "variable", placeholder: "e.g., i", value: forVariable, setValue: setForVariable },
          { kind: "simple", key: "step", placeholder: "e.g., 1", value: forStep, setValue: setForStep },
          { kind: "simple", key: "start", placeholder: "e.g., 0", value: forStart, setValue: setForStart },
          { kind: "simple", key: "end", placeholder: "e.g., 10", value: forEnd, setValue: setForEnd },
        ]},
      ],
      onSubmit: (e) => {
        e.preventDefault();
        if (!forVariable.trim() || !forStart.trim() || !forEnd.trim() || !forStep.trim()) {
          setError("กรุณากรอกข้อมูลให้ครบทุกช่อง"); return;
        }
        if (isNaN(Number(forStart)) || isNaN(Number(forEnd)) || isNaN(Number(forStep))) {
          setError("ค่า Start, End, Step ต้องเป็นตัวเลข"); return;
        }
        callUpdateOrAdd(nodeToEdit?.id, "for", `${forVariable} = ${forStart} to ${forEnd}`, {
          init: `int ${forVariable} = ${forStart}`,
          condition: `${forVariable} < ${forEnd}`,
          increment: `${forVariable} += ${forStep}`,
          varName: forVariable
        });
      },
      onClose: () => { setForVariable(""); setForStart(""); setForEnd(""); setForStep(""); closeAll(); },
    },
    {
      key: "do",
      title: "Do-While Properties",
      description: "Do-While Statement",
      icon: "/images/shape_while.png",
      fields: [{ kind: "simple", key: "condition", placeholder: "e.g., i < 10", value: doExpression, setValue: setDoExpression }],
      onSubmit: (e) => {
        e.preventDefault();
        const validationError = validateConditionalExpression(doExpression);
        if (validationError) { setError(validationError); return; }
        callUpdateOrAdd(nodeToEdit?.id, "do", doExpression, { condition: doExpression });
      },
      onClose: () => { setDoExpression(""); closeAll(); },
    },
  ];

  /* --- Symbols --- */
  const symbols: SymbolItem[] = [
    { key: "input", label: "Input", imageSrc: "/images/input.png" },
    { key: "output", label: "Output", imageSrc: "/images/output.png" },
    { key: "declare", label: "Declare", imageSrc: "/images/declare.png" },
    { key: "assign", label: "Assign", imageSrc: "/images/assign.png" },
    { key: "if", label: "IF", imageSrc: "/images/if.png" },
    { key: "while", label: "While", imageSrc: "/images/while.png" },
    { key: "for", label: "For", imageSrc: "/images/for.png" },
    { key: "do", label: "Do", imageSrc: "/images/do.png" },
  ];

  const SymbolItemComponent: React.FC<{ item: SymbolItem }> = ({ item }) => (
    <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => { setError(""); resetFields(); setActiveModal(item.key); }}>
      <Image src={item.imageSrc} alt={item.label} width={100} height={60} />
      <span className="text-sm text-gray-700">{item.label}</span>
    </div>
  );

  /* --- Render active modal if any --- */
  if (activeModal) {
    const cfg = modalConfigs.find((m) => m.key === activeModal);
    if (!cfg) return null;

    return (
      <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
        <form onSubmit={cfg.onSubmit}>
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-800 mb-4">{cfg.title}</div>
            {nodeToEdit && (
              <button type="button" onClick={handleDeleteClick} className="text-sm text-red-600 mr-4">
                Delete
              </button>
            )}
          </div>

          {/* Render fields dynamically */}
          {cfg.fields.map((f) => {
            if (f.kind === "group") {
              return (
                <div key={f.key} className="grid grid-cols-2 gap-4 ml-6 mb-4">
                  {f.fields.map((g) => (
                    <input
                      key={g.key}
                      type="text"
                      placeholder={g.placeholder}
                      value={g.value}
                      onChange={(e) => g.setValue(e.target.value)}
                      className="w-full border border-gray-400 rounded-md px-2 py-1 text-sm"
                    />
                  ))}
                </div>
              );
                } else if (f.kind === "simple" && f.key === "dataType") {
                  return (
                    <div key={f.key} className="ml-6 mb-4">
                      <div className="text-gray-700 mb-2">Data Type (เลือกได้ 1 ค่า)</div>
                      <div className="grid grid-cols-2 gap-2">
                        {["Integer", "Real", "String", "Boolean"].map((dt) => (
                          <label key={dt} className="flex items-center gap-1 text-sm text-gray-700">
                            <input
                              type="radio"
                              name="dataType"
                              value={dt}
                              checked={declareDataType === dt}
                              onChange={(e) => setDeclareDataType(e.target.value)}
                              className="w-4 h-4"
                            />
                            {dt}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }


            return (
              <input
                key={f.key}
                type="text"
                placeholder={f.placeholder}
                value={f.value}
                onChange={(e) => f.setValue(e.target.value)}
                className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            );
          })}

          {error && <div className="text-red-500 text-xs ml-6 -mt-2 mb-2">{error}</div>}

          <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
            <button type="button" onClick={() => cfg.onClose()} className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer">
              {loading ? "Saving..." : "Ok"}
            </button>
          </div>
        </form>

        <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
          <img src={cfg.icon} alt="Icon" className="w-50 h-7" />
          <span className="text-gray-600 text-sm">{cfg.description}</span>
        </div>
      </div>
    );
  }

  /* --- Palette --- */
  return (
    <div className="w-full bg-white p-4 flex flex-col gap-4 rounded-lg shadow-lg border-1">
      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Input / Output</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.find((s) => s.key === "input")!} />
          <SymbolItemComponent item={symbols.find((s) => s.key === "output")!} />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Variables</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.find((s) => s.key === "declare")!} />
          <SymbolItemComponent item={symbols.find((s) => s.key === "assign")!} />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Control</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.find((s) => s.key === "if")!} />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Looping</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.find((s) => s.key === "while")!} />
          <SymbolItemComponent item={symbols.find((s) => s.key === "for")!} />
        </div>
      </div>
    </div>
  );
};

export default SymbolSection;
