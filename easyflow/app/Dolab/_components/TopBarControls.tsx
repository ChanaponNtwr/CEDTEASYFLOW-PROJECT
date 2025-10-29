"use client";

import { useEffect, useRef, useState } from "react";
import { FaPlay, FaStepForward, FaStop, FaRedo } from "react-icons/fa";
import { executeStepNode, apiGetFlowchart, apiResetFlowchart } from "@/app/service/FlowchartService"; // <-- added apiResetFlowchart

type Variable = {
  name: string;
  value: any;
};

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

type ExecContext = {
  variables?: Variable[];
  index_map?: Record<string, number>;
  output?: any[];
};

type ExecResult = {
  node?: NodeResult;
  context?: ExecContext;
  done?: boolean;
  paused?: boolean;
};

type ExecuteResponse = {
  ok: boolean;
  result?: ExecResult;
  nextNodeId?: string | number;
  nextNodeType?: string | number;
  context?: {
    variables?: Variable[];
    output?: any[];
  };
  paused?: boolean;
  done?: boolean;
  reenter?: boolean;
  [k: string]: any;
};

interface TopBarControlsProps {
  flowchartId?: number;
  initialVariables?: Variable[] | null;
  forceAdvanceBP?: boolean;
  // callback ให้พาเรนต์ไฮไลท์ node ที่กำลังถูก execute (หรือ null เพื่อเคลียร์)
  onHighlightNode?: (nodeId: string | null) => void;
}

