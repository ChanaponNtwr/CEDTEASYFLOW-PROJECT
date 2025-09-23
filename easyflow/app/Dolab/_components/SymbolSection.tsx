"use client";

import React, { useEffect, useState, Dispatch, SetStateAction } from "react";
import Image from "next/image";
import { Edge, Node } from "@xyflow/react";
import { log } from "console";

interface SymbolItem {
  key: string;
  label: string;
  imageSrc: string;
}

interface SymbolSectionProps {
  edge?: Edge;
  onAddNode?: (type: string, label: string, anchorId?: string) => void;
  nodeToEdit?: Node | null;
  onUpdateNode?: (id: string, type: string, label: string) => void;
  onDeleteNode?: (id: string) => void;
  onCloseModal?: () => void;
}

/* --- Validation Helpers --- */
const validateConditionalExpression = (exp: string): string => {
  const trimmedExp = exp.trim();
  if (trimmedExp === "") return "กรุณาใส่เงื่อนไข (Condition)";

  const operators = /==|!=|>=|<=|>|</;
  if (!operators.test(trimmedExp)) return "เงื่อนไขไม่ถูกต้อง (ต้องมีตัวเปรียบเทียบ เช่น >, <, ==)";

  const parts = trimmedExp.split(operators);
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

/* --- Field types (ชัดเจน) --- */
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
  fields: FieldSimple[]; // reuse FieldSimple inside group
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
  onAddNode,
  nodeToEdit,
  onUpdateNode,
  onDeleteNode,
  onCloseModal,
}) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [error, setError] = useState("");

  // fields
  const [inputValue, setInputValue] = useState("");
  const [outputValue, setOutputValue] = useState("");
  const [ifExpression, setIfExpression] = useState("");
  const [whileExpression, setWhileExpression] = useState("");
  const [declareVariable, setDeclareVariable] = useState("");
  const [declareDataType, setDeclareDataType] = useState("Integer");
  const [assignVariable, setAssignVariable] = useState("");
  const [assignExpression, setAssignExpression] = useState("");
  const [forVariable, setForVariable] = useState("");
  const [forStart, setForStart] = useState("");
  const [forEnd, setForEnd] = useState("");
  const [forStep, setForStep] = useState("");
  const [doExpression, setDoExpression] = useState("");

  const callUpdateOrAdd = (nodeId: string | undefined, type: string, label: string) => {
    if (nodeToEdit && onUpdateNode && nodeId) {
      onUpdateNode(nodeId, type, label);
    } else {
      onAddNode?.(type, label, nodeToEdit?.id);
    }
    // reset
    setInputValue("");
    setOutputValue("");
    setIfExpression("");
    setWhileExpression("");
    setDeclareVariable("");
    setDeclareDataType("Integer");
    setAssignVariable("");
    setAssignExpression("");
    setForVariable("");
    setForStart("");
    setForEnd("");
    setForStep("");
    setDoExpression("");
  };

  const handleDeleteClick = () => {
    if (!nodeToEdit || !onDeleteNode) return;
    const ok = window.confirm(
      "ต้องการลบ node นี้ใช่หรือไม่? การลบจะลบ node นี้พร้อม edges ที่เกี่ยวข้องและ nodes ที่ไม่สามารถเข้าถึงได้จาก Start"
    );
    if (!ok) return;
    onDeleteNode(nodeToEdit.id);
    onCloseModal?.();
  };

  // prefill on edit
  useEffect(() => {
    if (!nodeToEdit) return;
    const t = nodeToEdit.type;
    const label = String(nodeToEdit.data?.label ?? "");

    // reset fields
    setInputValue("");
    setOutputValue("");
    setIfExpression("");
    setWhileExpression("");
    setDeclareVariable("");
    setDeclareDataType("Integer");
    setAssignVariable("");
    setAssignExpression("");
    setForVariable("");
    setForStart("");
    setForEnd("");
    setForStep("");
    setDoExpression("");
    setError("");

    if (t === "input") {
      setInputValue(label.replace(/^Input\s+/i, ""));
      setActiveModal("input");
    } else if (t === "output") {
      setOutputValue(label.replace(/^Output\s+/i, ""));
      setActiveModal("output");
    } else if (t === "declare") {
      const parts = label.split(/\s+/);
      if (parts.length >= 2) {
        setDeclareDataType(parts[0]);
        setDeclareVariable(parts.slice(1).join(" "));
      } else {
        setDeclareVariable(label);
      }
      setActiveModal("declare");
    } else if (t === "assign") {
      const m = label.split("=");
      if (m.length >= 2) {
        setAssignVariable(m[0].trim());
        setAssignExpression(m.slice(1).join("=").trim());
      } else {
        setAssignVariable(label);
      }
      setActiveModal("assign");
    } else if (t === "ifNode" || t === "if") {
      setIfExpression(label);
      setActiveModal("if");
    } else if (t === "whileNode" || t === "while") {
      setWhileExpression(label);
      setActiveModal("while");
    } else if (t === "forNode" || t === "for") {
      const forMatch = label.match(/^(.+?)\s*=\s*(.+?)\s+to\s+(.+)$/i);
      if (forMatch) {
        setForVariable(forMatch[1].trim());
        setForStart(forMatch[2].trim());
        setForEnd(forMatch[3].trim());
      } else {
        setForVariable(label);
      }
      setActiveModal("for");
    } else if (t === "do") {
      setDoExpression(label);
      setActiveModal("do");
    }
  }, [nodeToEdit]);

  const closeAll = () => {
    setActiveModal(null);
    setError("");
    onCloseModal?.();
  };

  // modal configs (ใช้ FieldSimple / FieldGroup)
  const modalConfigs: ModalConfig[] = [
    {
      key: "input",
      title: "Input Properties",
      description: "A Input Statement reads a value from the keyboard and stores it in a variable.",
      icon: "/images/Rectangle.png",
      fields: [
        { kind: "simple", key: "variable", placeholder: "Variable name", value: inputValue, setValue: setInputValue },
      ],
      onSubmit: (e) => {
        e.preventDefault();
        if (inputValue.trim() === "") {
          setError("กรุณาใส่ชื่อ Variable");
          return;
        }
        callUpdateOrAdd(nodeToEdit?.id, "input", `Input ${inputValue}`);
        closeAll();
      },
      onClose: () => {
        setInputValue("");
        closeAll();
      },
    },
    {
      key: "output",
      title: "Output Properties",
      description: "An Output Statement displays the result of an expression to the screen.",
      icon: "/images/Rectangle.png",
      fields: [
        { kind: "simple", key: "value", placeholder: 'Variable or "string"', value: outputValue, setValue: setOutputValue },
      ],
      onSubmit: (e) => {
        e.preventDefault();
        const validationError = validateOutput(outputValue);
        if (validationError) {
          setError(validationError);
          return;
        }
        callUpdateOrAdd(nodeToEdit?.id, "output", `Output ${outputValue}`);
        closeAll();
      },
      onClose: () => {
        setOutputValue("");
        closeAll();
      },
    },
    {
      key: "declare",
      title: "Declare Properties",
      description: "A Declare Statement is used to create variables and arrays.",
      icon: "/images/shape_Declare.png",
      fields: [{ kind: "simple", key: "variable", placeholder: "e.g., a", value: declareVariable, setValue: setDeclareVariable }],
      onSubmit: (e) => {
        e.preventDefault();
        if (declareVariable.trim() === "") {
          setError("กรุณาใส่ชื่อ Variable");
          return;
        }
        callUpdateOrAdd(nodeToEdit?.id, "declare", `${declareDataType} ${declareVariable}`);
        closeAll();
      },
      onClose: () => {
        setDeclareVariable("");
        setDeclareDataType("Integer");
        closeAll();
      },
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
        if (assignVariable.trim() === "" || assignExpression.trim() === "") {
          setError("กรุณากรอกข้อมูลทั้ง Variable และ Expression");
          return;
        }
        callUpdateOrAdd(nodeToEdit?.id, "assign", `${assignVariable} = ${assignExpression}`);
        closeAll();
      },
      onClose: () => {
        setAssignVariable("");
        setAssignExpression("");
        closeAll();
      },
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
        if (validationError) {
          setError(validationError);
          return;
        }
        callUpdateOrAdd(nodeToEdit?.id, "if", ifExpression);
        closeAll();
      },
      onClose: () => {
        setIfExpression("");
        closeAll();
      },
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
        if (validationError) {
          setError(validationError);
          return;
        }
        callUpdateOrAdd(nodeToEdit?.id, "while", whileExpression);
        closeAll();
      },
      onClose: () => {
        setWhileExpression("");
        closeAll();
      },
    },
    {
      key: "for",
      title: "For Properties",
      description: "A For Loop increments or decrements a variable through a range of values.",
      icon: "/images/shape_while.png",
      fields: [
        {
          kind: "group",
          key: "group",
          fields: [
            { kind: "simple", key: "variable", placeholder: "e.g., a", value: forVariable, setValue: setForVariable },
            { kind: "simple", key: "step", placeholder: "e.g., 1", value: forStep, setValue: setForStep },
            { kind: "simple", key: "start", placeholder: "e.g., 0", value: forStart, setValue: setForStart },
            { kind: "simple", key: "end", placeholder: "e.g., 10", value: forEnd, setValue: setForEnd },
          ],
        },
      ],
      onSubmit: (e) => {
        e.preventDefault();
        if (!forVariable.trim() || !forStart.trim() || !forEnd.trim() || !forStep.trim()) {
          setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
          return;
        }
        if (isNaN(Number(forStart)) || isNaN(Number(forEnd)) || isNaN(Number(forStep))) {
          setError("ค่า Start, End, และ Step By ต้องเป็นตัวเลขเท่านั้น");
          return;
        }
        callUpdateOrAdd(nodeToEdit?.id, "for", `${forVariable} = ${forStart} to ${forEnd}`);
        closeAll();
      },
      onClose: () => {
        setForVariable("");
        setForStart("");
        setForEnd("");
        setForStep("");
        closeAll();
      },
    },
    {
      key: "do",
      title: "Do-While Properties",
      description: "A Do-While loop executes body then checks condition.",
      icon: "/images/shape_while.png",
      fields: [{ kind: "simple", key: "condition", placeholder: "e.g., i < 10", value: doExpression, setValue: setDoExpression }],
      onSubmit: (e) => {
        e.preventDefault();
        const validationError = validateConditionalExpression(doExpression);
        if (validationError) {
          setError(validationError);
          return;
        }
        callUpdateOrAdd(nodeToEdit?.id, "do", doExpression);
        closeAll();
      },
      onClose: () => {
        setDoExpression("");
        closeAll();
      },
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
    <div
      className="flex flex-col items-center gap-1 cursor-pointer"
      onClick={() => {
        setError("");
        setActiveModal(item.key);
      }}
    >
      <Image src={item.imageSrc} alt={item.label} width={100} height={60} />
      <span className="text-sm text-gray-700">{item.label}</span>
    </div>
  );

  /* --- Render active modal if any --- */
  if (activeModal) {
    const cfg = modalConfigs.find((m) => m.key === activeModal);
    console.log(cfg);
    
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

          {/* render fields */}
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
            }

            // f is FieldSimple here (narrowed)
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

          {/* declare modal: render data type radios */}
          {activeModal === "declare" && (
            <>
              <div className="text-gray-700 mb-2 ml-4">Data Type</div>
              <div className="grid grid-cols-2 gap-2 ml-6 mb-4">
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
            </>
          )}

          {error && <div className="text-red-500 text-xs ml-6 -mt-2 mb-2">{error}</div>}

          <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
            <button type="button" onClick={() => modalConfigs.find(m => m.key === activeModal)!.onClose()} className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer">
              Ok
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
