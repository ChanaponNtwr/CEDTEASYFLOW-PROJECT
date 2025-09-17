"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Edge, Node } from "@xyflow/react";

interface SymbolItem {
  label: string;
  imageSrc: string;
}

interface SymbolSectionProps {
  edge?: Edge;
  onAddNode?: (type: string, label: string, anchorId?: string) => void;

  // editing support
  nodeToEdit?: Node | null;
  onUpdateNode?: (id: string, type: string, label: string) => void;
  onDeleteNode?: (id: string) => void;
  onCloseModal?: () => void;
}

// --- Validation Helper Functions ---
const validateConditionalExpression = (exp: string): string => {
  const trimmedExp = exp.trim();
  if (trimmedExp === "") {
    return "กรุณาใส่เงื่อนไข (Condition)";
  }

  const operators = /==|!=|>=|<=|>|</;
  if (!operators.test(trimmedExp)) {
    return "เงื่อนไขไม่ถูกต้อง (ต้องมีตัวเปรียบเทียบ เช่น >, <, ==)";
  }

  const parts = trimmedExp.split(operators);
  if (parts.length < 2 || parts.some((p) => p.trim() === "")) {
    return "เงื่อนไขไม่สมบูรณ์ (เช่น 'a >' หรือ '< 10')";
  }

  return ""; // No error
};

const validateOutput = (output: string): string => {
  const trimmedOutput = output.trim();
  if (trimmedOutput === "") {
    return "กรุณาใส่ค่าที่ต้องการแสดงผล";
  }

  const startsWithQuote = trimmedOutput.startsWith('"');
  const endsWithQuote = trimmedOutput.endsWith('"');

  if (startsWithQuote && !endsWithQuote) {
    return 'รูปแบบ String ไม่ถูกต้อง (ขาดเครื่องหมาย " ปิดท้าย)';
  }
  if (!startsWithQuote && endsWithQuote) {
    return 'รูปแบบ String ไม่ถูกต้อง (ขาดเครื่องหมาย " เปิด)';
  }

  return "";
};

