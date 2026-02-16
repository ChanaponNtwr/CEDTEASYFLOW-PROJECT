"use client";

import { useEffect, useRef, useState } from "react";
import { FaPlay, FaStepForward, FaStop } from "react-icons/fa";
import {
  executeStepNode,
  apiGetFlowchart,
  apiResetFlowchart,
  apiRunTestcaseFromFlowchart,
  apiGetLab,
  apiSubmitFlowchart,
} from "@/app/service/FlowchartService";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Variable = { name: string; value: any };

type NodeResult = {
  id: string | number;
  type: string;
  label: string;
  data?: any;
  position?: { x: number; y: number } | null;
  incomingEdgeIds?: string[];
  outgoingEdgeIds?: string[];
  loopExitEdge?: any;
  variables?: Variable[];
};

type ExecContext = { variables?: Variable[]; index_map?: Record<string, number>; output?: any[] };

type ExecResult = { node?: NodeResult; context?: ExecContext; done?: boolean; paused?: boolean };

type ExecuteResponse = {
  ok: boolean;
  result?: ExecResult;
  nextNodeId?: string | number;
  nextNodeType?: string | number;
  context?: { variables?: Variable[]; output?: any[] };
  paused?: boolean;
  done?: boolean;
  reenter?: boolean;
  [k: string]: any;
};

interface TopBarControlsProps {
  flowchartId?: number | string | null;
  labId?: number | string | null;
  initialVariables?: Variable[] | null;
  forceAdvanceBP?: boolean;
  onHighlightNode?: (nodeId: string | number | null) => void;
  autoPlayInputs?: boolean;
  classId?: number | string | null;
  /**
   * เมื่อเป็น true จะซ่อนปุ่ม Submit ทั้งหมด (ไม่สามารถส่งงานได้)
   * ใช้กรณีเข้า DoLab มาจากหน้า Profile ที่ต้องการห้ามส่งงาน
   */
  disableSubmit?: boolean;
}

