"use client";

import { useEffect, useRef, useState } from "react";
import { FaPlay, FaStepForward, FaStop } from "react-icons/fa";
// Switched to trial-specific APIs as requested
import {
  apiExecuteTrial,
  apiGetTrialFlowchart,
  apiTrialReset,
  apiRunTrialTestcases,
  apiGetTrialTestcases,
  apiGetLab,
} from "@/app/service/FlowchartService";

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
  // New: prefer trialId (UUID string). Keep flowchartId for backward compatibility.
  trialId?: string | null;
  flowchartId?: string | number | null;
  initialVariables?: Variable[] | null;
  forceAdvanceBP?: boolean;
  onHighlightNode?: (nodeId: string | number | null) => void;
  autoPlayInputs?: boolean;
}

export default function TopBarControls({
  trialId = null,
  flowchartId = null,
  initialVariables = null,
  forceAdvanceBP = true,
  onHighlightNode,
  autoPlayInputs = false,
}: TopBarControlsProps) {
  // effectiveId is what we send to trial endpoints (string UUID preferred)
  const effectiveId: string | null = (trialId ?? (flowchartId != null ? String(flowchartId) : null)) as string | null;

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

  const outputResumeRef = useRef<(() => void) | null>(null);
  const [pendingHighlightAfterOutput, setPendingHighlightAfterOutput] = useState<string | number | null>(null);

  const runAllActiveRef = useRef(false);
  const runAllWaitingForInputRef = useRef<(() => void) | null>(null);

  // --- State สำหรับเก็บข้อมูล Lab ---
  const [labInfo, setLabInfo] = useState<{ name?: string; detail?: string } | null>(null);

  const togglePopup = () => setShowPopup((v) => !v);

  const isEndType = (t?: string | number | null) => {
    if (!t) return false;
    const s = String(t).toUpperCase().trim();
    return ["EN", "END", "ED", "TERMINATE", "ENDNODE", "EXIT"].includes(s);
  };

  // fetch declared variables from flowchart/trial AND Lab Info
  useEffect(() => {
    let mounted = true;

    // Fetch Variables AND Lab Info
    const fetchVars = async () => {
      if (initialVariables && initialVariables.length > 0) {
        setFetchedVariables(initialVariables);
        return;
      }
      if (!effectiveId) return;

      try {
        setFetchingVars(true);
        const resp = await apiGetTrialFlowchart(effectiveId);
        
        // --- Logic การดึงข้อมูล Lab ---
        if (mounted) {
            // พยายามหา labId จาก response ถ้าไม่มีให้ Default เป็น 19 ตามโจทย์
            const foundLabId = resp?.labId ?? resp?.trial?.labId ?? 19; 
            
            if (foundLabId) {
                apiGetLab(foundLabId).then((labResp) => {
                    if (mounted) {
                        const rawLab = labResp?.lab ?? labResp;
                        // Map ข้อมูลเข้า State (รองรับ structure หลายแบบ)
                        setLabInfo({
                            name: rawLab?.labname ?? rawLab?.name ?? `Lab ${foundLabId}`,
                            detail: rawLab?.problemSolving ?? rawLab?.problem ?? "No description available."
                        });
                    }
                }).catch(err => console.warn("Fetch Lab Error:", err));
            }
        }
        // ------------------------------------------------

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
        console.error("failed to fetch trial flowchart for variables", err);
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
  }, [effectiveId, initialVariables]);

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
      if (!effectiveId) return undefined;
      const flowResp = await apiGetTrialFlowchart(effectiveId);
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
      console.warn("getFirstVarNameForNode: failed to fetch trial flowchart", err);
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

  const handleResponseOutputs = (resp: ExecuteResponse | undefined | null, autoContinue = false): boolean => {
    const respOutputs = resp?.result?.context?.output ?? resp?.context?.output ?? [];
    if (Array.isArray(respOutputs) && respOutputs.length > 0) {
      const mapped = respOutputs.map((o) => ({ sender: "system" as const, text: renderValue(o) }));
      setChatMessages((m) => [...m, ...mapped]);

      // Note: Acknowledge button removed, so we treat it as auto-continue for flow purposes
      // or simply rely on the user to click Step/Run again if paused.
      // Returning true here allows highlighting the next node.
      return true; 
    }
    return false;
  };

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
      if (!effectiveId) return null;
      const flow = await apiGetTrialFlowchart(effectiveId);
      const nodes: any[] = flow?.flowchart?.nodes ?? flow?.nodes ?? [];
      const startNode = nodes.find((n) => String(n?.type).toUpperCase().startsWith("ST")) ?? null;
      if (startNode) return String(startNode.id);

      const candidate = nodes.find((n) => ["DC", "DECLARE", "VAR"].includes(String(n?.type).toUpperCase())) ?? nodes[0] ?? null;
      if (!candidate) return null;
      return String(candidate.id);
    } catch (err) {
      console.warn("pickRestartNodeId: failed to fetch trial flowchart", err);
      return null;
    }
  };

  const pickEndNodeId = async (): Promise<string | null> => {
    try {
      if (!effectiveId) return null;
      const flow = await apiGetTrialFlowchart(effectiveId);
      const nodes: any[] = flow?.flowchart?.nodes ?? flow?.nodes ?? [];
      const candidate = nodes.find((n) => isEndType(n?.type)) ?? nodes.find((n) => String(n?.label ?? "").toLowerCase().includes("end")) ?? null;
      if (!candidate) return null;
      return String(candidate.id);
    } catch (err) {
      console.warn("pickEndNodeId: failed to fetch trial flowchart", err);
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
  }, [effectiveId]);

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

  // --- Step (with input-missing handling) ---
  const handleStep = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const resolvedInitialVars = initialVariables ?? fetchedVariables ?? [];
      const varsToSend = variablesSent ? [] : resolvedInitialVars;
      const payload = { action: "step", variables: varsToSend, forceAdvanceBP };

      let resp: ExecuteResponse | null = null;
      try {
        resp = (await apiExecuteTrial(effectiveId as any, payload)) as ExecuteResponse;
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? String(err);
        console.warn("apiExecuteTrial error (step):", msg);

        if (/input missing/i.test(msg) || /no input provider/i.test(msg)) {
          const m = String(msg).match(/'([^']+)'/);
          const varName = m ? m[1] : null;
          setInputVarName(varName);
          setExpectingInput(true);
          setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${varName ?? "input"}` }]);
          return;
        }
        throw err;
      }

      if (!resp) return;

      const possibleNodeType =
        (resp?.node?.type ?? resp?.node?.nodeType ?? resp?.nextNodeType ?? resp?.result?.node?.type ?? null) as
          | string
          | number
          | null;
      const nodeTypeStr = possibleNodeType ? String(possibleNodeType).toUpperCase().trim() : null;

      setLastResponse(resp);
      setVariablesSent(true);
      setStepCount((s) => s + 1);

      if (nodeTypeStr && (nodeTypeStr === "IN" || nodeTypeStr === "INPUT" || nodeTypeStr.includes("INPUT") || resp?.paused === true)) {
        const inputNodeIdRaw = resp?.node?.id ?? resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
        const inputNodeIdResolved = inputNodeIdRaw !== null && typeof inputNodeIdRaw !== "undefined" ? String(inputNodeIdRaw) : null;
        const resolvedVarName = await getFirstVarNameForNode(inputNodeIdResolved ?? null);
        setInputNodeId(inputNodeIdResolved ?? null);
        setInputVarName(resolvedVarName ?? null);
        setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${resolvedVarName ?? "input"}` }]);
        setInputValue("");
        setExpectingInput(true);
        return;
      }

      const backendDone = Boolean(resp?.result?.done ?? resp?.done ?? false);
      const nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
      const inferredDone = isEndType(nextType);
      const finalDone = backendDone || inferredDone;

      const nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      const nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

      const hadOutputs = handleResponseOutputs(resp);
      if (hadOutputs) {
        setPendingHighlightAfterOutput(nextId);
        // Previously we paused here. Now since Acknowledge is removed, we just highlight.
        // User can press Step again.
        if (nextId) safeHighlight(nextId);
        return;
      }

      const rawId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
      const currentNodeId = rawId !== null && typeof rawId !== "undefined" ? String(rawId) : null;
      safeHighlight(currentNodeId);

      if (nextType === "IN" || nextType === "INPUT") {
        const resolvedVarName = await getFirstVarNameForNode(nextId ?? null);
        setInputNodeId(nextId ?? null);
        setInputVarName(resolvedVarName ?? null);
        setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${resolvedVarName ?? "input"}` }]);
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
          await apiTrialReset(effectiveId as any);
        } catch (err) {
            try {
                await apiExecuteTrial(effectiveId as any, { action: "reset" });
            } catch (e) {
                console.warn("fallback apiExecuteTrial reset also failed", e);
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

  // --- Run All (with input-missing handling & pause/resume) ---
  const handleRunAll = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    runAllActiveRef.current = true;

    try {
      const resolvedInitialVars = initialVariables ?? fetchedVariables ?? [];
      let firstCallVars = variablesSent ? [] : resolvedInitialVars;

      // FIRST STEP (catch input-missing)
      let resp: ExecuteResponse | null = null;
      try {
        resp = (await apiExecuteTrial(effectiveId as any, { action: "step", variables: firstCallVars, forceAdvanceBP })) as ExecuteResponse;
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? String(err);
        if (/input missing/i.test(msg) || /no input provider/i.test(msg)) {
          const m = String(msg).match(/'([^']+)'/);
          const varName = m ? m[1] : null;
          setInputVarName(varName);
          setExpectingInput(true);
          setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${varName ?? "input"}` }]);

          await new Promise<void>((resolve) => (runAllWaitingForInputRef.current = resolve));
          runAllWaitingForInputRef.current = null;
          resp = lastResponse ?? null;
        } else {
          throw err;
        }
      }

      if (resp) {
        setLastResponse(resp);
        setVariablesSent(true);
        setStepCount((s) => s + 1);
      }

      const currentType = (resp?.node?.type ?? resp?.node?.nodeType ?? resp?.result?.node?.type ?? "").toString().toUpperCase();
      if ((currentType === "IN" || currentType === "INPUT" || resp?.paused) && !autoPlayInputs) {
           const inputNodeIdRaw = resp?.node?.id ?? resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
           const inputNodeIdResolved = inputNodeIdRaw !== null ? String(inputNodeIdRaw) : null;
           const resolvedVarName = await getFirstVarNameForNode(inputNodeIdResolved);
           
           setInputNodeId(inputNodeIdResolved);
           setInputVarName(resolvedVarName ?? null);
           setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${resolvedVarName ?? "input"}` }]);
           setExpectingInput(true);
           await new Promise<void>((resolve) => (runAllWaitingForInputRef.current = resolve));
           runAllWaitingForInputRef.current = null;
           resp = lastResponse ?? resp;
      }

      let nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
      let finalDone = Boolean(resp?.result?.done ?? resp?.done ?? false) || isEndType(nextType);

      let nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      let nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

      if (handleResponseOutputs(resp, autoPlayInputs)) {
        // NOTE: removed autoPlayInputs check for pausing. 
        // We do NOT pause on output anymore since the Acknowledge button is removed.
        setPendingHighlightAfterOutput(nextId);
        // Give a small delay to let user see output if they are running continuously?
        // For now, we just proceed or highlight.
        if (nextId) safeHighlight(nextId);
        
        // Ensure we don't block.
      } else {
        const rawId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
        safeHighlight(rawId !== null && typeof rawId !== "undefined" ? String(rawId) : null);
      }

      nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

      if (nextType === "IN" || nextType === "INPUT") {
        const resolvedVarName = await getFirstVarNameForNode(nextId ?? null);
        const defaultVal = resolveDefaultValueForVar(resolvedVarName ?? null);
        if (autoPlayInputs) {
          const singleVarPayload: Variable[] = [{ name: resolvedVarName ?? "input", value: defaultVal }];
          resp = (await apiExecuteTrial(effectiveId as any, { action: "step", variables: singleVarPayload, forceAdvanceBP })) as ExecuteResponse;
          setLastResponse(resp);
          setStepCount((s) => s + 1);
          setVariablesSent(true);
          nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
          finalDone = Boolean(resp?.result?.done ?? resp?.done ?? false) || isEndType(nextType);
        } else {
          setInputNodeId(nextId ?? null);
          setInputVarName(resolvedVarName ?? null);
          setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${resolvedVarName ?? "input"}` }]);
          setInputValue("");
          setExpectingInput(true);

          await new Promise<void>((resolve) => (runAllWaitingForInputRef.current = resolve));
          runAllWaitingForInputRef.current = null;

          resp = lastResponse ?? resp;
          nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
          finalDone = Boolean(resp?.result?.done ?? resp?.done ?? false) || isEndType(nextType);
        }
      }

      if (finalDone) {
        try {
          const endId = await pickEndNodeId();
          if (endId) safeHighlight(endId);
        } catch (err) {}

        try {
          await apiTrialReset(effectiveId as any);
        } catch (err) {
            try { await apiExecuteTrial(effectiveId as any, { action: "reset" }); } catch (e) {}
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

      // MAIN RUN LOOP
      while (runAllActiveRef.current) {
        await new Promise((r) => setTimeout(r, 180));

        try {
          resp = (await apiExecuteTrial(effectiveId as any, { action: "step", variables: [], forceAdvanceBP })) as ExecuteResponse;
        } catch (err: any) {
          const msg = err?.response?.data?.message ?? err?.message ?? String(err);
          if (/input missing/i.test(msg) || /no input provider/i.test(msg)) {
            const m = String(msg).match(/'([^']+)'/);
            const varName = m ? m[1] : null;
            setInputVarName(varName);
            setExpectingInput(true);
            setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${varName ?? "input"}` }]);
            await new Promise<void>((resolve) => (runAllWaitingForInputRef.current = resolve));
            runAllWaitingForInputRef.current = null;
            resp = lastResponse ?? null;
            if (!resp) continue;
          } else {
            throw err;
          }
        }

        if (!resp) continue;

        setLastResponse(resp);
        setStepCount((s) => s + 1);
        setVariablesSent(true);

        const backendDoneLoop = Boolean(resp?.result?.done ?? resp?.done ?? false);
        let nextTypeLoop = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
        const inferredDoneLoop = isEndType(nextTypeLoop);
        const finalDoneLoop = backendDoneLoop || inferredDoneLoop;

        const currentTypeLoop = (resp?.node?.type ?? resp?.node?.nodeType ?? resp?.result?.node?.type ?? "").toString().toUpperCase();
        if ((currentTypeLoop === "IN" || currentTypeLoop === "INPUT" || resp?.paused) && !autoPlayInputs) {
             const inputNodeIdResolved = resp?.node?.id ? String(resp.node.id) : null;
             const resolvedVarName = await getFirstVarNameForNode(inputNodeIdResolved);
             
             setInputNodeId(inputNodeIdResolved);
             setInputVarName(resolvedVarName ?? null);
             setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${resolvedVarName ?? "input"}` }]);
             setExpectingInput(true);
             await new Promise<void>((resolve) => (runAllWaitingForInputRef.current = resolve));
             runAllWaitingForInputRef.current = null;
             resp = lastResponse ?? resp;
        }

        nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
        nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

        if (handleResponseOutputs(resp, autoPlayInputs)) {
          setPendingHighlightAfterOutput(nextId);
          // Removed blocking wait for outputResumeRef here as well
          setPendingHighlightAfterOutput(null);
          if (nextId) safeHighlight(nextId);
        } else {
          const rawLoopId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
          const loopNodeId = rawLoopId !== null && typeof rawLoopId !== "undefined" ? String(rawLoopId) : null;
          safeHighlight(loopNodeId);
        }
        
        nextTypeLoop = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();

        if (nextTypeLoop === "IN" || nextTypeLoop === "INPUT") {
          const resolvedVarName = await getFirstVarNameForNode(nextId ?? null);
          const defaultVal = resolveDefaultValueForVar(resolvedVarName ?? null);
          if (autoPlayInputs) {
            const payload: Variable[] = [{ name: resolvedVarName ?? "input", value: defaultVal }];
            resp = (await apiExecuteTrial(effectiveId as any, { action: "step", variables: payload, forceAdvanceBP })) as ExecuteResponse;
            setLastResponse(resp);
            setStepCount((s) => s + 1);
            setVariablesSent(true);
            continue;
          } else {
            setInputNodeId(nextId ?? null);
            setInputVarName(resolvedVarName ?? null);
            setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${resolvedVarName ?? "input"}` }]);
            setInputValue("");
            setExpectingInput(true);

            await new Promise<void>((resolve) => (runAllWaitingForInputRef.current = resolve));
            runAllWaitingForInputRef.current = null;

            resp = lastResponse ?? resp;
            nextTypeLoop = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
            const finishedNow = Boolean(resp?.result?.done ?? resp?.done ?? false) || isEndType(nextTypeLoop);
            if (finishedNow) {
              // handled below
            } else {
              continue;
            }
          }
        }

        if (finalDoneLoop) {
          try {
            const endId = await pickEndNodeId();
            if (endId) safeHighlight(endId);
          } catch (err) {}

          try {
            await apiTrialReset(effectiveId as any);
          } catch (err) {
            try { await apiExecuteTrial(effectiveId as any, { action: "reset" }); } catch (e) {}
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
        try { runAllWaitingForInputRef.current(); } catch { }
        runAllWaitingForInputRef.current = null;
      }
      if (outputResumeRef.current) {
        try { outputResumeRef.current(); } catch { }
        outputResumeRef.current = null;
      }
    }
  };

  // --- Input submit (handles both single-step input & runAll resume) ---
  const handleSubmitInput = async () => {
    if (!expectingInput) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // determine variable name
      let currentVars: Variable[] = lastResponse?.result?.node?.variables ?? lastResponse?.result?.context?.variables ?? fetchedVariables ?? [];

      const targetNodeIdRaw = inputNodeId ?? lastResponse?.nextNodeId ?? null;
      const targetNodeId = targetNodeIdRaw !== null && typeof targetNodeIdRaw !== "undefined" ? String(targetNodeIdRaw) : null;

      const resolvedFromFlow = await getFirstVarNameForNode(targetNodeId);
      const resolvedVarName = inputVarName ?? resolvedFromFlow ?? currentVars[0]?.name ?? null;

      if (!resolvedVarName) {
        setIsLoading(false);
        return;
      }

      setChatMessages((m) => [...m, { sender: "user", text: String(inputValue) }]);

      const singleVarPayload: Variable[] = [{ name: resolvedVarName, value: inputValue }];

      // send to backend
      const resp = (await apiExecuteTrial(effectiveId as any, { action: "step", variables: singleVarPayload, forceAdvanceBP })) as ExecuteResponse;

      // update UI
      setLastResponse(resp);
      setStepCount((s) => s + 1);
      setVariablesSent(true);

      const nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();

      setInputValue("");
      setInputNodeId(null);
      setInputVarName(null);
      setExpectingInput(false);

      const rawId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
      const currentNodeId = rawId !== null && typeof rawId !== "undefined" ? String(rawId) : null;
      safeHighlight(currentNodeId);

      // --- FIX: เพิ่มการตรวจสอบว่า Node ปัจจุบันที่ backend หยุดเป็น Input หรือไม่ ---
      const currentType = (resp?.node?.type ?? resp?.node?.nodeType ?? resp?.result?.node?.type ?? null);
      const currentTypeStr = currentType ? String(currentType).toUpperCase().trim() : null;

      if (currentTypeStr && (currentTypeStr === "IN" || currentTypeStr === "INPUT" || resp?.paused === true)) {
          const nextInputId = resp?.node?.id ?? resp?.nextNodeId;
          const inputNodeIdResolved = nextInputId !== null && typeof nextInputId !== "undefined" ? String(nextInputId) : null;
          const resolvedVarName2 = await getFirstVarNameForNode(inputNodeIdResolved);
          
          setInputNodeId(inputNodeIdResolved);
          setInputVarName(resolvedVarName2 ?? null);
          setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${resolvedVarName2 ?? "input"}` }]);
          
          setExpectingInput(true);
          
          if (inputNodeIdResolved) safeHighlight(inputNodeIdResolved);

          // ถ้า RunAll รออยู่ ให้ไปต่อได้เลย (resume)
          if (runAllWaitingForInputRef.current) {
            try { runAllWaitingForInputRef.current(); } catch { }
            runAllWaitingForInputRef.current = null;
          }
          setIsLoading(false);
          return;
      }
      // --------------------------------------------------------------------------

      const hadOutputs = handleResponseOutputs(resp);
      if (hadOutputs) {
        const nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
        const nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;
        setPendingHighlightAfterOutput(nextId);
      } else {
        if (nextType === "IN" || nextType === "INPUT") {
          const resolvedVarName2 = await getFirstVarNameForNode(resp?.nextNodeId ?? null);
          setChatMessages((m) => [...m, { sender: "system", text: `กรุณากรอกค่า ${resolvedVarName2 ?? "input"}` }]);
          setExpectingInput(true);
        } else {
          setExpectingInput(false);
        }
      }

      if (runAllWaitingForInputRef.current) {
        try {
          runAllWaitingForInputRef.current();
        } catch { /* ignore */ }
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

  // Acknowledge logic removed from button but kept for reference or internal state clearing
  const acknowledgeOutputs = () => {
    const pending = pendingHighlightAfterOutput;
    setPendingHighlightAfterOutput(null);
    try {
      if (outputResumeRef.current) outputResumeRef.current();
    } catch (e) {}
    outputResumeRef.current = null;
    setTimeout(() => safeHighlight(pending ?? null), 80);
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
      if (!effectiveId) throw new Error("missing trialId/flowchartId");

      await apiTrialReset(effectiveId as any);

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
  // Test UI state & handler (unchanged minus effectiveId)
  // -------------------
  type TestLevel = "error" | "warning" | "info" | "success";
  const [testResults, setTestResults] = useState<Record<string, { level: TestLevel; text: string }[]>>({});

  const [runningTests, setRunningTests] = useState(false);
  const [labTestcases, setLabTestcases] = useState<any[]>([]);

  useEffect(() => {
    if (!effectiveId) return;
    let mounted = true;
    const loadTestcases = async () => {
      try {
        const resp = await apiGetTrialTestcases(effectiveId as any);
        console.log("apiGetTrialTestcases response:", resp);

        let tcs: any[] = [];
        if (Array.isArray(resp)) tcs = resp;
        else if (resp && Array.isArray(resp.data)) tcs = resp.data;
        else if (resp && Array.isArray(resp.testcases)) tcs = resp.testcases;
        else if (resp && Array.isArray(resp.testCases)) tcs = resp.testCases;

        if (mounted) setLabTestcases(tcs);
      } catch (err) {
        console.warn("Failed to load trial testcases", err);
      }
    };
    loadTestcases();
    return () => {
      mounted = false;
    };
  }, [effectiveId]);

  const handleRunTests = async () => {
    if (!effectiveId) return;
    setRunningTests(true);
    setTestResults({});

    try {
      const data = await apiRunTrialTestcases(effectiveId as any);
      console.log("apiRunTrialTestcases raw response:", data);

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
        // Use sequential index as key to match display
        const tcId = String(idx + 1);

        let status = "UNKNOWN";

        if (typeof r.passed === "boolean") {
          status = r.passed ? "PASS" : "FAIL";
        } 
        else {
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

          if (statusRaw !== null && typeof statusRaw !== "undefined") {
            if (typeof statusRaw === "string" || typeof statusRaw === "number") {
              status = String(statusRaw).toUpperCase();
            } else if (typeof statusRaw === "object") {
              status = (statusRaw.name ?? statusRaw.code ?? JSON.stringify(statusRaw)).toString().toUpperCase();
            }
          }
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

        const actual =
          r.actual ??
          r.actualVal ??
          r.actual_val ??
          r.output ??
          r.outputVal ??
          r.output_val ??
          r.resultOutput ??
          r.result_output ??
          null;

        let level: TestLevel = "info";
        if (["PASS", "PASSED", "OK", "SUCCESS"].includes(status)) level = "success";
        else if (["FAIL", "FAILED", "ERROR", "INPUT_MISSING", "TIMEOUT", "WRONG"].includes(status)) level = "error";
        else if (["WARN", "WARNING"].includes(status)) level = "warning";

        const messages: { level: TestLevel; text: string }[] = [];

        messages.push({ level, text: `${status}` });

        if (errorMessage) {
          messages.push({ level: "error", text: String(errorMessage) });
        }

        // <-- REMOVED: pushing "Actual: ..." message so Actual lines are not shown in UI
        // if (actual !== null && typeof actual !== "undefined") {
        //   try {
        //     const aStr = Array.isArray(actual) ? actual.join(", ") : String(actual);
        //     messages.push({ level: "info", text: `Actual: ${aStr}` });
        //   } catch {
        //     messages.push({ level: "info", text: `Actual: ${String(actual)}` });
        //   }
        // }

        newResults[tcId] = messages;
      });

      console.log("Mapped test results:", newResults);
      setTestResults(newResults);
    } catch (err) {
      console.error("Failed to run tests:", err);
    } finally {
      setRunningTests(false);
    }
  };

  // Render Badge now filters out generic FAIL/PASS text from the bottom area
  const renderBadge = (r: { level: TestLevel; text: string }, idx: number) => {
    const base = "inline-block text-base px-2 py-1 rounded-md mb-2 mr-2 font-medium";
    
    // Filter out simple status text that is already shown in the right badge
    if (['PASS', 'FAIL', 'UNKNOWN', 'ERROR', 'SUCCESS'].includes(r.text.toUpperCase())) {
        return null;
    }

    // Special styling for "Actual:" text to make it stand out and bigger
    if (r.text.startsWith("Actual:")) {
         return (
          <div key={idx} className={`block text-lg font-bold mt-1 ${r.level === 'error' || r.level === 'info' ? 'text-red-600' : 'text-gray-700'}`}>
            {r.text}
          </div>
        );
    }

    switch (r.level) {
      case "error":
        return (
          <div key={idx} className={`${base} bg-red-50 text-red-700 border border-red-200`}>
            {r.text}
          </div>
        );
      case "warning":
        return (
          <div key={idx} className={`${base} bg-yellow-50 text-yellow-800 border border-yellow-200`}>
            {r.text}
          </div>
        );
      case "info":
        return (
          <div key={idx} className={`${base} bg-blue-50 text-blue-800 border border-blue-200`}>
            {r.text}
          </div>
        );
      case "success":
        return (
          <div key={idx} className={`${base} bg-green-50 text-green-800 border border-green-200`}>
            {r.text}
          </div>
        );
      default:
        return null;
    }
  };

  const renderSummaryBadge = (level?: TestLevel | null, text?: string) => {
    const base = "inline-block text-sm px-3 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm";
    const displayText = text || "";
    switch (level) {
      case "error":
        return <div className={`${base} bg-red-500 text-white`}>{displayText || "FAIL"}</div>;
      case "warning":
        return <div className={`${base} bg-yellow-400 text-yellow-900`}>{displayText || "WARN"}</div>;
      case "info":
        return <div className={`${base} bg-blue-500 text-white`}>{displayText || "INFO"}</div>;
      case "success":
        return <div className={`${base} bg-green-500 text-white`}>{displayText || "PASS"}</div>;
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
          const items = content.split(",").map(part => {
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
    return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
  };

  // ------- UI rendering -------
  return (
    <div className="absolute z-1 pt-4">
      {/* Control bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md border border-gray-200 w-fit hover:shadow-lg transition-shadow duration-200">
        <button onClick={handleRunAll} title="Run" className="text-green-600 hover:text-green-700 text-lg p-2 rounded-full hover:bg-green-100 transition-colors">
          <FaPlay />
        </button>
        <button onClick={handleStep} disabled={isLoading || done} title={done ? "Finished" : "Step"} className={`text-yellow-600 text-lg p-2 rounded-full transition-colors ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:text-yellow-700 hover:bg-yellow-100"} ${done ? "opacity-40 cursor-not-allowed" : ""}`}>
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

      {/* Persistent single chat panel (Console) */}
      <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[420px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex items-center justify-between">
          <div className="font-medium flex items-center gap-2">Console</div>
          <div className="text-sm opacity-90">{expectingInput ? `Expecting: ${inputVarName ?? "input"}` : "Status"}</div>
        </div>

        <div ref={chatRef} className="p-3 overflow-auto bg-gray-50" style={{ maxHeight: 260, minHeight: 150 }}>
          {chatMessages.length === 0 && (
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
          )}
          {chatMessages.map((m, i) => (
            <div key={i} className={`mb-3 flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-lg whitespace-pre-wrap text-sm font-mono ${m.sender === "user" ? "bg-blue-600 text-white rounded-br-sm shadow-sm" : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"}`}>
                {m.text}
              </div>
            </div>
          ))}
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
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="พิมพ์ค่าที่ต้องการส่ง..."
                autoFocus
              />

              <button onClick={handleSubmitInput} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                ส่ง
              </button>
              <button onClick={cancelInput} className="bg-gray-200 text-gray-800 px-3 py-2 rounded text-sm hover:bg-gray-300">
                ยกเลิก
              </button>
            </div>
          ) : (
             <div className="flex justify-between items-center h-[38px]">
                <span className="text-sm text-gray-500">
                  {chatMessages.length > 0 ? "Output log" : ""}
                </span>
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
        <div className="absolute z-50 w-120 h-auto rounded-xl bg-white p-4 shadow-xl border border-gray-200 ml-20 mt-3 transform translate-x-[-10%] animate-fadeIn">
         <div className="relative w-full">
            {/* Title & description: allow long text to wrap and scroll if too tall */}
            <div className="text-gray-800 text-lg font-medium font-['Sarabun'] leading-snug mb-4 whitespace-pre-wrap break-words">
              {labInfo ? (
                <>
                  <div className="font-bold mb-1">{labInfo.name}</div>
                  <div className="text-gray-600 max-h-40 overflow-auto break-words whitespace-pre-wrap pr-2">
                    {labInfo.detail}
                  </div>
                </>
              ) : (
                "กำลังโหลดรายละเอียดโจทย์..."
              )}
            </div>

            <div className="space-y-4 max-h-96 overflow-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300">
              {labTestcases.length === 0 && <div className="text-sm text-gray-400">ยังไม่มี Testcases ให้แสดง</div>}
              {labTestcases.map((tc, index) => {
                // Use Index + 1 for display ID as requested
                const displayId = String(index + 1);

                const rawInput = parseVal(tc.inputVal ?? tc.input ?? tc.in ?? tc.input_values ?? []);
                const rawOutput = parseVal(tc.outputVal ?? tc.output ?? tc.out ?? tc.output_values ?? []);

                const format = (v: any) => {
                  if (Array.isArray(v)) {
                    return flattenDeep(v).join(", ");
                  }
                  return String(v ?? "-");
                };

                const inputDisplay = format(rawInput);
                const outputDisplay = format(rawOutput);

                return (
                  <div key={displayId} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      
                      {/* Left: Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                           <span className="text-lg font-bold text-gray-800">Test Case #{displayId}</span>
                        </div>
                        
                        {/* Combined Input/Output line with larger font */}
                        <div className="text-base text-gray-600">
                           <span className="font-semibold text-gray-800">Input:</span> <span className="mr-3 font-mono bg-gray-50 px-1 rounded">{inputDisplay}</span>
                           <span className="text-gray-400">|</span>
                           <span className="ml-3 font-semibold text-gray-800">Output:</span> <span className="font-mono bg-gray-50 px-1 rounded">{outputDisplay}</span>
                        </div>

                        {Array.isArray(tc.inHiddenVal) && tc.inHiddenVal.length > 0 && (
                          <div className="mt-1 text-sm text-gray-400">Hidden Inputs: {tc.inHiddenVal.join(", ")}</div>
                        )}
                      </div>

                      {/* Right: Score & Status */}
                      <div className="flex flex-col items-end gap-2 min-w-[100px]">
                         <div className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            Score: {tc.score ?? 0}
                         </div>
                         
                         <div>
                            {(testResults[displayId] ?? []).length === 0 ? (
                              <span className="text-sm text-gray-400 font-medium">Not run</span>
                            ) : (
                              (() => {
                                const items = testResults[displayId] ?? [];
                                const statusMsg = items[0];
                                if (statusMsg) {
                                  return renderSummaryBadge(statusMsg.level, statusMsg.text);
                                }
                                return renderSummaryBadge(null);
                              })()
                            )}
                         </div>
                      </div>
                    </div>

                    {/* Bottom: Result Details (Actual, Error, etc.) */}
                    <div className="mt-2 pt-2">
                      <div className="flex flex-col">
                        {(testResults[displayId] ?? []).map((r, idx) => (
                          <div key={idx}>
                            {renderBadge(r, idx)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={handleRunTests}
                disabled={runningTests}
                className={`text-base font-medium px-8 py-2 rounded-full transition-all shadow-sm ${runningTests ? "bg-gray-200 text-gray-600 cursor-not-allowed " : "bg-yellow-500 text-white hover:bg-yellow-600 hover:shadow"}`}>
                {runningTests ? "Testing..." : "Test"}
              </button>

              {/* Submit: visual parity with original UI but disabled in trial build (no submit handler available here) */}
              {/* <button
                disabled
                title="Submission disabled in trial"
                className="text-base font-medium px-6 py-2 rounded-full bg-blue-900 text-white opacity-60 cursor-not-allowed"
              >
                Submit
              </button> */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