export default function TopBarControls({
  flowchartId = 8,
  initialVariables = null,
  forceAdvanceBP = true,
  onHighlightNode,
}: TopBarControlsProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputValue, setInputValue] = useState<any>("");
  const [isLoading, setIsLoading] = useState(false);
  const [variablesSent, setVariablesSent] = useState(false);
  const [lastResponse, setLastResponse] = useState<ExecuteResponse | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fetchedVariables, setFetchedVariables] = useState<Variable[] | null>(null);
  const [fetchingVars, setFetchingVars] = useState(false);

  // Node id ที่ modal จะส่งค่าเข้า (เช่น 'n4' หรือ 'n5') — เก็บเพื่อแสดง UI เท่านั้น
  const [inputNodeId, setInputNodeId] = useState<string | null>(null);
  // ชื่อตัวแปรที่ node เป้าหมายต้องการรับ (เช่น 'b')
  const [inputVarName, setInputVarName] = useState<string | null>(null);

  // NEW: Output modal state + data
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [outputData, setOutputData] = useState<any[]>([]);

  // when an output modal appears we may want to pause execution and resume when modal closed
  const outputResumeRef = useRef<(() => void) | null>(null);
  const [pendingHighlightAfterOutput, setPendingHighlightAfterOutput] = useState<string | null>(null);

  const togglePopup = () => setShowPopup((v) => !v);

  // helper: detect if a node-type represents an End/Terminate node
  const isEndType = (t?: string | number | null) => {
    if (!t) return false;
    const s = String(t).toUpperCase().trim();
    return ["EN", "END", "ED", "TERMINATE", "ENDNODE", "EXIT"].includes(s);
  };

  // --- Fetch variables from flowchart (fallback source) ---
  useEffect(() => {
    let mounted = true;
    const fetchVars = async () => {
      if (initialVariables && initialVariables.length > 0) {
        setFetchedVariables(initialVariables);
        return;
      }
      if (!flowchartId) return;

      try {
        setFetchingVars(true);
        const resp = await apiGetFlowchart(flowchartId);
        const nodes: any[] = resp?.flowchart?.nodes ?? resp?.nodes ?? [];

        const varNodes = nodes.filter(
          (n) => n?.type === "DC" || n?.type === "DECLARE" || n?.type === "VAR"
        );

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

  // --- Helper: resolve first variable name for a given nodeId ---
  const getFirstVarNameForNode = async (nodeId?: string | null): Promise<string | undefined> => {
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

  // helper to extract outputs from response and show modal if present
  // returns true if outputs were present and modal shown (caller may await resume)
  const handleResponseOutputs = (resp: ExecuteResponse | undefined | null): boolean => {
    const respOutputs = resp?.result?.context?.output ?? resp?.context?.output ?? [];
    if (Array.isArray(respOutputs) && respOutputs.length > 0) {
      setOutputData(respOutputs);
      setShowOutputModal(true);
      return true;
    }
    return false;
  };

  // ensure highlight cleared on unmount
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

  // helper to safely call onHighlightNode with small delay (avoid race)
  const safeHighlight = (id: string | null) => {
    try {
      // small delay to ensure ReactFlow has applied nodes update before highlight
      setTimeout(() => {
        onHighlightNode?.(id);
        console.log("[TopBarControls] called onHighlightNode ->", id);
      }, 50);
    } catch (err) {
      console.warn("safeHighlight error", err);
    }
  };

  // NEW helper: pick initial restart node from flowchart
  // prefer: Start node (ST/START), then DC/DECLARE/VAR, then first node
  const pickRestartNodeId = async (): Promise<string | null> => {
    try {
      if (!flowchartId) return null;
      const flow = await apiGetFlowchart(flowchartId);
      const nodes: any[] = flow?.flowchart?.nodes ?? flow?.nodes ?? [];
      // 1) look for Start node types
      const startNode = nodes.find((n) => String(n?.type).toUpperCase().startsWith("ST")) ?? null;
      if (startNode) return String(startNode.id);

      // 2) fallback: node types that declare variables (DC/DECLARE/VAR) — choose first
      const candidate =
        nodes.find((n) => ["DC", "DECLARE", "VAR"].includes(String(n?.type).toUpperCase())) ??
        nodes[0] ??
        null;
      if (!candidate) return null;
      return String(candidate.id);
    } catch (err) {
      console.warn("pickRestartNodeId: failed to fetch flowchart", err);
      return null;
    }
  };

  // NEW helper: pick an End node id (EN/END) if any
  const pickEndNodeId = async (): Promise<string | null> => {
    try {
      if (!flowchartId) return null;
      const flow = await apiGetFlowchart(flowchartId);
      const nodes: any[] = flow?.flowchart?.nodes ?? flow?.nodes ?? [];
      const candidate =
        nodes.find((n) => isEndType(n?.type)) ?? // type explicitly end-like
        nodes.find((n) => String(n?.label ?? "").toLowerCase().includes("end")) ??
        null;
      if (!candidate) return null;
      return String(candidate.id);
    } catch (err) {
      console.warn("pickEndNodeId: failed to fetch flowchart", err);
      return null;
    }
  };

  // highlight start node on mount (so Step starts at Start)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowchartId]);

  // --- Step execution (▶️) ---
  const handleStep = async () => {
    if (isLoading) return; // allow pressing even if previous run finished — we'll reset and continue
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const resolvedInitialVars = initialVariables ?? fetchedVariables ?? [];
      const varsToSend = variablesSent ? [] : resolvedInitialVars;

      // executeStepNode signature used here: (flowchartId, vars, forceAdvanceBP)
      const resp = (await executeStepNode(flowchartId, varsToSend, forceAdvanceBP)) as ExecuteResponse;

      console.log("executeStepNode response:", resp);
      setLastResponse(resp);
      setVariablesSent(true);
      setStepCount((s) => s + 1);

      // If backend explicitly marks done, respect it. Otherwise, also treat nextNodeType=end as done.
      const backendDone = Boolean(resp?.result?.done ?? resp?.done ?? false);
      const nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
      const inferredDone = isEndType(nextType);
      const finalDone = backendDone || inferredDone;

      // Resolve next node / input behavior
      const nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      const nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

      // show outputs modal if backend returned outputs — pause here and wait for user to close modal before moving highlight
      const hadOutputs = handleResponseOutputs(resp);
      if (hadOutputs) {
        // store pending next highlight so when user closes modal we move to the next node
        setPendingHighlightAfterOutput(nextId);
        return;
      }

      // NEW: ให้พาเรนต์ไฮไลท์ node ปัจจุบัน (ถ้ามี)
      // prefer resp.result.node.id (node that executed). fallback to resp.nextNodeId
      const rawId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
      const currentNodeId = rawId !== null && typeof rawId !== "undefined" ? String(rawId) : null;
      safeHighlight(currentNodeId);

      if (nextType === "IN" || nextType === "INPUT") {
        // Resolve the variable name for the next node, then open modal
        const resolvedVarName = await getFirstVarNameForNode(nextId ?? null);
        setInputNodeId(nextId ?? null);
        setInputVarName(resolvedVarName ?? null);
        setTimeout(() => setShowInputModal(true), 0);
        return;
      }

      // === IMPORTANT: handle "done" (end of flow) robustly ===
      if (finalDone) {
        // Highlight the End node if available
        try {
          const endId = await pickEndNodeId();
          if (endId) safeHighlight(endId);
        } catch (err) {
          console.warn("failed to pick end node", err);
        }

        // AUTO-RESET: reset backend session and clear client state so Step/RunAll can start from Start immediately
        try {
          // prefer explicit reset API if available
          await apiResetFlowchart(flowchartId);
        } catch (err) {
          console.warn("apiResetFlowchart failed during auto-reset, trying executeStepNode reset", err);
          try {
            await executeStepNode(flowchartId, [], false);
          } catch (e) {
            console.warn("fallback executeStepNode reset also failed", e);
          }
        }

        // Clear client state
        setLastResponse(null);
        setStepCount(0);
        setVariablesSent(false);
        setInputNodeId(null);
        setInputVarName(null);
        setDone(false);

        // Highlight restart node (Start / DC / first)
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

  // --- Run All (ยิง API รัวๆจนถึง Input) ---
  const handleRunAll = async () => {
    if (isLoading) return; // allow restart even if previously done
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const resolvedInitialVars = initialVariables ?? fetchedVariables ?? [];
      // if we haven't sent initial vars this session, send them once
      let firstCallVars = variablesSent ? [] : resolvedInitialVars;

      // first call
      let resp = (await executeStepNode(flowchartId, firstCallVars, forceAdvanceBP)) as ExecuteResponse;
      console.log("runAll first response:", resp);
      setLastResponse(resp);
      setVariablesSent(true);
      setStepCount((s) => s + 1);

      // detect done (backend or inferred by nextType)
      const backendDone = Boolean(resp?.result?.done ?? resp?.done ?? false);
      let nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
      const inferredDone = isEndType(nextType);
      let finalDone = backendDone || inferredDone;

      // Resolve next node id for potential pending highlight
      let nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      let nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

      // show outputs: pause and wait for user to close modal before continuing
      if (handleResponseOutputs(resp)) {
        setPendingHighlightAfterOutput(nextId);
        // await user closing the modal
        await new Promise<void>((resolve) => (outputResumeRef.current = resolve));
        outputResumeRef.current = null;
        // when resumed, immediately highlight the pending next node
        setPendingHighlightAfterOutput(null);
        if (nextId) safeHighlight(nextId);
      } else {
        const rawId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
        safeHighlight(rawId !== null && typeof rawId !== "undefined" ? String(rawId) : null);
      }

      // if backend asks for input or finished, stop and let UI handle
      nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

      if (nextType === "IN" || nextType === "INPUT") {
        const resolvedVarName = await getFirstVarNameForNode(nextId ?? null);
        setInputNodeId(nextId ?? null);
        setInputVarName(resolvedVarName ?? null);
        setTimeout(() => setShowInputModal(true), 0);
        return;
      }

      if (finalDone) {
        // Highlight end then auto-reset so Run/Step start from Start
        try {
          const endId = await pickEndNodeId();
          if (endId) safeHighlight(endId);
        } catch (err) {
          console.warn("runAll done: failed to pick end node", err);
        }

        try {
          await apiResetFlowchart(flowchartId);
        } catch (err) {
          console.warn("reset without advance failed (runAll)", err);
          try {
            await executeStepNode(flowchartId, [], false);
          } catch (e) {
            console.warn("fallback reset also failed (runAll)", e);
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
        return;
      }

      // loop until either input is required or flow is done
      // include a very small throttle to avoid hammering the backend
      while (true) {
        // small throttle
        await new Promise((r) => setTimeout(r, 180));

        resp = (await executeStepNode(flowchartId, [], forceAdvanceBP)) as ExecuteResponse;
        console.log("runAll loop response:", resp);
        setLastResponse(resp);
        setStepCount((s) => s + 1);
        setVariablesSent(true);

        const backendDoneLoop = Boolean(resp?.result?.done ?? resp?.done ?? false);
        nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
        const inferredDoneLoop = isEndType(nextType);
        finalDone = backendDoneLoop || inferredDoneLoop;

        // Resolve next node id
        nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
        nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

        // handle outputs: pause loop and wait for user to close modal
        if (handleResponseOutputs(resp)) {
          setPendingHighlightAfterOutput(nextId);
          await new Promise<void>((resolve) => (outputResumeRef.current = resolve));
          outputResumeRef.current = null;
          setPendingHighlightAfterOutput(null);
          if (nextId) safeHighlight(nextId);
        } else {
          const rawLoopId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
          const loopNodeId = rawLoopId !== null && typeof rawLoopId !== "undefined" ? String(rawLoopId) : null;
          safeHighlight(loopNodeId);
        }

        // prepare for input request or done state
        if (nextType === "IN" || nextType === "INPUT") {
          const resolvedVarName = await getFirstVarNameForNode(nextId ?? null);
          setInputNodeId(nextId ?? null);
          setInputVarName(resolvedVarName ?? null);
          setTimeout(() => setShowInputModal(true), 0);
          break;
        }

        if (finalDone) {
          // Highlight end and auto-reset so UI returns to Start state
          try {
            const endId = await pickEndNodeId();
            if (endId) safeHighlight(endId);
          } catch (err) {
            console.warn("runAll loop: failed to pick end node", err);
          }

          try {
            await apiResetFlowchart(flowchartId);
          } catch (err) {
            console.warn("reset without advance failed (runAll loop)", err);
            try {
              await executeStepNode(flowchartId, [], false);
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

        // otherwise continue looping
      }
    } catch (err) {
      console.error("runAll error", err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Submit input from modal (💬) ---
  const handleSubmitInput = async () => {
    if (!lastResponse) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      let currentVars: Variable[] =
        lastResponse.result?.node?.variables ??
        lastResponse.result?.context?.variables ??
        fetchedVariables ??
        [];

      if (currentVars.length === 0) {
        throw new Error("No variable available to input.");
      }

      // target node id (UI state only; backend should know next node from session)
      const targetNodeIdRaw = inputNodeId ?? lastResponse?.nextNodeId ?? null;
      const targetNodeId = targetNodeIdRaw !== null && typeof targetNodeIdRaw !== "undefined" ? String(targetNodeIdRaw) : null;

      const resolvedVarName =
        inputVarName ?? (await getFirstVarNameForNode(targetNodeId)) ?? currentVars[0].name;

      // Minimal payload — single variable only
      const singleVarPayload: Variable[] = [{ name: resolvedVarName, value: inputValue }];

      console.log("📤 Sending minimal input payload for nodeId=", targetNodeId, singleVarPayload);

      // IMPORTANT: call with only 3 args to match signature
      const resp = (await executeStepNode(flowchartId, singleVarPayload, forceAdvanceBP)) as ExecuteResponse;

      console.log("executeStepNode (after input) response:", resp);
      setLastResponse(resp);
      setStepCount((s) => s + 1);
      setVariablesSent(true);

      const backendDone = Boolean(resp?.result?.done ?? resp?.done ?? false);
      const nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
      const inferredDone = isEndType(nextType);
      const finalDone = backendDone || inferredDone;

      setShowInputModal(false);
      setInputValue("");
      setInputNodeId(null);
      setInputVarName(null);

      // NEW: ให้พาเรนต์ไฮไลท์ node ปัจจุบัน (ถ้ามี)
      const rawId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
      const currentNodeId = rawId !== null && typeof rawId !== "undefined" ? String(rawId) : null;
      safeHighlight(currentNodeId);

      // show outputs modal if backend returned outputs
      const hadOutputs = handleResponseOutputs(resp);
      if (hadOutputs) {
        // pause; wait for user close and then highlight next node
        const nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
        const nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;
        setPendingHighlightAfterOutput(nextId);
        return;
      }

      // prepare next input if backend asks again
      const nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      const nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;
      if (nextType === "IN" || nextType === "INPUT") {
        const nextVarName = await getFirstVarNameForNode(nextId ?? null);
        setInputNodeId(nextId ?? null);
        setInputVarName(nextVarName ?? null);
        setTimeout(() => setShowInputModal(true), 0);
        return;
      }

      if (finalDone) {
        // Highlight end then auto-reset so Step/RunAll can start from Start again
        try {
          const endId = await pickEndNodeId();
          if (endId) safeHighlight(endId);
        } catch (err) {
          console.warn("submit input: failed to pick end node", err);
        }

        try {
          await apiResetFlowchart(flowchartId);
        } catch (err) {
          console.warn("reset without advance failed (after input)", err);
          try {
            await executeStepNode(flowchartId, [], false);
          } catch (e) {
            console.warn("fallback reset also failed (after input)", e);
          }
        }

        setLastResponse(null);
        setStepCount(0);
        setDone(false);
        setVariablesSent(false);
        const restartId = await pickRestartNodeId();
        safeHighlight(restartId);
        return;
      }
    } catch (err) {
      console.error("submit input error", err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Reset flowchart (uses only allowed args) ---
  const resetFlowchart = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (!flowchartId) throw new Error("missing flowchartId");

      // 1) call apiResetFlowchart to reset backend session
      await apiResetFlowchart(flowchartId);

      // 2) Clear all client state so next Step/Run starts fresh
      setLastResponse(null);
      setStepCount(0);
      setDone(false);
      setVariablesSent(false);
      setInputNodeId(null);
      setInputVarName(null);
      setShowInputModal(false);
      setShowOutputModal(false);
      setOutputData([]);
      setErrorMsg(null);

      // 3) highlight the restart node (prefer Start then DC/DECLARE/VAR). If not found, clear highlight.
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

  const currentNode: NodeResult | null = lastResponse?.result?.node ?? null;
  const outputs: any[] =
    lastResponse?.result?.context?.output ?? lastResponse?.context?.output ?? [];

  const previewVariables: Variable[] = (() => {
    const fromResult = lastResponse?.result?.context?.variables;
    if (Array.isArray(fromResult) && fromResult.length > 0) return fromResult;
    if (Array.isArray(fetchedVariables) && fetchedVariables.length > 0) return fetchedVariables;
    if (Array.isArray(initialVariables) && initialVariables.length > 0) return initialVariables;
    return [];
  })();

  // helper to render any value as readable string
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

  return (
    <div className="absolute z-1 pt-4">
      {/* Control bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md border border-gray-200 w-fit hover:shadow-lg transition-shadow duration-200">
        <button
          onClick={handleRunAll}
          title="Run"
          className="text-green-600 hover:text-green-700 text-lg p-2 rounded-full hover:bg-green-100 transition-colors"
        >
          <FaPlay />
        </button>
        <button
          onClick={handleStep}
          disabled={isLoading || done}
          title={done ? "Finished" : "Step"}
          className={`text-yellow-600 text-lg p-2 rounded-full transition-colors ${
            isLoading ? "opacity-50 cursor-not-allowed" : "hover:text-yellow-700 hover:bg-yellow-100"
          } ${done ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          <span className={`${isLoading ? "animate-pulse" : ""}`}>
            <FaStepForward />
          </span>
        </button>
        <button
          onClick={resetFlowchart}
          className="text-gray-600 hover:text-gray-700 text-lg p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <FaStop />
        </button>
        <span
          // onClick={() => setShowPopup((v) => !v)}
          onClick={togglePopup}
          className="ml-2 px-3 py-1 bg-blue-200 text-blue-800 text-sm font-semibold rounded-lg cursor-pointer hover:bg-blue-300 transition-colors select-none"
        >
          Problem solving
        </span>
      </div>

      {/* Information */}
      {/* <div className="mt-2 ml-2 bg-white rounded-md shadow-sm border border-gray-100 p-3 w-[360px] text-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-600">
            Step: <strong className="text-gray-800">{stepCount}</strong>
          </div>
          <div className={`text-xs font-semibold ${done ? "text-green-700" : "text-gray-600"}`}>
            {done ? "Done" : isLoading ? "Running..." : "Paused"}
          </div>
        </div>

        <div className="text-xs text-gray-600 mb-1">Current node:</div>
        <div className="mb-2 text-sm text-gray-800">
          {currentNode ? (
            <>
              <div>
                <b>ID:</b> {String(currentNode.id)}
              </div>
              <div>
                <b>Type:</b> {currentNode.type}
              </div>
              <div>
                <b>Label:</b> {currentNode.label}
              </div>
            </>
          ) : (
            <div className="text-gray-500">ยังไม่มีข้อมูล (กด Step เพื่อเริ่ม)</div>
          )}
        </div>

        <div className="text-xs text-gray-600 mb-1">Outputs:</div>
        <div className="mb-2 min-h-[28px] text-sm text-gray-800">
          {outputs.length > 0 ? (
            <ul className="list-disc list-inside">
              {outputs.map((o, i) => (
                <li key={i}>{renderValue(o)}</li>
              ))}
            </ul>
          ) : (
            <div className="text-gray-500">ไม่มี output</div>
          )}
        </div>

        <div className="text-xs text-gray-600">Variables:</div>
        <div className="text-sm text-gray-800">
          {fetchingVars ? (
            <div className="text-gray-500 mt-1">Loading...</div>
          ) : previewVariables.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {previewVariables.map((v, i) => (
                <div key={i} className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                  {v.name}: {String(v.value)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 mt-1">ไม่มีตัวแปร</div>
          )}
        </div>

        {errorMsg && <div className="mt-2 text-xs text-red-600">Error: {errorMsg}</div>}
      </div> */}

      {/* Input Modal */}
      {showInputModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-opacity-100 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80">
            <div className="mb-4 text-gray-700">
              กรอกค่า {inputVarName ?? lastResponse?.result?.node?.variables?.[0]?.name ?? "input"}:
            </div>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-2 py-1 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitInput}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
              <button
                onClick={() => {
                  setShowInputModal(false);
                  setInputNodeId(null);
                  setInputVarName(null);
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Output Modal (NEW) */}
      {showOutputModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-opacity-100 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <div className="mb-3 text-lg font-semibold">Output</div>
            <div className="max-h-56 overflow-auto text-sm mb-4">
              {outputData.map((o, i) => (
                <div key={i} className="mb-2 p-2 bg-gray-50 rounded">
                  {/* <div className="text-xs text-gray-500">#{i + 1}</div> */}
                  <pre className="whitespace-pre-wrap break-words text-sm">{renderValue(o)}</pre>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  // close modal, then resume any paused run and advance highlight to pending node
                  setShowOutputModal(false);
                  const pending = pendingHighlightAfterOutput;
                  setPendingHighlightAfterOutput(null);
                  try {
                    if (outputResumeRef.current) outputResumeRef.current();
                  } catch (e) {
                    /* ignore */
                  }
                  outputResumeRef.current = null;
                  // advance highlight after a small delay so ReactFlow can update
                  setTimeout(() => {
                    safeHighlight(pending ?? null);
                  }, 80);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showPopup && (
        <div className="absolute z-50 w-96 h-80 rounded-xl bg-white p-3 shadow-xl border border-gray-200 ml-20 mt-3 transform translate-x-[-10%] animate-fadeIn">
          <div className="relative w-full h-full">
            <div className="text-gray-800 text-sm font-medium font-['Sarabun'] leading-snug mb-6">
              จงเขียนโปรแกรม เพื่อคํานวณหาพื้นที่ของสามเหลี่ยม <br />
              Area = 1⁄2 x ฐาน x สูง โดยมีข้อมูลเข้า (Input) <br />
              จากคีย์บอร์ด คือ ค่าของฐานของสามเหลี่ยม (b: Base) และค่าความสูงของสามเหลี่ยม (h: Height)
            </div>
            <div className="mt-6">
              <table className="w-full text-sm font-['Sarabun'] border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left border-b border-gray-300">No</th>
                    <th className="p-2 text-left border-b border-gray-300">Testcase</th>
                    <th className="p-2 text-left border-b border-gray-300">Input</th>
                    <th className="p-2 text-left border-b border-gray-300">Output</th>
                    <th className="p-2 text-left border-b border-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border-b border-gray-200">1</td>
                    <td className="p-2 border-b border-gray-200">y</td>
                    <td className="p-2 border-b border-gray-200">8</td>
                    <td className="p-2 border-b border-gray-200" />
                    <td className="p-2 border-b border-gray-200">
                      <button className="bg-yellow-500 text-white text-sm px-3 py-1 rounded-full hover:bg-yellow-600 transition-colors">
                        Test
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 border-b border-gray-200">2</td>
                    <td className="p-2 border-b border-gray-200">x</td>
                    <td className="p-2 border-b border-gray-200">ลอง</td>
                    <td className="p-2 border-b border-gray-200" />
                    <td className="p-2 border-b border-gray-200">
                      <button className="bg-yellow-500 text-white text-sm px-3 py-1 rounded-full hover:bg-yellow-600 transition-colors">
                        Test
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button className="mt-6 bg-blue-900 text-white text-sm px-6 py-2 rounded-full hover:bg-blue-800 transition-colors absolute bottom-4 right-6">
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