export default function TopBarControls({
  flowchartId,
  labId,
  initialVariables = null,
  forceAdvanceBP = true,
  onHighlightNode,
  autoPlayInputs = false,
  classId = null,
  disableSubmit = false,
}: TopBarControlsProps) {
  const { data: session } = useSession();

  // --- standard UI state ---
  const [showPopup, setShowPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [variablesSent, setVariablesSent] = useState(false);
  const [lastResponse, setLastResponse] = useState<ExecuteResponse | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fetchedVariables, setFetchedVariables] = useState<Variable[] | null>(null);
  const [fetchingVars, setFetchingVars] = useState(false);

  const [chatMessages, setChatMessages] = useState<{ sender: "system" | "user"; text: string }[]>([]);
  const [expectingInput, setExpectingInput] = useState(false);
  const [inputValue, setInputValue] = useState<any>("");

  const [inputNodeId, setInputNodeId] = useState<string | number | null>(null);
  const [inputVarName, setInputVarName] = useState<string | null>(null);

  // outputResumeRef no longer used for pause, but kept for cleanup compatibility
  const outputResumeRef = useRef<(() => void) | null>(null); 
  const [pendingHighlightAfterOutput, setPendingHighlightAfterOutput] = useState<string | number | null>(null);

  const runAllActiveRef = useRef(false);
  const runAllWaitingForInputRef = useRef<((resp?: any) => void) | null>(null);

  // --- New State for Robust Lab ID Handling ---
  const [detectedLabId, setDetectedLabId] = useState<string | number | null>(null);

  // --- Submit State ---
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const togglePopup = () => setShowPopup((v) => !v);

  const isEndType = (t?: string | number | null) => {
    if (!t) return false;
    const s = String(t).toUpperCase().trim();
    return ["EN", "END", "ED", "TERMINATE", "ENDNODE", "EXIT"].includes(s);
  };

  // --- Fetch variables declared in flowchart ---
  useEffect(() => {
    let mounted = true;
    const fetchVars = async () => {
      if (initialVariables && initialVariables.length > 0) {
        setFetchedVariables(initialVariables);
        return;
      }
      if (!flowchartId) {
        setFetchedVariables([]);
        return;
      }

      try {
        setFetchingVars(true);
        const resp = await apiGetFlowchart(flowchartId);
        
        const nodes: any[] = resp?.flowchart?.nodes ?? resp?.nodes ?? [];

        const varNodes = nodes.filter((n) => {
          const t = String(n?.type ?? "").toUpperCase();
          return t === "DC" || t === "DECLARE" || t === "VAR";
        });

        const vars: Variable[] = varNodes.flatMap((n) => {
          if (Array.isArray(n.variables) && n.variables.length > 0) {
            return n.variables.map((v: any) => ({ name: v.name, value: v.value ?? 0 }));
          }
          const d = n?.data ?? {};
          const name = d?.name ?? d?.variable ?? n?.label ?? `var_${n?.id ?? "unknown"}`;
          const value = d?.value ?? 0;
          return [{ name, value }];
        });

        if (mounted) setFetchedVariables(vars);
      } catch (err) {
        console.error("failed to fetch flowchart for variables", err);
        const message = err instanceof Error ? err.message : String(err);
        setErrorMsg((prev) => prev ?? `fetch vars: ${message}`);
        if (mounted) setFetchedVariables([]);
      } finally {
        if (mounted) setFetchingVars(false);
      }
    };

    fetchVars();
    return () => {
      mounted = false;
    };
  }, [flowchartId, initialVariables]);

  // helper: อ่านชื่อตัวแปรตัวแรกจาก node
  const getFirstVarNameForNode = async (nodeId?: string | number | null): Promise<string | undefined> => {
    if (!nodeId) return undefined;

    const nodeFromLast = lastResponse?.result?.node;
    if (nodeFromLast && String(nodeFromLast.id) === String(nodeId)) {
      const v = nodeFromLast.variables?.[0]?.name;
      if (v) return v;
      const d = nodeFromLast.data ?? {};
      const name = d?.name ?? d?.variable ?? nodeFromLast?.label;
      if (name) return name;
    }

    const maybeVars = lastResponse?.result?.context?.variables;
    if (Array.isArray(maybeVars) && maybeVars.length > 0) {
      return maybeVars[0].name;
    }

    try {
      if (!flowchartId) return undefined;
      const flowResp = await apiGetFlowchart(flowchartId);
      const nodes: any[] = flowResp?.flowchart?.nodes ?? flowResp?.nodes ?? [];
      const target = nodes.find((n) => String(n?.id) === String(nodeId));
      if (target) {
        if (Array.isArray(target.variables) && target.variables.length > 0) {
          return target.variables[0].name;
        }
        const d = target?.data ?? {};
        const name = d?.name ?? d?.variable ?? target?.label;
        if (name) return name;
      }
    } catch (err) {
      console.warn("getFirstVarNameForNode: failed to fetch flowchart", err);
    }
    return undefined;
  };

  const renderValue = (v: any) => {
    if (v === null) return "null";
    if (typeof v === "undefined") return "undefined";
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  };

  // Helper to push a system message but avoid duplicates (same sender & same text as last)
  const pushSystemMessage = (text: string) => {
    setChatMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.sender === "system" && last.text === text) return prev;
      return [...prev, { sender: "system", text }];
    });
  };

  // ---------- Highlight node that produced outputs immediately ----------
  const handleResponseOutputs = (resp: ExecuteResponse | undefined | null, autoContinue = false): boolean => {
    const respOutputs = resp?.result?.context?.output ?? resp?.context?.output ?? [];
    if (Array.isArray(respOutputs) && respOutputs.length > 0) {
      // determine the node that produced the output (prefer result.node.id, fallback to nextNodeId)
      const producerRaw = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
      const producerId = producerRaw !== null && typeof producerRaw !== "undefined" ? String(producerRaw) : null;

      safeHighlight(producerId);

      const mapped = respOutputs.map((o) => ({ sender: "system" as const, text: renderValue(o) }));
      setChatMessages((m) => [...m, ...mapped]);

      if (!autoContinue) {
        // keep expected behavior: caller can set pendingHighlightAfterOutput to the next node
        return true;
      }
    }
    return false;
  };
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      try {
        onHighlightNode?.(null);
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeHighlight = (id: string | number | null) => {
    try {
      setTimeout(() => {
        onHighlightNode?.(id);
      }, 50);
    } catch (err) {
      console.warn("safeHighlight error", err);
    }
  };

  const pickRestartNodeId = async (): Promise<string | null> => {
    try {
      if (!flowchartId) return null;
      const flow = await apiGetFlowchart(flowchartId);
      const nodes: any[] = flow?.flowchart?.nodes ?? flow?.nodes ?? [];
      const startNode = nodes.find((n) => String(n?.type).toUpperCase().startsWith("ST")) ?? null;
      if (startNode) return String(startNode.id);

      const candidate = nodes.find((n) => ["DC", "DECLARE", "VAR"].includes(String(n?.type).toUpperCase())) ?? nodes[0] ?? null;
      if (!candidate) return null;
      return String(candidate.id);
    } catch (err) {
      console.warn("pickRestartNodeId: failed to fetch flowchart", err);
      return null;
    }
  };

  const pickEndNodeId = async (): Promise<string | null> => {
    try {
      if (!flowchartId) return null;
      const flow = await apiGetFlowchart(flowchartId);
      const nodes: any[] = flow?.flowchart?.nodes ?? flow?.nodes ?? [];
      const candidate = nodes.find((n) => isEndType(n?.type)) ?? nodes.find((n) => String(n?.label ?? "").toLowerCase().includes("end")) ?? null;
      if (!candidate) return null;
      return String(candidate.id);
    } catch (err) {
      console.warn("pickEndNodeId: failed to fetch flowchart", err);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const restartId = await pickRestartNodeId();
        if (mounted) safeHighlight(restartId);
      } catch (err) {
        console.warn("initial highlight failed", err);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [flowchartId]);

  const resolveDefaultValueForVar = (name?: string | null) => {
    if (!name) return 0;
    const fromResult = lastResponse?.result?.context?.variables;
    if (Array.isArray(fromResult)) {
      const v = fromResult.find((x) => String(x.name) === String(name));
      if (v) return v.value;
    }
    if (Array.isArray(fetchedVariables)) {
      const v = fetchedVariables.find((x) => String(x.name) === String(name));
      if (v) return v.value;
    }
    if (Array.isArray(initialVariables)) {
      const v = initialVariables.find((x) => String(x.name) === String(name));
      if (v) return v.value;
    }
    return 0;
  };

  // --- Step ---
  const handleStep = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const resolvedInitialVars = initialVariables ?? fetchedVariables ?? [];
      const varsToSend = variablesSent ? [] : resolvedInitialVars;

      const resp = (await executeStepNode(flowchartId ?? null, varsToSend, forceAdvanceBP)) as ExecuteResponse;
      setLastResponse(resp);
      setVariablesSent(true);
      setStepCount((s) => s + 1);

      const backendDone = Boolean(resp?.result?.done ?? resp?.done ?? false);
      const nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
      const inferredDone = isEndType(nextType);
      const finalDone = backendDone || inferredDone;

      const nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      const nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

      // outputs
      const hadOutputs = handleResponseOutputs(resp);
      if (hadOutputs) {
        // Just highlight the next node, no pause logic for step unless we want to emphasize
        safeHighlight(nextId);
        // Note: we removed button pause logic, so we just proceed conceptually
      } else {
        const rawId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
        const currentNodeId = rawId !== null && typeof rawId !== "undefined" ? String(rawId) : null;
        safeHighlight(currentNodeId);
      }

      if (nextType === "IN" || nextType === "INPUT") {
        const resolvedVarName = await getFirstVarNameForNode(nextId ?? null);
        setInputNodeId(nextId ?? null);
        setInputVarName(resolvedVarName ?? null);
        pushSystemMessage(`กรุณากรอกค่า ${resolvedVarName ?? "input"}`);
        setInputValue("");
        setExpectingInput(true);
        return;
      }

      if (finalDone) {
        try {
          const endId = await pickEndNodeId();
          if (endId) safeHighlight(endId);
        } catch (err) {
          console.warn("failed to pick end node", err);
        }

        try {
          if (flowchartId) await apiResetFlowchart(flowchartId);
        } catch (err) {
          console.warn("apiResetFlowchart failed during auto-reset, trying executeStepNode reset", err);
          try {
            await executeStepNode(flowchartId ?? null, [], false);
          } catch (e) {
            console.warn("fallback executeStepNode reset also failed", e);
          }
        }

        setLastResponse(null);
        setStepCount(0);
        setVariablesSent(false);
        setInputNodeId(null);
        setInputVarName(null);
        setDone(false);

        const restartId = await pickRestartNodeId();
        if (restartId) safeHighlight(restartId);
        else safeHighlight(null);

        return;
      }
    } catch (err) {
      console.error("execute step error", err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Run All ---
  const handleRunAll = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    runAllActiveRef.current = true;

    // ตัวแปรสำหรับเก็บ Response ที่ได้จากการ Submit Input (เพื่อเอาไปใช้ต่อในลูป)
    let pushedResponse: ExecuteResponse | null = null;

    try {
      const resolvedInitialVars = initialVariables ?? fetchedVariables ?? [];
      let firstCallVars = variablesSent ? [] : resolvedInitialVars;

      let resp = (await executeStepNode(flowchartId ?? null, firstCallVars, forceAdvanceBP)) as ExecuteResponse;
      setLastResponse(resp);
      setVariablesSent(true);
      setStepCount((s) => s + 1);

      let nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
      let finalDone = Boolean(resp?.result?.done ?? resp?.done ?? false) || isEndType(nextType);

      let nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      let nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

      // Handle outputs (Stream mode: No pause)
      handleResponseOutputs(resp, true);
      
      // Always highlight next
      if (nextId) safeHighlight(nextId);

      // Re-read next info
      nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

      if (nextType === "IN" || nextType === "INPUT") {
        const resolvedVarName = await getFirstVarNameForNode(nextId ?? null);
        const defaultVal = resolveDefaultValueForVar(resolvedVarName ?? null);
        if (autoPlayInputs) {
          const singleVarPayload: Variable[] = [{ name: resolvedVarName ?? "input", value: defaultVal }];
          resp = (await executeStepNode(flowchartId ?? null, singleVarPayload, forceAdvanceBP)) as ExecuteResponse;
          setLastResponse(resp);
          setStepCount((s) => s + 1);
          setVariablesSent(true);
          nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
          finalDone = Boolean(resp?.result?.done ?? resp?.done ?? false) || isEndType(nextType);
        } else {
          setInputNodeId(nextId ?? null);
          setInputVarName(resolvedVarName ?? null);
          pushSystemMessage(`กรุณากรอกค่า ${resolvedVarName ?? "input"}`);
          setInputValue("");
          setExpectingInput(true);

          // รอ Input และรับค่า Response กลับมา
          const resumedRes = await new Promise<any>((resolve) => (runAllWaitingForInputRef.current = resolve));
          runAllWaitingForInputRef.current = null;
          
          if (resumedRes) {
             pushedResponse = resumedRes;
             resp = resumedRes;
          } else {
             resp = lastResponse ?? resp;
          }

          nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
          finalDone = Boolean(resp?.result?.done ?? resp?.done ?? false) || isEndType(nextType);
        }
      }

      if (finalDone) {
        try {
          const endId = await pickEndNodeId();
          if (endId) safeHighlight(endId);
        } catch (err) {
          console.warn("runAll done: failed to pick end node", err);
        }
        try {
          if (flowchartId) await apiResetFlowchart(flowchartId);
        } catch (err) {
            console.warn("reset error", err);
        }
        setLastResponse(null);
        setStepCount(0);
        setDone(false);
        setVariablesSent(false);
        setInputNodeId(null);
        setInputVarName(null);
        const restartId = await pickRestartNodeId();
        safeHighlight(restartId);
        setIsLoading(false);
        runAllActiveRef.current = false;
        return;
      }

      while (runAllActiveRef.current) {
        await new Promise((r) => setTimeout(r, 180));

        if (pushedResponse) {
             resp = pushedResponse;
             pushedResponse = null;
        } else {
             resp = (await executeStepNode(flowchartId ?? null, [], forceAdvanceBP)) as ExecuteResponse;
        }
        
        setLastResponse(resp);
        setStepCount((s) => s + 1);
        setVariablesSent(true);

        const backendDoneLoop = Boolean(resp?.result?.done ?? resp?.done ?? false);
        let nextTypeLoop = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
        const inferredDoneLoop = isEndType(nextTypeLoop);
        const finalDoneLoop = backendDoneLoop || inferredDoneLoop;

        let nextIdRawLoop = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
        let nextIdLoop = nextIdRawLoop !== null && typeof nextIdRawLoop !== "undefined" ? String(nextIdRawLoop) : null;

        // Stream outputs (no pause)
        handleResponseOutputs(resp, true);
        
        // Highlight current/next
        if (nextIdLoop) safeHighlight(nextIdLoop);

        if (nextTypeLoop === "IN" || nextTypeLoop === "INPUT") {
          const resolvedVarName = await getFirstVarNameForNode(nextIdLoop ?? null);
          const defaultVal = resolveDefaultValueForVar(resolvedVarName ?? null);
          if (autoPlayInputs) {
            const payload: Variable[] = [{ name: resolvedVarName ?? "input", value: defaultVal }];
            resp = (await executeStepNode(flowchartId ?? null, payload, forceAdvanceBP)) as ExecuteResponse;
            setLastResponse(resp);
            setStepCount((s) => s + 1);
            setVariablesSent(true);
            continue;
          } else {
            setInputNodeId(nextIdLoop ?? null);
            setInputVarName(resolvedVarName ?? null);
            pushSystemMessage(`กรุณากรอกค่า ${resolvedVarName ?? "input"}`);
            setInputValue("");
            setExpectingInput(true);

            const resumedResLoop = await new Promise<any>((resolve) => (runAllWaitingForInputRef.current = resolve));
            runAllWaitingForInputRef.current = null;
            
            if (resumedResLoop) {
                pushedResponse = resumedResLoop;
                resp = resumedResLoop;
            } else {
                resp = lastResponse ?? resp;
            }

            nextTypeLoop = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
            const finishedNow = Boolean(resp?.result?.done ?? resp?.done ?? false) || isEndType(nextTypeLoop);
            if (finishedNow) {
              // will be handled by loop condition
            } else {
              continue;
            }
          }
        }

        if (finalDoneLoop) {
          try {
            const endId = await pickEndNodeId();
            if (endId) safeHighlight(endId);
          } catch (err) {
            console.warn("runAll loop: failed to pick end node", err);
          }

          try {
            if (flowchartId) await apiResetFlowchart(flowchartId);
          } catch (err) {
            console.warn("reset without advance failed (runAll loop)", err);
            try {
              await executeStepNode(flowchartId ?? null, [], false);
            } catch (e) {
              console.warn("fallback reset also failed (runAll loop)", e);
            }
          }

          setLastResponse(null);
          setStepCount(0);
          setDone(false);
          setVariablesSent(false);
          setInputNodeId(null);
          setInputVarName(null);
          const restartId = await pickRestartNodeId();
          safeHighlight(restartId);
          break;
        }
      }
    } catch (err) {
      console.error("runAll error", err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
      runAllActiveRef.current = false;
      if (runAllWaitingForInputRef.current) {
        try {
          runAllWaitingForInputRef.current();
        } catch {}
        runAllWaitingForInputRef.current = null;
      }
      if (outputResumeRef.current) {
        try {
          outputResumeRef.current();
        } catch {}
        outputResumeRef.current = null;
      }
    }
  };

  // --- Input submit ---
  const handleSubmitInput = async () => {
    if (!expectingInput) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      let currentVars: Variable[] = lastResponse?.result?.node?.variables ?? lastResponse?.result?.context?.variables ?? fetchedVariables ?? [];

      const targetNodeIdRaw = inputNodeId ?? lastResponse?.nextNodeId ?? null;
      const targetNodeId = targetNodeIdRaw !== null && typeof targetNodeIdRaw !== "undefined" ? String(targetNodeIdRaw) : null;

      const resolvedFromFlow = await getFirstVarNameForNode(targetNodeId);
      const resolvedVarName = inputVarName ?? resolvedFromFlow ?? currentVars[0]?.name ?? null;

      if (!resolvedVarName) {
        console.warn("No variable name found for input.");
        setErrorMsg("ไม่พบชื่อตัวแปรสำหรับการป้อนข้อมูล");
        setIsLoading(false);
        return;
      }

      setChatMessages((m) => [...m, { sender: "user", text: String(inputValue) }]);

      const singleVarPayload: Variable[] = [{ name: resolvedVarName, value: inputValue }];
      const resp = (await executeStepNode(flowchartId ?? null, singleVarPayload, forceAdvanceBP)) as ExecuteResponse;

      setLastResponse(resp);
      setStepCount((s) => s + 1);
      setVariablesSent(true);

      const nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();

      setInputValue("");
      setInputNodeId(null);
      setInputVarName(null);

      const rawId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
      const currentNodeId = rawId !== null && typeof rawId !== "undefined" ? String(rawId) : null;
      safeHighlight(currentNodeId);

      const hadOutputs = handleResponseOutputs(resp);
      // Even if outputs, we don't pause anymore for manual step logic in submitInput unless explicitly desired.
      // But we will respect the auto-detect "next is input" logic.

      if (nextType === "IN" || nextType === "INPUT") {
        const resolvedVarName2 = await getFirstVarNameForNode(resp?.nextNodeId ?? null);
        pushSystemMessage(`กรุณากรอกค่า ${resolvedVarName2 ?? "input"}`);
        setExpectingInput(true);
      } else {
        setExpectingInput(false);
      }

      if (runAllWaitingForInputRef.current) {
        try {
          runAllWaitingForInputRef.current(resp);
        } catch {}
        runAllWaitingForInputRef.current = null;
      }
    } catch (err) {
      console.error("submit input error", err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelInput = () => {
    setExpectingInput(false);
    setInputNodeId(null);
    setInputVarName(null);
    setInputValue("");
    if (runAllWaitingForInputRef.current) {
      try {
        runAllWaitingForInputRef.current();
      } catch {}
      runAllWaitingForInputRef.current = null;
    }
  };

  const resetFlowchart = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (!flowchartId) throw new Error("missing flowchartId");

      await apiResetFlowchart(flowchartId);

      setLastResponse(null);
      setStepCount(0);
      setDone(false);
      setVariablesSent(false);
      setInputNodeId(null);
      setInputVarName(null);
      setChatMessages([]);
      setExpectingInput(false);
      setErrorMsg(null);

      if (runAllWaitingForInputRef.current) {
        try {
          runAllWaitingForInputRef.current();
        } catch {}
        runAllWaitingForInputRef.current = null;
      }
      if (outputResumeRef.current) {
        try {
          outputResumeRef.current();
        } catch {}
        outputResumeRef.current = null;
      }
      runAllActiveRef.current = false;

      const restartId = await pickRestartNodeId();
      if (restartId) {
        safeHighlight(restartId);
      } else {
        safeHighlight(null);
      }
    } catch (err) {
      console.error("reset error", err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const chatRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  // -------------------
  // Test UI state & handler
  // -------------------
  type TestLevel = "error" | "warning" | "info" | "success";
  const [testResults, setTestResults] = useState<Record<string, { level: TestLevel; text: string }[]>>({});
  const [runningTests, setRunningTests] = useState(false);
  const [labTestcases, setLabTestcases] = useState<any[]>([]);
  const [problemDetail, setProblemDetail] = useState<{ title?: string; description?: string } | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(false);
  const [loadingTestcases, setLoadingTestcases] = useState(false);

  const findLabLikeId = (obj: any): number | string | null => {
    if (!obj) return null;
    const seen = new WeakSet();
    const queue: any[] = [obj];

    while (queue.length) {
      const cur = queue.shift();
      if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
      seen.add(cur);

      for (const key of Object.keys(cur)) {
        const val = cur[key];
        // Check key pattern
        if (/(lab|assignment).?id$/i.test(key)) {
            if (typeof val === "number") return val;
            if (typeof val === "string" && /^\d+$/.test(val)) return Number(val);
        }
        // Specific checks for nested objects like lab: { id: ... }
        if (/^lab$/i.test(key) && val) {
          const candidate = val.id ?? val.labId ?? val.lab_id;
          if (candidate) return typeof candidate === "string" ? Number(candidate) : candidate;
        }
        if (/^assignment$/i.test(key) && val) {
          const candidate = val.id ?? val.assignmentId ?? val.assignment_id;
          if (candidate) return typeof candidate === "string" ? Number(candidate) : candidate;
        }
        
        if (typeof val === "object" && val !== null) {
            queue.push(val);
        }
      }
    }
    return null;
  };

  // ------------------------------------------------------------------
  //  IMPROVED DATA LOADING LOGIC 
  //  (Added fallback: call apiRunTestcaseFromFlowchart if flowchart didn't contain lab/testcases)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!flowchartId && !labId && !detectedLabId) {
      setProblemDetail(null);
      setLabTestcases([]);
      return;
    }

    let mounted = true;

    const loadData = async () => {
      setLoadingProblem(true);
      setLoadingTestcases(true);
      
      try {
        let finalLabId: number | string | null = null;

        // 1. Try to get Lab ID from props or existing state
        if (labId) finalLabId = labId;
        else if (detectedLabId) finalLabId = detectedLabId;

        // 2. If no Lab ID, try to fetch it from Flowchart
        let flowData: any = null;
        if (!finalLabId && flowchartId) {
            try {
                const resp = await apiGetFlowchart(flowchartId);
                flowData = resp;
                
                // Try to find ID deeply in flowchart response
                const found = findLabLikeId(resp) ?? findLabLikeId(resp?.flowchart);
                if (found) {
                    finalLabId = found;
                    setDetectedLabId(found);
                }
                console.log("TopBarControls.loadLabData: flowData fetched for fallback check", { flowchartId, found });
            } catch (e) {
                console.warn("Could not fetch flowchart for LabID extraction", e);
            }
        }

        let title: string | null = null;
        let desc: string | null = null;
        let tcs: any[] = [];

        // 3. If we have a Lab ID, try to fetch fresh Lab details
        if (finalLabId) {
            try {
                const normalizedId = Number(finalLabId);
                const labResp = await apiGetLab(normalizedId);
                
                const labObj = 
                    labResp?.lab ?? 
                    labResp?.data?.lab ?? 
                    labResp?.assignment ?? 
                    labResp?.data ?? 
                    labResp;

                title = 
                    labObj?.labname ??   // supports 'labname'
                    labObj?.title ?? 
                    labObj?.name ?? 
                    labObj?.assignment?.title ?? 
                    labResp?.title ?? 
                    null;

                desc = 
                    labObj?.problemSolving ??  // supports 'problemSolving'
                    labObj?.description ?? 
                    labObj?.detail ?? 
                    labObj?.assignment?.description ?? 
                    labResp?.description ?? 
                    null;

                if (Array.isArray(labObj?.testcases)) tcs = labObj.testcases;
                else if (Array.isArray(labObj?.testCases)) tcs = labObj.testCases;
                else if (Array.isArray(labObj?.assignment?.testcases)) tcs = labObj.assignment.testcases;
                else if (Array.isArray(labResp?.testcases)) tcs = labResp.testcases;
                else if (Array.isArray(labResp)) tcs = labResp;

                console.log("TopBarControls.loadLabData: got labResp", { normalizedId, titleFound: !!title, descFound: !!desc, testcaseCount: tcs.length });
            } catch (err) {
                console.warn("apiGetLab failed, falling back to embedded data", err);
            }
        }

        // 4. Fallback: If fields are still missing, try to use data embedded in Flowchart
        if ((!title || !desc || tcs.length === 0) && flowData) {
            const nested = flowData?.flowchart ?? flowData;
            
            if (!title) {
                title = nested?.assignment?.title ?? nested?.lab?.title ?? nested?.title ?? flowData?.title ?? null;
            }
            if (!desc) {
                desc = nested?.assignment?.description ?? nested?.lab?.description ?? nested?.description ?? flowData?.description ?? null;
            }
            if (tcs.length === 0) {
                tcs = nested?.testcases ?? nested?.lab?.testcases ?? nested?.assignment?.testcases ?? flowData?.testcases ?? [];
            }

            console.log("TopBarControls.loadLabData: fallback from flowData", { titleFound: !!title, descFound: !!desc, testcaseCount: tcs.length });
        }

        // 5. SECONDARY FALLBACK: If still missing and we have flowchartId, call apiRunTestcaseFromFlowchart (same as pressing Test)
        if ((!title || (!desc && desc !== "" ) || tcs.length === 0) && flowchartId) {
          try {
            console.log("TopBarControls.loadLabData: secondary fallback - calling apiRunTestcaseFromFlowchart", { flowchartId });
            const runResp = await apiRunTestcaseFromFlowchart(flowchartId);
            console.log("TopBarControls.loadLabData: apiRunTestcaseFromFlowchart raw response:", runResp);

            const runLabId = runResp?.labId ?? runResp?.lab_id ?? runResp?.session?.labId ?? runResp?.session?.lab_id;
            if (runLabId) {
              finalLabId = runLabId;
              setDetectedLabId(runLabId);
            }

            // try to read title/desc from runResp if present
            const maybeLabObj =
              runResp?.lab ??
              runResp?.data?.lab ??
              runResp?.assignment ??
              runResp?.data ??
              runResp;

            if (!title) {
              title =
                maybeLabObj?.labname ??
                maybeLabObj?.title ??
                maybeLabObj?.name ??
                runResp?.title ??
                (maybeLabObj?.assignment?.title ?? null) ??
                null;
            }
            if (!desc) {
              desc =
                maybeLabObj?.problemSolving ??
                maybeLabObj?.description ??
                maybeLabObj?.detail ??
                (maybeLabObj?.assignment?.description ?? null) ??
                runResp?.description ??
                null;
            }

            // gather testcases from runResp
            if (Array.isArray(runResp?.testcases)) {
              tcs = runResp.testcases;
            } else if (Array.isArray(runResp?.session?.testcases)) {
              tcs = runResp.session.testcases;
            } else if (Array.isArray(runResp?.results)) {
              // map results to synthetic testcases if needed
              // NOTE: we intentionally DO NOT include actual values here (per request)
              tcs = runResp.results.map((r: any, idx: number) => ({
                id: r.testcaseId ?? r.id ?? idx + 1,
                testcaseId: r.testcaseId ?? r.id ?? idx + 1,
                inputVal: r.inputVal ?? r.input ?? null,
                outputVal: null,
                __generatedFromRun: true,
              }));
            }

            console.log("TopBarControls.loadLabData: secondary fallback extracted", { finalLabId, titleFound: !!title, descFound: !!desc, testcaseCount: tcs.length });
          } catch (e) {
            console.warn("Secondary fallback apiRunTestcaseFromFlowchart failed", e);
          }
        }

        if (mounted) {
            setProblemDetail({ 
                title: title ?? "โจทย์ Lab", 
                description: desc ?? "" 
            });
            setLabTestcases(tcs);
        }

      } catch (err) {
        console.error("Error loading lab data:", err);
        if (mounted) {
             setProblemDetail({ title: "Error loading data", description: "" });
             setLabTestcases([]);
        }
      } finally {
        if (mounted) {
          setLoadingProblem(false);
          setLoadingTestcases(false);
        }
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [flowchartId, labId, detectedLabId]);

  const handleRunTests = async () => {
    if (!flowchartId) return;
    setRunningTests(true);
    setTestResults({});

    try {
      const data = await apiRunTestcaseFromFlowchart(flowchartId);
      console.log("apiRunTestcaseFromFlowchart raw response:", data);

      const runLabId = data?.labId ?? data?.lab_id ?? data?.session?.labId ?? data?.session?.lab_id;
      if (runLabId) {
          setDetectedLabId(runLabId);
      }

      const rawResults =
        data?.session?.results ??
        data?.results ??
        data?.data?.results ??
        data?.testcases ??
        data?.session?.testcases ??
        data?.session?.results ??
        [];

      if (!Array.isArray(rawResults)) {
        console.warn("runTests: rawResults is not an array", rawResults);
        setRunningTests(false);
        return;
      }

      const newResults: Record<string, { level: TestLevel; text: string }[]> = {};

      rawResults.forEach((r: any, idx: number) => {
        const rawId =
          r.testcaseId ??
          r.testcase_id ??
          r.id ??
          r.tcId ??
          r.testcase?.id ??
          r.testcase?.testcaseId ??
          (typeof r === "object" && r?.inputVal ? idx + 1 : undefined);

        const tcId = rawId ?? idx + 1;

        let statusRaw =
          r.status ??
          r.result?.status ??
          r.statusCode ??
          r.status_code ??
          r.state ??
          r.outcome ??
          r.verdict ??
          r.status?.name ??
          r.status?.code ??
          null;

        let status = "UNKNOWN";
        if (statusRaw === null || typeof statusRaw === "undefined") {
          status = "UNKNOWN";
        } else if (typeof statusRaw === "string" || typeof statusRaw === "number") {
          status = String(statusRaw).toUpperCase();
        } else if (typeof statusRaw === "object") {
          status = (statusRaw.name ?? statusRaw.code ?? JSON.stringify(statusRaw)).toString().toUpperCase();
        }

        const errorMessage =
          r.errorMessage ??
          r.error_message ??
          r.error ??
          (typeof r.error === "object" ? r.error?.message ?? JSON.stringify(r.error) : undefined) ??
          r.message ??
          r.msg ??
          (Array.isArray(r.errors) ? r.errors.join("; ") : undefined) ??
          null;

        // We intentionally ignore "actual" values entirely (do not add them to messages)
        // const actual = ... (not used)

        let level: TestLevel = "info";
        if (["PASS", "PASSED", "OK", "SUCCESS"].includes(status)) level = "success";
        else if (["FAIL", "FAILED", "ERROR", "INPUT_MISSING", "TIMEOUT", "WRONG"].includes(status)) level = "error";
        else if (["WARN", "WARNING"].includes(status)) level = "warning";

        const messages: { level: TestLevel; text: string }[] = [];
        messages.push({ level, text: `${status}` });

        if (errorMessage) {
          messages.push({ level: "error", text: String(errorMessage) });
        }

        const altKeys = new Set<string>();
        altKeys.add(String(tcId));
        if (r.testcaseId) altKeys.add(String(r.testcaseId));
        if (r.testcase_id) altKeys.add(String(r.testcase_id));
        if (r.id) altKeys.add(String(r.id));
        if (r.tcId) altKeys.add(String(r.tcId));
        if (r.testcase?.id) altKeys.add(String(r.testcase.id));
        if (r.testcase?.testcaseId) altKeys.add(String(r.testcase.testcaseId));
        altKeys.add(String(idx + 1));

        altKeys.forEach((k) => {
          newResults[k] = messages;
        });
      });

      console.log("Mapped test results:", newResults);

      if ((!labTestcases || labTestcases.length === 0) && !runLabId && Object.keys(newResults).length > 0) {
        const synthetic: any[] = [];
        const keys = Array.from(new Set(Object.keys(newResults))).sort((a, b) => {
          const na = Number(a);
          const nb = Number(b);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
          return a.localeCompare(b);
        });

        keys.forEach((k) => {
          // We intentionally do NOT populate outputVal from any 'actual' value.
          synthetic.push({
            id: k,
            testcaseId: k,
            inputVal: null,
            outputVal: null,
            score: 0,
            __generatedFromResults: true,
          });
        });
        setLabTestcases(synthetic);
      }

      setTestResults(newResults);
    } catch (err) {
      console.error("Failed to run tests:", err);
    } finally {
      setRunningTests(false);
    }
  };

  // --- Auto Run Tests when Popup Opens ---
  // NOTE: changed here — เปิด popup "Problem solving" จะไม่รัน handleRunTests อัตโนมัติอีกต่อไป.
  const autoRunTriggered = useRef(false);

  useEffect(() => {
    // เคลียร์ flag เมื่อปิด popup เพื่อให้เปิดใหม่ได้โดยไม่กระทบ state อื่น ๆ
    if (!showPopup) {
      autoRunTriggered.current = false;
    }
    // intentionally DO NOT auto-run tests here.
  }, [showPopup]);

  const renderBadge = (r: { level: TestLevel; text: string }, idx: number) => {
    const base = "inline-block text-xs px-2 py-1 rounded-md mb-2";
    
    // No more 'Actual:' branch — actual values are not shown.

    switch (r.level) {
      case "error":
        return (
          <div key={idx} className={`${base} bg-red-100 text-red-800 border border-red-200`}>
            {r.text}
          </div>
        );
      case "warning":
        return (
          <div key={idx} className={`${base} bg-yellow-100 text-yellow-800 border border-yellow-200`}>
            {r.text}
          </div>
        );
      case "info":
        return (
          <div key={idx} className={`${base} bg-blue-100 text-blue-800 border border-blue-200`}>
            {r.text}
          </div>
        );
      case "success":
        return (
          <div key={idx} className={`${base} bg-green-100 text-green-800 border border-green-200`}>
            {r.text}
          </div>
        );
      default:
        return null;
    }
  };

  const renderSummaryBadge = (level?: TestLevel | null, text?: string) => {
    const base = "inline-block text-xs px-2 py-1 rounded-md font-semibold";
    const displayText = text || "";
    switch (level) {
      case "error":
        return <div className={`${base} bg-red-100 text-red-800 border border-red-200`}>{displayText || "Error"}</div>;
      case "warning":
        return <div className={`${base} bg-yellow-100 text-yellow-800 border border-yellow-200`}>{displayText || "Warning"}</div>;
      case "info":
        return <div className={`${base} bg-blue-100 text-blue-800 border border-blue-200`}>{displayText || "Info"}</div>;
      case "success":
        return <div className={`${base} bg-green-100 text-green-800 border border-green-200`}>{displayText || "Success"}</div>;
      default:
        return null;
    }
  };

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
        return val;
      }
    }
    if (Array.isArray(val)) {
      return val.map(parseVal);
    }
    return val;
  };

  const flattenDeep = (arr: any[]): any[] => {
    return arr.reduce((acc, val) => (Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val)), []);
  };

  const readUserIdFromLocalStorage = (): number | null => {
    if (typeof window === "undefined") return null;
    try {
      const candidateKeys = ["userId", "user_id", "uid", "id", "user"];
      for (const k of candidateKeys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        if (/^\d+$/.test(raw.trim())) return Number(raw.trim());
        try {
          const parsed = JSON.parse(raw);
          const id = parsed?.id ?? parsed?.userId ?? parsed?.user_id ?? parsed?.sub ?? parsed?.user?.id ?? null;
          if (id) return Number(id);
        } catch {}
      }
    } catch {}
    return null;
  };

  const handleSubmit = async () => {
    // Safety guard: ถ้า disableSubmit ถูกเปิด ให้หยุดและไม่ส่งงาน (ป้องกันกรณีเรียกจากที่อื่น)
    if (disableSubmit) {
      // ไม่แจ้ง alert รุนแรง — แค่ log เงียบ ๆ หรือแสดง toast ตามต้องการ
      console.warn("Submission blocked because disableSubmit=true");
      alert("ส่งงานถูกปิดใช้งานสำหรับหน้าจอนี้");
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      let uid: number | string | null = null;
      if (session?.user) {
        // @ts-ignore
        uid = session.user.id ?? session.user.userId ?? session.user.sub ?? null;
      }
      if (!uid) {
        uid = readUserIdFromLocalStorage();
      }
      if (!uid) {
         const manualId = window.prompt("ไม่พบ User ID อัตโนมัติ กรุณากรอก ID ของคุณ (ตัวเลข):");
         if (manualId && manualId.trim() !== "") {
            uid = manualId.trim();
         } else {
            alert("ยกเลิกการส่งงาน: จำเป็นต้องมี User ID");
            setSubmitting(false);
            return;
         }
      }

      const finalUserId = Number(uid);

      if (!finalUserId || isNaN(finalUserId)) {
        alert("User ID ไม่ถูกต้อง");
        setSubmitting(false);
        return;
      }
      if (!flowchartId) {
        alert("ไม่พบ Flowchart ID (กรุณา Save งานก่อนส่ง)");
        setSubmitting(false);
        return;
      }

      const targetId = labId ?? detectedLabId ?? classId;
      console.log(`Submitting FlowchartID: ${flowchartId}, UserID: ${finalUserId}, TargetRedirectID: ${targetId}`);

      const resp = await apiSubmitFlowchart(Number(flowchartId), finalUserId);
      console.log("✅ Submit Success:", resp);

      if (targetId) {
        router.push(`/Studentlab/${targetId}`);
      } else {
        console.warn("ไม่พบ Lab ID หรือ Class ID สำหรับ Redirect");
        alert("ส่งงานสำเร็จ! (แต่ไม่สามารถกลับไปหน้ารายวิชาได้เนื่องจากไม่พบ ID กรุณากดปุ่ม Back ของ Browser)");
      }

    } catch (err) {
      console.error("❌ Submit Failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`ส่งงานไม่สำเร็จ: ${message}`);
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute z-1 pt-4">
      {/* Control bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md border border-gray-200 w-fit hover:shadow-lg transition-shadow duration-200">
        <button onClick={handleRunAll} title="Run" className="text-green-600 hover:text-green-700 text-lg p-2 rounded-full hover:bg-green-100 transition-colors">
          <FaPlay />
        </button>
        <button
          onClick={handleStep}
          disabled={isLoading || done}
          title={done ? "Finished" : "Step"}
          className={`text-yellow-600 text-lg p-2 rounded-full transition-colors ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:text-yellow-700 hover:bg-yellow-100"} ${done ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          <span className={`${isLoading ? "animate-pulse" : ""}`}>
            <FaStepForward />
          </span>
        </button>
        <button onClick={resetFlowchart} className="text-gray-600 hover:text-gray-700 text-lg p-2 rounded-full hover:bg-gray-100 transition-colors">
          <FaStop />
        </button>
        <span onClick={togglePopup} className="ml-2 px-3 py-1 bg-blue-200 text-blue-800 text-sm font-semibold rounded-lg cursor-pointer hover:bg-blue-300 transition-colors select-none">
          Problem solving
        </span>
      </div>

      {/* Persistent single chat panel */}
      <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[420px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex items-center justify-between">
          <div className="font-medium">Console</div>
          <div className="text-sm opacity-90">{expectingInput ? `Expecting: ${inputVarName ?? "input"}` : "Status"}</div>
        </div>

        <div ref={chatRef} className="p-3 overflow-auto bg-gray-50" style={{ maxHeight: 260, minHeight: 150 }}>
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 opacity-50 py-10">
              <div className="flex items-center gap-3 text-sm">
                <span>Press Run</span>
                <FaPlay />
                <span className="">or</span>
                <span>Step</span>
                <FaStepForward />
                <span className="">or</span>
                <span>Stop</span>
                <FaStop />
                <span className="">to start</span>
              </div>
            </div>

          ) : (
            chatMessages.map((m, i) => (
            <div key={i} className={`mb-3 flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] px-3 py-2 rounded-lg whitespace-pre-wrap ${m.sender === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-200 text-gray-800 rounded-bl-sm"}`}>
                {m.text}
              </div>
            </div>
          )))}
        </div>

        <div className="p-3 bg-white border-t border-gray-100">
          {expectingInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="text"
                value={inputValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setInputValue("");
                    return;
                  }
                  const fullNumberRegex = /^-?\d+(\.\d+)?$/;
                  if (fullNumberRegex.test(raw)) {
                    setInputValue(Number(raw));
                  } else {
                    setInputValue(raw);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitInput();
                }}
                className="flex-1 border border-gray-300 rounded px-3 py-2"
                placeholder="พิมพ์ค่าที่ต้องการส่ง..."
              />

              <button onClick={handleSubmitInput} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                ส่ง
              </button>
              <button onClick={cancelInput} className="bg-gray-200 text-gray-800 px-3 py-2 rounded hover:bg-gray-300">
                ยกเลิก
              </button>
            </div>
          ) : (
            <div className="flex justify-between items-center gap-2">
              <div className="text-sm text-gray-500">
                {chatMessages.length > 0 ? "Output log" : ""}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setChatMessages([])} className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPopup && (
        <div className="absolute z-50 w-120 h-auto rounded-xl bg-white p-4 shadow-xl border border-gray-200 ml-12 mt-3 transform translate-x-[-10%] animate-fadeIn">
          <div className="relative w-full">
            <div className="text-gray-800 text-lg font-medium font-['Sarabun'] leading-snug mb-4 whitespace-pre-wrap">
              {loadingProblem ? (
                <div>กำลังโหลดรายละเอียดโจทย์...</div>
              ) : problemDetail ? (
                <>
                  {problemDetail.title && <div className="font-bold mb-1">{problemDetail.title}</div>}
                  {problemDetail.description || "ไม่มีรายละเอียดโจทย์"}
                </>
              ) : (
                <div>ยังไม่ได้เลือก flowchart หรือไม่พบข้อมูลโจทย์</div>
              )}
            </div>

            {/* Testcases list */}
            <div className="space-y-3 max-h-96 overflow-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300">
              {loadingTestcases && <div className="text-sm text-gray-500">กำลังโหลด testcases...</div>}
              {!loadingTestcases && labTestcases.length === 0 && <div className="text-sm text-gray-400">ยังไม่มี Testcases ให้แสดง</div>}

              {labTestcases.map((tc, index) => {
                const displayId = String(tc.testcaseId ?? tc.testcase_id ?? tc.id ?? tc.tcId ?? (index + 1));

                const rawInput = parseVal(tc.inputVal ?? tc.input ?? tc.in ?? tc.input_values ?? tc.inputs ?? tc.stdin ?? tc.args ?? []);
                const rawOutput = parseVal(tc.outputVal ?? tc.output ?? tc.out ?? tc.output_values ?? tc.outputs ?? tc.stdout ?? tc.expected ?? []);

                const format = (v: any) => {
                  if (Array.isArray(v)) {
                    return flattenDeep(v).join(", ");
                  }
                  return String(v ?? "-");
                };

                const inputDisplay = format(rawInput);
                const outputDisplay = format(rawOutput);

                const possibleKeys = [
                  displayId,
                  String(tc.id ?? ""),
                  String(tc.testcaseId ?? ""),
                  String(tc.testcase_id ?? ""),
                  String(tc.tcId ?? ""),
                  String(index + 1),
                ].filter((k) => k !== "");

                let matchedKey: string | null = null;
                for (const k of possibleKeys) {
                  if (k && Array.isArray(testResults[k]) && testResults[k].length > 0) {
                    matchedKey = k;
                    break;
                  }
                }

                const statusItems = matchedKey ? testResults[matchedKey] : [];
                // Determine summary status for the badge
                const summaryStatusMsg = statusItems.length > 0 ? statusItems[0] : null;

                return (
                  <div key={displayId + "-" + index} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-gray-500 mb-1">No {index + 1}</div>
                        
                        {/* Improved Input/Output Line */}
                        <div className="flex items-center flex-wrap gap-2 text-base text-gray-800 font-medium">
                          <span>Input: {inputDisplay}</span>
                          <span className="text-gray-300 mx-1">|</span>
                          <span>Output: {outputDisplay}</span>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-16 text-center">
                          <div className="text-xs text-gray-400">Score</div>
                          <div className="mt-2 text-sm font-semibold text-blue-600">{tc.score ?? 0}</div>
                        </div>

                        <div className="w-24 text-right">
                          <div className="text-xs text-gray-400">Status</div>
                          <div className="mt-2">
                            {statusItems.length === 0 ? (
                              <div className="inline-block text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 border border-gray-200">Not run</div>
                            ) : (
                                renderSummaryBadge(summaryStatusMsg?.level, summaryStatusMsg?.text)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* expanded messages under card */}
                    <div className="mt-3 border-t border-gray-200 pt-3">
                      <div className="flex flex-col">
                        {(statusItems ?? []).map((r, idx) => {
                            // Filter out redundant status text (e.g., "PASS", "FAIL") because the badge shows it
                            if (summaryStatusMsg && r.text === summaryStatusMsg.text) {
                                return null;
                            }
                            return (
                                <div key={idx} className="mb-2">
                                    {renderBadge(r, idx)}
                                </div>
                            );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={handleRunTests}
                disabled={runningTests || !flowchartId}
                className={`text-sm px-6 py-2 rounded-full ${runningTests ? "bg-gray-200 text-gray-600 cursor-not-allowed " : "bg-yellow-500 text-white hover:bg-yellow-600"}`}>
                {runningTests ? "Testing..." : "Test"}
              </button>

              {/* หาก disableSubmit === true จะซ่อนปุ่ม Submit ทั้งหมดตามคำขอ */}
              {!disableSubmit ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`mt-0 text-sm px-6 py-2 rounded-full text-white transition-colors ${submitting ? "bg-gray-400 cursor-not-allowed" : "bg-blue-900 hover:bg-blue-800"}`}
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              ) : (
                // ถ้าต้องการให้แสดงข้อความเล็ก ๆ ว่า submit ถูกปิด ให้คงข้อความนี้ไว้
                <div className="">
                  
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
