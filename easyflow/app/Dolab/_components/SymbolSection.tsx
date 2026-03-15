"use client";

import React, { useEffect, useState, Dispatch, SetStateAction } from "react";
import Image from "next/image";
import { Edge, Node } from "@xyflow/react";
import { insertNode, deleteNode, editNode, apiGetShapeRemaining } from "@/app/service/FlowchartService";
import { motion, AnimatePresence } from "framer-motion";
import { FaCube, FaPlus } from "react-icons/fa";

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
  onFocusNode?: (nodeId: string) => void;
}

/* --- helpers --- */
const validateConditionalExpression = (exp: string): string => {
  const trimmed = exp.trim();
  if (trimmed === "") return "กรุณาใส่เงื่อนไข (Condition)";

  const match = trimmed.match(/^\s*(.+?)\s*(==|!=|>=|<=|>|<|=)\s*(.+)\s*$/);
  if (!match) {
    return "เงื่อนไขไม่ถูกต้อง (ต้องมีตัวเปรียบเทียบ เช่น >, <, ==)";
  }

  const [, left, , right] = match;
  if (left.trim() === "" || right.trim() === "") {
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

type ModalVariant = "danger" | "success" | "info";

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
  onFocusNode,
}) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // confirmation modal state (replaces window.confirm)
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void> | void) | null>(null);
  const [confirmVariant, setConfirmVariant] = useState<ModalVariant>("danger");

  // shape remaining state
  const [shapeRemaining, setShapeRemaining] = useState<Record<string, any> | null>(null);
  const [srLoading, setSrLoading] = useState(false);
  const [srError, setSrError] = useState<string | null>(null);

  // fields
  const [inputValue, setInputValue] = useState("");
  const [outputValue, setOutputValue] = useState("");
  const [ifExpression, setIfExpression] = useState("");
  const [whileExpression, setWhileExpression] = useState("");
  const [declareVariable, setDeclareVariable] = useState("");
  const [declareDataType, setDeclareDataType] = useState("Integer");
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

  const [conflicts, setConflicts] = useState<
    { varName: string; nodeId: string; label: string; foundIn?: string }[]
  >([]);

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
    setConflicts([]);
  };

  /* --- Shape remaining helpers --- */

  // convert backend remaining value into number or Infinity
  const parseRemaining = (v: any): number | typeof Infinity | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      if (v.toLowerCase() === "unlimited" || v === "∞" || v === "infinite") return Infinity;
      const n = Number(v);
      return isNaN(n) ? null : n;
    }
    return null;
  };

  // map UI symbol key to one or more backend shape codes (try multiple if backend uses FOR vs FR etc.)
  const uiKeyToShapeCodes = (uiKey: string): string[] => {
    switch (uiKey) {
      case "input": return ["IN"];
      case "output": return ["OU"];
      case "declare": return ["DC"];
      case "assign": return ["AS"];
      case "if": return ["IF"];
      case "while": return ["WH"];
      case "for": return ["FOR", "FR"];
      case "do": return ["DO"];
      default: return [uiKey.toUpperCase()];
    }
  };

  // get remaining (number|Infinity|null) for an uiKey from current shapeRemaining
  const getRemainingForUIKey = (uiKey: string): number | typeof Infinity | null => {
    if (!shapeRemaining) return null;
    const codes = uiKeyToShapeCodes(uiKey);
    for (const c of codes) {
      const entry = shapeRemaining[c];
      if (entry) {
        const r = parseRemaining(entry.remaining ?? entry.remain ?? null);
        if (r !== null) return r;
      }
    }
    return null;
  };

  const fetchShapeRemaining = async () => {
    if (!flowchartId) return;
    try {
      setSrError(null);
      setSrLoading(true);
      const res = await apiGetShapeRemaining(flowchartId);
      setShapeRemaining(res?.shapeRemaining ?? null);
    } catch (err: any) {
      console.error("apiGetShapeRemaining failed:", err);
      setSrError(err?.message ?? "ไม่สามารถโหลดข้อมูลจำนวน shape ที่เหลือได้");
    } finally {
      setSrLoading(false);
    }
  };

  useEffect(() => {
    // initial load + when flowchartId changes
    fetchShapeRemaining();
  }, [flowchartId]);

  /* --- callUpdateOrAdd (แก้ไขให้เรียก fetchShapeRemaining หลังสำเร็จ) --- */
  const callUpdateOrAdd = async (nodeId: string | undefined, uiType: string, label: string, data?: any) => {
    setError("");
    setConflicts([]);
    if (!flowchartId) {
      setError("Missing flowchartId");
      return;
    }

    const backendType = toBackendType(uiType);
    const payloadNode = { type: backendType, label, data };

    try {
      setLoading(true);
      if (nodeId) {
        // EDIT
        console.info("Call editNode with:", { flowchartId, nodeId, payload: payloadNode });
        const res = await editNode(flowchartId, nodeId, payloadNode);
        console.info("editNode result:", res);

        if (onRefresh) {
          try {
            await onRefresh();
          } catch (refreshErr) {
            console.warn("onRefresh failed after edit:", refreshErr);
          }
        } else {
          onUpdateNode?.(nodeId, backendType, label);
        }
      } else {
        // INSERT
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
            console.warn("onRefresh failed after insert:", refreshErr);
          }
        } else {
          // nothing to do; parent might handle updates
        }
      }

      // success -> close modal, reset and refresh shapeRemaining
      setActiveModal(null);
      onCloseModal?.();
      resetFields();

      // refresh the shape counts (always try to keep UI in sync)
      try {
        await fetchShapeRemaining();
      } catch (e) {
        // already handled in fetchShapeRemaining
      }
    } catch (err: any) {
      console.error("Error in callUpdateOrAdd:", err);
      const resp = err?.response?.data ?? err?.response ?? null;
      if (resp && Array.isArray(resp.conflicts) && resp.conflicts.length > 0) {
        const cs = resp.conflicts.map((c: any) => ({
          varName: String(c.varName ?? c.variable ?? c.name ?? "").trim(),
          nodeId: String(c.nodeId ?? c.id ?? c.node ?? ""),
          label: String(c.label ?? c.nodeLabel ?? c.label ?? ""),
          foundIn: String(c.foundIn ?? ""),
        }));
        const names = Array.from(new Set(cs.map((c: any) => c.varName))).join(", ");
        const msg = `ชื่อตัวแปร '${names}' ถูกใช้งานแล้วใน flowchart นี้ กรุณาเลือกชื่ออื่นหรือไปที่ node ที่ประกาศตัวแปรก่อนหน้านี้.`;
        setError(msg);
        setConflicts(cs);
      } else {
        const msg = err?.response?.data?.message ?? err?.message ?? "เกิดข้อผิดพลาดในการเรียก API";
        setError(String(msg));
      }
    } finally {
      setLoading(false);
    }
  };

  // performDelete contains the real delete logic previously inside handleDeleteClick (without confirm)
  const performDelete = async () => {
    if (!nodeToEdit) return;
    if (!flowchartId) {
      setError("Missing flowchartId");
      return;
    }

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

      // attempt to delete associated breakpoint nodes gracefully
      try {
        const rawType = String(nodeToEdit.type ?? nodeToEdit.data?.type ?? "").toUpperCase();
        if (rawType.includes("IF")) {
          const candidates: string[] = [];
          if (nodeToEdit.data?.breakpointId) candidates.push(String(nodeToEdit.data.breakpointId));
          if (nodeToEdit.data?.bpId) candidates.push(String(nodeToEdit.data.bpId));
          if (nodeToEdit.data?.bp_node_id) candidates.push(String(nodeToEdit.data.bp_node_id));
          candidates.push(`bp_${nodeId}`);
          candidates.push(`bp_${nodeId.replace(/^n_?/i, "")}`);
          const uniqCandidates = Array.from(new Set(candidates.filter(Boolean)));
          for (const bpId of uniqCandidates) {
            try {
              const bpRes = await deleteNode(flowchartId, bpId);
              console.info("Deleted BP node:", bpId, bpRes);
              break;
            } catch (bpErr: any) {
              console.warn(`Failed to delete BP candidate ${bpId}:`, bpErr?.message ?? bpErr);
            }
          }
        }
      } catch (innerErr) {
        console.warn("Error while attempting to delete associated breakpoint:", innerErr);
      }

      if (onRefresh) {
        try {
          await onRefresh();
        } catch (refreshErr) {
          console.warn("onRefresh failed after delete:", refreshErr);
        }
      } else {
        onDeleteNode?.(nodeId);
      }

      setActiveModal(null);
      onCloseModal?.();

      // update shapeRemaining after delete
      try {
        await fetchShapeRemaining();
      } catch (e) {
        // ignore, already handled
      }
    } catch (err: any) {
      console.error("Failed to delete node:", err);
      const msg = err?.message ?? (err?.response?.data?.message ?? "เกิดข้อผิดพลาดในการลบ node");
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  // original handler now opens confirm modal instead of window.confirm
  const handleDeleteClick = async () => {
    if (!nodeToEdit) return;
    setError("");

    // prepare confirm modal
    setConfirmTitle("ลบ node");
    setConfirmMessage("ต้องการลบ node นี้ใช่หรือไม่? การลบจะลบ node นี้พร้อม edges ที่เกี่ยวข้องและ nodes ที่ไม่สามารถเข้าถึงได้จาก Start");
    setConfirmVariant("danger");
    setConfirmAction(() => async () => {
      // run actual delete
      await performDelete();
    });
    setConfirmVisible(true);
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

    if (rawType === "FR" || rawType === "FOR" || rawType === "FOR_LOOP") {
      const init = String(nodeToEdit.data?.init ?? "");
      const condition = String(nodeToEdit.data?.condition ?? "");
      const increment = String(nodeToEdit.data?.increment ?? "");

      if (init || condition || increment) {
        const initMatch = init.match(/([a-zA-Z_]\w*)\s*=\s*([-/\d]+)/);
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
          condition.match(/<\s*([-/\d]+)/) ||
          condition.match(/<=\s*([-/\d]+)/) ||
          condition.match(/to\s+([-/\d]+)/i);
        if (condMatch) {
          setForEnd(String(condMatch[1] ?? ""));
        } else if (nodeToEdit.data?.end !== undefined) {
          setForEnd(String(nodeToEdit.data.end));
        }

        const stepMatch = increment.match(/(?:\+=|=\s*.+\+\s*)([-/\d]+)/);
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
      fields: [
        { kind: "simple", key: "variable", placeholder: "variable", value: declareVariable, setValue: setDeclareVariable },
        { kind: "simple", key: "dataType", placeholder: "", value: declareDataType, setValue: setDeclareDataType },
      ],
      onSubmit: (e) => {
        e.preventDefault();
        if (!declareVariable.trim()) { setError("กรุณาใส่ชื่อ Variable"); return; }
        const varTypePayload = declareDataType.toLowerCase();
        const labelPrefix = declareDataType;
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
        { kind: "simple", key: "variable", placeholder: "variable", value: assignVariable, setValue: setAssignVariable },
        { kind: "simple", key: "expression", placeholder: "expression", value: assignExpression, setValue: setAssignExpression },
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
      fields: [{ kind: "simple", key: "condition", placeholder: "condition a > 10", value: ifExpression, setValue: setIfExpression }],
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
      fields: [{ kind: "simple", key: "condition", placeholder: "condition count < 10", value: whileExpression, setValue: setWhileExpression }],
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
          { kind: "simple", key: "variable", placeholder: "variable", value: forVariable, setValue: setForVariable },
          { kind: "simple", key: "step", placeholder: "step", value: forStep, setValue: setForStep },
          { kind: "simple", key: "start", placeholder: "start", value: forStart, setValue: setForStart },
          { kind: "simple", key: "end", placeholder: "end", value: forEnd, setValue: setForEnd },
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
      fields: [{ kind: "simple", key: "condition", placeholder: "condition i < 10", value: doExpression, setValue: setDoExpression }],
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

  const SymbolItemComponent: React.FC<{ item: SymbolItem }> = ({ item }) => {
    const remaining = getRemainingForUIKey(item.key);
    const isUnlimited = remaining === Infinity;
    const isZero = typeof remaining === "number" && remaining <= 0;
    const disabled = isZero;

    return (
      <div
        className={`relative flex flex-col items-center gap-1 ${disabled ? "opacity-40 pointer-events-none" : "cursor-pointer"}`}
        onClick={() => {
          setError("");
          resetFields();
          if (disabled) {
            setError("รูปแบบนี้ไม่สามารถเพิ่มได้อีก (จำนวนเต็ม)"); // friendly message
            return;
          }
          setActiveModal(item.key);
        }}
        title={disabled ? "หมดจำนวนสำหรับ shape นี้แล้ว" : (isUnlimited ? "เหลือ: ไม่จำกัด" : `เหลือ: ${remaining}`)}
        role="button"
        aria-disabled={disabled}
      >
        <div className="relative">
          <Image src={item.imageSrc} alt={item.label} width={100} height={60} />
          {/* badge */}
          <div className="absolute -top-2 -right-2 bg-white border rounded-full px-2 py-0.5 text-xs shadow-sm">
            {srLoading ? "..." : isUnlimited ? "∞" : (remaining === null ? "-" : String(remaining))}
          </div>
        </div>
        <span className="text-sm text-gray-700">{item.label}</span>
      </div>
    );
  };

  /* --- Render active modal if any --- */
  if (activeModal) {
    const cfg = modalConfigs.find((m) => m.key === activeModal);
    if (!cfg) return null;

    return (
      <>
        <div className="w-[560px] max-w-[80%] mx-auto mt-12 bg-white rounded-xl shadow-2xl p-4 border border-gray-200 overflow-hidden">
          <form onSubmit={cfg.onSubmit} className="flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-gray-800">{cfg.title}</div>
                {/* <div className="text-sm text-gray-500 mt-1">{cfg.description}</div> */}
              </div>

              <div className="flex items-center gap-2">
                {nodeToEdit && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5">
              {/* Render fields dynamically (removed ml offsets so fields align to full width) */}
              {cfg.fields.map((f) => {
                if (f.kind === "group") {
                  return (
                    <div key={f.key} className="grid grid-cols-2 gap-4 mb-4">
                      {f.fields.map((g) => (
                        <input
                          key={g.key}
                          type="text"
                          placeholder={g.placeholder}
                          value={g.value}
                          onChange={(e) => g.setValue(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        />
                      ))}
                    </div>
                  );
                } else if (f.kind === "simple" && f.key === "dataType") {
                  return (
                    <div key={f.key} className="mb-4">
                      <div className="text-gray-700 mb-2 font-medium">Data Type</div>
                      <div className="grid grid-cols-2 gap-2">
                        {["Integer", "Float", "String", "Boolean"].map((dt) => (
                          <label key={dt} className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="radio"
                              name="dataType"
                              value={dt}
                              checked={declareDataType === dt}
                              onChange={(e) => setDeclareDataType(e.target.value)}
                              className="w-4 h-4"
                            />
                            <span>{dt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }

                // simple field (default) — full width
                return (
                  <input
                    key={f.key}
                    type="text"
                    placeholder={f.placeholder}
                    value={f.value}
                    onChange={(e) => f.setValue(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                );
              })}
            </div>

            {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

            {/* conflicts */}
            {conflicts.length > 0 && (
              <div className="mb-3">
                <div className="text-sm text-gray-700 mb-2 font-medium">พบตัวแปรซ้ำใน node ต่อไปนี้:</div>
                <ul className="text-sm space-y-2">
                  {conflicts.map((c: any) => (
                    <li key={c.nodeId} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{c.label || c.nodeId}</div>
                        <div className="text-xs text-gray-500">var: {c.varName}{c.foundIn ? ` · found in: ${c.foundIn}` : ""}</div>
                      </div>

                      <div>
                        <button
                          type="button"
                          className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
                          onClick={() => {
                            if (onFocusNode) {
                              onFocusNode(c.nodeId);
                            } else {
                              try {
                                navigator.clipboard?.writeText(c.nodeId);
                                alert(`Copied node id: ${c.nodeId} — ให้ parent implement onFocusNode เพื่อโฟกัส node โดยตรง`);
                              } catch (e) {
                                console.log("Focus node fallback, nodeId:", c.nodeId);
                              }
                            }
                          }}
                        >
                          ไปที่ node
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => cfg.onClose()}
                className="px-6 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                {loading ? "Saving..." : "Ok"}
              </button>
            </div>
          </form>

          <div className="bg-[#E9E5FF] rounded-b-md mt-6 p-3 flex items-center gap-3">
            <img src={modalConfigs.find(m => m.key === activeModal)?.icon} alt="Icon" className="w-12 h-7 object-contain" />
            <span className="text-gray-600 text-sm">{modalConfigs.find(m => m.key === activeModal)?.description}</span>
          </div>
        </div>

        {/* Confirmation modal (AnimatePresence) */}
        <AnimatePresence>
          {confirmVisible && (
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
                  <div className={`px-6 pt-8 pb-6 flex flex-col items-center ${confirmVariant === "danger" ? "bg-red-50" : confirmVariant === "success" ? "bg-green-50" : "bg-blue-50"}`}>
                    <div className={`flex items-center justify-center w-20 h-20 rounded-xl ${confirmVariant === "danger" ? "bg-red-600" : confirmVariant === "success" ? "bg-green-600" : "bg-blue-600"} shadow-md`}>
                      {confirmVariant === "danger" ? (
                        <FaCube size={36} className="text-white" />
                      ) : (
                        <FaPlus size={36} className="text-white" />
                      )}
                    </div>

                    <h3 className={`mt-4 text-2xl font-extrabold ${confirmVariant === "danger" ? "text-red-700" : confirmVariant === "success" ? "text-green-700" : "text-blue-700"}`}>
                      {confirmTitle}
                    </h3>
                  </div>

                  <div className="px-6 pb-6 pt-4">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap text-center">
                      {confirmMessage}
                    </p>

                    <div className="w-full border-t border-gray-200 my-4" />

                    <div className="mt-6 flex items-center justify-center gap-4">
                      <button
                        onClick={() => {
                          setConfirmVisible(false);
                        }}
                        className="inline-flex items-center justify-center px-6 py-2 rounded-full border border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 text-sm font-medium shadow-sm"
                      >
                        ยกเลิก
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            if (confirmAction) await confirmAction();
                          } catch (err) {
                            console.error("confirm action error:", err);
                          } finally {
                            setConfirmVisible(false);
                          }
                        }}
                        className={`inline-flex items-center justify-center px-6 py-2 rounded-full text-white focus:outline-none focus:ring-2 focus:ring-offset-2 text-sm font-medium shadow-sm ${confirmVariant === "danger" ? "bg-red-600 hover:bg-red-700 focus:ring-red-200" : confirmVariant === "success" ? "bg-green-600 hover:bg-green-700 focus:ring-green-200" : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-200"}`}
                      >
                        ยืนยัน
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setConfirmVisible(false)}
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
      </>
    );
  }

  /* --- Palette --- */
  return (
    <div className="w-full bg-white p-4 flex flex-col gap-4 rounded-lg shadow-lg border-1">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-700 mb-2">Input / Output</h3>
        <div className="text-xs text-gray-500">{srLoading ? "Loading shapes..." : (srError ? srError : "")}</div>
      </div>
      <div>
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