const SymbolSection: React.FC<SymbolSectionProps> = ({
  onAddNode,
  edge,
  nodeToEdit,
  onUpdateNode,
  onDeleteNode,
  onCloseModal,
}) => {
  const [showInputModal, setShowInputModal] = useState(false);
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showIfModal, setShowIfModal] = useState(false);
  const [showWhileModal, setShowWhileModal] = useState(false);
  const [showForModal, setShowForModal] = useState(false);
  const [showDoModal, setShowDoModal] = useState(false);

  // States for modal inputs
  const [inputValue, setInputValue] = useState("");
  const [outputValue, setOutputValue] = useState("");
  const [ifExpression, setIfExpression] = useState("");
  const [whileExpression, setWhileExpression] = useState("");

  // Declare states
  const [declareVariable, setDeclareVariable] = useState("");
  const [declareDataType, setDeclareDataType] = useState("Integer");

  // Assign states
  const [assignVariable, setAssignVariable] = useState("");
  const [assignExpression, setAssignExpression] = useState("");

  // For loop states
  const [forVariable, setForVariable] = useState("");
  const [forStart, setForStart] = useState("");
  const [forEnd, setForEnd] = useState("");
  const [forStep, setForStep] = useState("");

  // Do-While state
  const [doExpression, setDoExpression] = useState("");

  const [error, setError] = useState("");

  const symbols: Record<string, SymbolItem> = {
    input: { label: "Input", imageSrc: "/images/input.png" },
    output: { label: "Output", imageSrc: "/images/output.png" },
    declare: { label: "Declare", imageSrc: "/images/declare.png" },
    assign: { label: "Assign", imageSrc: "/images/assign.png" },
    if: { label: "IF", imageSrc: "/images/if.png" },
    call: { label: "Call", imageSrc: "/images/call.png" },
    while: { label: "While", imageSrc: "/images/while.png" },
    for: { label: "For", imageSrc: "/images/for.png" },
    do: { label: "Do", imageSrc: "/images/do.png" },
  };

  // Handlers
  const handleInputClick = () => openModal("input");
  const handleOutputClick = () => openModal("output");
  const handleDeclareClick = () => openModal("declare");
  const handleAssignClick = () => openModal("assign");
  const handleIfClick = () => openModal("if");
  const handleWhileClick = () => openModal("while");
  const handleForClick = () => openModal("for");
  const handleDoClick = () => openModal("do");

  const openModal = (type: string) => {
    closeAll();
    setError("");
    switch (type) {
      case "input":
        setShowInputModal(true);
        break;
      case "output":
        setShowOutputModal(true);
        break;
      case "declare":
        setShowDeclareModal(true);
        break;
      case "assign":
        setShowAssignModal(true);
        break;
      case "if":
        setShowIfModal(true);
        break;
      case "while":
        setShowWhileModal(true);
        break;
      case "for":
        setShowForModal(true);
        break;
      case "do":
        setShowDoModal(true);
        break;
      default:
        break;
    }
  };

  const closeAll = () => {
    setShowInputModal(false);
    setShowOutputModal(false);
    setShowDeclareModal(false);
    setShowAssignModal(false);
    setShowIfModal(false);
    setShowWhileModal(false);
    setShowForModal(false);
    setShowDoModal(false);
    setError("");
  };

  const handleCloseInputModal = () => {
    setShowInputModal(false);
    setError("");
    if (onCloseModal) onCloseModal();
  };
  const handleCloseOutputModal = () => {
    setShowOutputModal(false);
    setError("");
    if (onCloseModal) onCloseModal();
  };
  const handleCloseDeclareModal = () => {
    setShowDeclareModal(false);
    setError("");
    if (onCloseModal) onCloseModal();
  };
  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setError("");
    if (onCloseModal) onCloseModal();
  };
  const handleCloseIfModal = () => {
    setShowIfModal(false);
    setError("");
    if (onCloseModal) onCloseModal();
  };
  const handleCloseWhileModal = () => {
    setShowWhileModal(false);
    setError("");
    if (onCloseModal) onCloseModal();
  };
  const handleCloseForModal = () => {
    setShowForModal(false);
    setError("");
    if (onCloseModal) onCloseModal();
  };
  const handleCloseDoModal = () => {
    setShowDoModal(false);
    setError("");
    if (onCloseModal) onCloseModal();
  };

  const handlers: Record<string, () => void> = {
    Input: handleInputClick,
    Output: handleOutputClick,
    Declare: handleDeclareClick,
    Assign: handleAssignClick,
    IF: handleIfClick,
    While: handleWhileClick,
    For: handleForClick,
    Do: handleDoClick,
  };

  const SymbolItemComponent: React.FC<{ item: SymbolItem }> = ({ item }) => (
    <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handlers[item.label]}>
      <Image src={item.imageSrc} alt={item.label} width={100} height={60} />
      <span className="text-sm text-gray-700">{item.label}</span>
    </div>
  );

  // When nodeToEdit changes, prefill fields & open correct modal
  useEffect(() => {
    if (!nodeToEdit) return;
    const t = nodeToEdit.type;
    const label = String(nodeToEdit.data?.label ?? "");

    // reset all fields first
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
    // open corresponding modal and try to parse label
    if (t === "input") {
      const v = label.replace(/^Input\s+/i, "");
      setInputValue(v);
      openModal("input");
    } else if (t === "output") {
      const v = label.replace(/^Output\s+/i, "");
      setOutputValue(v);
      openModal("output");
    } else if (t === "declare") {
      const parts = label.split(/\s+/);
      if (parts.length >= 2) {
        setDeclareDataType(parts[0]);
        setDeclareVariable(parts.slice(1).join(" "));
      } else {
        setDeclareVariable(label);
      }
      openModal("declare");
    } else if (t === "assign") {
      const m = label.split("=");
      if (m.length >= 2) {
        setAssignVariable(m[0].trim());
        setAssignExpression(m.slice(1).join("=").trim());
      } else {
        setAssignVariable(label);
      }
      openModal("assign");
    } else if (t === "ifNode" || t === "if") {
      setIfExpression(label);
      openModal("if");
    } else if (t === "whileNode" || t === "while") {
      setWhileExpression(label);
      openModal("while");
    } else if (t === "forNode" || t === "for") {
      // expect: "a = 0 to 10" or similar
      const forMatch = label.match(/^(.+?)\s*=\s*(.+?)\s+to\s+(.+)$/i);
      if (forMatch) {
        setForVariable(forMatch[1].trim());
        setForStart(forMatch[2].trim());
        setForEnd(forMatch[3].trim());
      } else {
        setForVariable(label);
      }
      openModal("for");
    } else if (t === "do") {
      setDoExpression(label);
      openModal("do");
    } else {
      // fallback: don't open anything
    }
  }, [nodeToEdit]);

  // --- Submit Handlers ---
  const callUpdateOrAdd = (nodeId: string | undefined, type: string, label: string) => {
    if (nodeToEdit && onUpdateNode && nodeId) {
      onUpdateNode(nodeId, type, label);
    } else {
      // pass anchorId when adding from inside node edit modal
      onAddNode?.(type, label, nodeToEdit?.id);
    }
    // reset internal fields
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

  const handleInputSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (inputValue.trim() === "") {
      setError("กรุณาใส่ชื่อ Variable");
      return;
    }
    const label = `Input ${inputValue}`;
    callUpdateOrAdd(nodeToEdit?.id, "input", label);
    handleCloseInputModal();
  };

  const handleOutputSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateOutput(outputValue);
    if (validationError) {
      setError(validationError);
      return;
    }
    const label = `Output ${outputValue}`;
    callUpdateOrAdd(nodeToEdit?.id, "output", label);
    handleCloseOutputModal();
  };

  const handleDeclareSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (declareVariable.trim() === "") {
      setError("กรุณาใส่ชื่อ Variable");
      return;
    }
    const label = `${declareDataType} ${declareVariable}`;
    callUpdateOrAdd(nodeToEdit?.id, "declare", label);
    handleCloseDeclareModal();
  };

  const handleAssignSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (assignVariable.trim() === "" || assignExpression.trim() === "") {
      setError("กรุณากรอกข้อมูลทั้ง Variable และ Expression");
      return;
    }
    const label = `${assignVariable} = ${assignExpression}`;
    callUpdateOrAdd(nodeToEdit?.id, "assign", label);
    handleCloseAssignModal();
  };

  const handleIfSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateConditionalExpression(ifExpression);
    if (validationError) {
      setError(validationError);
      return;
    }
    callUpdateOrAdd(nodeToEdit?.id, "if", ifExpression);
    handleCloseIfModal();
  };

  const handleWhileSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateConditionalExpression(whileExpression);
    if (validationError) {
      setError(validationError);
      return;
    }
    callUpdateOrAdd(nodeToEdit?.id, "while", whileExpression);
    handleCloseWhileModal();
  };

  const handleForSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!forVariable.trim() || !forStart.trim() || !forEnd.trim() || !forStep.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    if (isNaN(Number(forStart)) || isNaN(Number(forEnd)) || isNaN(Number(forStep))) {
      setError("ค่า Start, End, และ Step By ต้องเป็นตัวเลขเท่านั้น");
      return;
    }
    const label = `${forVariable} = ${forStart} to ${forEnd}`;
    callUpdateOrAdd(nodeToEdit?.id, "for", label);
    handleCloseForModal();
  };

  const handleDoSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateConditionalExpression(doExpression);
    if (validationError) {
      setError(validationError);
      return;
    }
    callUpdateOrAdd(nodeToEdit?.id, "do", doExpression);
    handleCloseDoModal();
  };

  // DELETE helper (only when editing)
  const handleDeleteClick = () => {
    if (!nodeToEdit || !onDeleteNode) return;
    const ok = window.confirm("ต้องการลบ node นี้ใช่หรือไม่? การลบจะลบ node นี้พร้อม edges ที่เกี่ยวข้องและ nodes ที่ไม่สามารถเข้าถึงได้จาก Start");
    if (!ok) return;
    onDeleteNode(nodeToEdit.id);
    if (onCloseModal) onCloseModal();
  };

  // --- Rendering modals (same UI as before) ---
  if (showInputModal) {
    return (
      <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
        <form onSubmit={handleInputSubmit}>
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-800 mb-4">Input Properties</div>
            {nodeToEdit && (
              <button type="button" onClick={handleDeleteClick} className="text-sm text-red-600 mr-4">Delete</button>
            )}
          </div>
          <input
            type="text"
            placeholder="Variable name"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          {error && <div className="text-red-500 text-xs ml-6 -mt-2 mb-2">{error}</div>}
          <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
            <button
              type="button"
              onClick={() => {
                handleCloseInputModal();
                setInputValue("");
              }}
              className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
            >
              Ok
            </button>
          </div>
        </form>
        <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
          <img src="/images/Rectangle.png" alt="Icon" className="w-50 h-7" />
          <span className="text-gray-600 text-sm">A Input Statement reads a value from the keyboard and stores it in a variable.</span>
        </div>
      </div>
    );
  }

  if (showOutputModal) {
    return (
      <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
        <form onSubmit={handleOutputSubmit}>
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-800 mb-4">Output Properties</div>
            {nodeToEdit && (
              <button type="button" onClick={handleDeleteClick} className="text-sm text-red-600 mr-4">Delete</button>
            )}
          </div>
          <input
            type="text"
            placeholder='Variable or "string"'
            value={outputValue}
            onChange={(e) => setOutputValue(e.target.value)}
            className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          {error && <div className="text-red-500 text-xs ml-6 -mt-2 mb-2">{error}</div>}
          <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
            <button
              type="button"
              onClick={() => {
                handleCloseOutputModal();
                setOutputValue("");
              }}
              className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
            >
              Ok
            </button>
          </div>
        </form>
        <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
          <img src="/images/Rectangle.png" alt="Icon" className="w-50 h-7" />
          <span className="text-gray-600 text-sm">An Output Statement displays the result of an expression to the screen.</span>
        </div>
      </div>
    );
  }

  if (showDeclareModal) {
    return (
      <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
        <form onSubmit={handleDeclareSubmit}>
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">Declare Properties</div>
            {nodeToEdit && <button type="button" onClick={handleDeleteClick} className="text-sm text-red-600 mr-4">Delete</button>}
          </div>
          <div className="text-gray-700 mb-2 ml-4">Variable Name</div>
          <input type="text" placeholder="e.g., a" value={declareVariable} onChange={(e) => setDeclareVariable(e.target.value)} className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"/>
          {error && <div className="text-red-500 text-xs ml-6 -mt-2 mb-2">{error}</div>}
          <div className="text-gray-700 mb-2 ml-4">Data Type</div>
          <div className="grid grid-cols-2 gap-2 ml-6 mb-4">
            <label className="flex items-center gap-1 text-sm text-gray-700"><input type="radio" name="dataType" value="Integer" checked={declareDataType === "Integer"} onChange={(e) => setDeclareDataType(e.target.value)} className="w-4 h-4"/> Integer</label>
            <label className="flex items-center gap-1 text-sm text-gray-700"><input type="radio" name="dataType" value="Real" checked={declareDataType === "Real"} onChange={(e) => setDeclareDataType(e.target.value)} className="w-4 h-4"/> Real</label>
            <label className="flex items-center gap-1 text-sm text-gray-700"><input type="radio" name="dataType" value="String" checked={declareDataType === "String"} onChange={(e) => setDeclareDataType(e.target.value)} className="w-4 h-4"/> String</label>
            <label className="flex items-center gap-1 text-sm text-gray-700"><input type="radio" name="dataType" value="Boolean" checked={declareDataType === "Boolean"} onChange={(e) => setDeclareDataType(e.target.value)} className="w-4 h-4"/> Boolean</label>
          </div>
          <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
            <button type="button" onClick={handleCloseDeclareModal} className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer">Cancel</button>
            <button type="submit" className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer">Ok</button>
          </div>
        </form>
        <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
          <img src="/images/shape_Declare.png" alt="Icon" className="w-50 h-7" />
          <span className="text-gray-600 text-sm">A Declare Statement is used to create variables and arrays.</span>
        </div>
      </div>
    );
  }

  if (showAssignModal) {
    return (
      <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
        <form onSubmit={handleAssignSubmit}>
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">Assign Properties</div>
            {nodeToEdit && <button type="button" onClick={handleDeleteClick} className="text-sm text-red-600 mr-4">Delete</button>}
          </div>
          <div className="text-gray-700 mb-2 ml-4">Variable</div>
          <input type="text" placeholder="e.g., a" value={assignVariable} onChange={(e) => setAssignVariable(e.target.value)} className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"/>
          <div className="text-gray-700 mb-2 ml-4">Expression</div>
          <input type="text" placeholder="e.g., 10" value={assignExpression} onChange={(e) => setAssignExpression(e.target.value)} className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"/>
          {error && <div className="text-red-500 text-xs ml-6 -mt-2 mb-2">{error}</div>}
          <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
            <button type="button" onClick={handleCloseAssignModal} className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer">Cancel</button>
            <button type="submit" className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer">Ok</button>
          </div>
        </form>
        <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
          <img src="/images/square.png" alt="Icon" className="w-50 h-7" />
          <span className="text-gray-600 text-sm">An Assignment Statement stores the result of an expression in a variable.</span>
        </div>
      </div>
    );
  }

  if (showIfModal) {
    return (
      <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
        <form onSubmit={handleIfSubmit}>
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">If Properties</div>
            {nodeToEdit && <button type="button" onClick={handleDeleteClick} className="text-sm text-red-600 mr-4">Delete</button>}
          </div>
          <div className="text-gray-700 mb-2 ml-4">Enter a conditional expression below</div>
          <input
            type="text"
            placeholder="e.g., a > 10"
            value={ifExpression}
            onChange={(e) => setIfExpression(e.target.value)}
            className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          {error && <div className="text-red-500 text-xs ml-6 -mt-2 mb-2">{error}</div>}
          <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
            <button type="button" onClick={handleCloseIfModal} className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
            >
              Ok
            </button>
          </div>
        </form>
        <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
          <img src="/images/shape_if.png" alt="Icon" className="w-50 h-10" />
          <span className="text-gray-600 text-sm">An IF Statement checks a Boolean expression and executes a branch based on the result.</span>
        </div>
      </div>
    );
  }

  if (showWhileModal) {
    return (
      <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
        <form onSubmit={handleWhileSubmit}>
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">While Properties</div>
            {nodeToEdit && <button type="button" onClick={handleDeleteClick} className="text-sm text-red-600 mr-4">Delete</button>}
          </div>
          <div className="text-gray-700 mb-2 ml-4">Enter a loop condition below</div>
          <input
            type="text"
            placeholder="e.g., count < 10"
            value={whileExpression}
            onChange={(e) => setWhileExpression(e.target.value)}
            className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          {error && <div className="text-red-500 text-xs ml-6 -mt-2 mb-2">{error}</div>}
          <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
            <button type="button" onClick={handleCloseWhileModal} className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
            >
              Ok
            </button>
          </div>
        </form>
        <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
          <img src="/images/shape_while.png" alt="Icon" className="w-50 h-10" />
          <span className="text-gray-600 text-sm">A WHILE Statement repeatedly executes code as long as the condition is true.</span>
        </div>
      </div>
    );
  }

  if (showForModal) {
    return (
      <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
        <form onSubmit={handleForSubmit}>
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">For Properties</div>
            {nodeToEdit && <button type="button" onClick={handleDeleteClick} className="text-sm text-red-600 mr-4">Delete</button>}
          </div>
          <div className="grid grid-cols-2 gap-4 ml-6 mb-4">
            <div className="flex flex-col mr-4">
              <label className="text-gray-700 text-sm mb-1">Variable</label>
              <input type="text" placeholder="e.g., a" value={forVariable} onChange={(e) => setForVariable(e.target.value)} className="w-full border border-gray-400 rounded-md px-2 py-1 text-sm"/>
            </div>
            <div className="flex flex-col mr-3">
              <label className="text-gray-700 text-sm mb-1">Step By</label>
              <input type="text" placeholder="e.g., 1" value={forStep} onChange={(e) => setForStep(e.target.value)} className="w-full border border-gray-400 rounded-md px-2 py-1 text-sm"/>
            </div>
            <div className="flex flex-col mr-4">
              <label className="text-gray-700 text-sm mb-1">Start</label>
              <input type="text" placeholder="e.g., 0" value={forStart} onChange={(e) => setForStart(e.target.value)} className="w-full border border-gray-400 rounded-md px-2 py-1 text-sm"/>
            </div>
            <div className="flex flex-col mr-3">
              <label className="text-gray-700 text-sm mb-1">End</label>
              <input type="text" placeholder="e.g., 10" value={forEnd} onChange={(e) => setForEnd(e.target.value)} className="w-full border border-gray-400 rounded-md px-2 py-1 text-sm"/>
            </div>
          </div>
          {error && <div className="text-red-500 text-xs ml-6 mb-2">{error}</div>}
          <div className="text-gray-700 mb-2 ml-6 text-sm">Direction</div>
          <label className="flex items-center gap-1 text-sm text-gray-700 ml-8">
            <input type="radio" name="direction" value="increasing" defaultChecked className="w-4 h-4" /> Increasing
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-700 ml-8 mt-3">
            <input type="radio" name="direction" value="decreasing" className="w-4 h-4" /> decreasing
          </label>
          <div className="flex justify-end gap-3 mt-3 mr-4 text-xs">
            <button type="button" onClick={handleCloseForModal} className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
            >
              Ok
            </button>
          </div>
        </form>
        <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
          <img src="/images/shape_while.png" alt="Icon" className="w-50 h-10" />
          <span className="text-gray-600 text-sm">A For Loop increments or decrements a variable through a range of values.</span>
        </div>
      </div>
    );
  }

  // --- Symbol Section (palette) ---
  return (
    <div className="w-full bg-white p-4 flex flex-col gap-4 rounded-lg shadow-lg border-1">
      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Input / Output</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.input} />
          <SymbolItemComponent item={symbols.output} />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Variables</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.declare} />
          <SymbolItemComponent item={symbols.assign} />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Control</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.if} />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Looping</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.while} />
          <SymbolItemComponent item={symbols.for} />
        </div>
      </div>
    </div>
  );
};

export default SymbolSection;
