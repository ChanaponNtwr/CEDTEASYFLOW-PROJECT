"use client";

import { useEffect, useRef, useState } from "react";
import { FaPlay, FaStepForward, FaStop } from "react-icons/fa";
import { executeStepNode, apiGetFlowchart, apiResetFlowchart, apiRunTestcaseFromFlowchart, apiGetTestcases } from "@/app/service/FlowchartService";

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
  flowchartId?: number;
  initialVariables?: Variable[] | null;
  forceAdvanceBP?: boolean;
  // <-- allow number as well to avoid the TS error when callers pass number ids
  onHighlightNode?: (nodeId: string | number | null) => void;
  autoPlayInputs?: boolean;
}

export default function TopBarControls({
  flowchartId = 11,
  initialVariables = null,
  forceAdvanceBP = true,
  onHighlightNode,
  autoPlayInputs = false,
}: TopBarControlsProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [variablesSent, setVariablesSent] = useState(false);
  const [lastResponse, setLastResponse] = useState<ExecuteResponse | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fetchedVariables, setFetchedVariables] = useState<Variable[] | null>(null);
  const [fetchingVars, setFetchingVars] = useState(false);

  // unified persistent chat (single modal shown permanently)
  const [chatMessages, setChatMessages] = useState<{ sender: "system" | "user"; text: string }[]>([]);
  const [expectingInput, setExpectingInput] = useState(false);
  const [inputValue, setInputValue] = useState<any>("");

  // <-- allow number too because backend may return numeric ids
  const [inputNodeId, setInputNodeId] = useState<string | number | null>(null);
  const [inputVarName, setInputVarName] = useState<string | null>(null);

  const outputResumeRef = useRef<(() => void) | null>(null);
  // <-- allow number too for pending highlight id
  const [pendingHighlightAfterOutput, setPendingHighlightAfterOutput] = useState<string | number | null>(null);

  const runAllActiveRef = useRef(false);
  const runAllWaitingForInputRef = useRef<(() => void) | null>(null);

  const togglePopup = () => setShowPopup((v) => !v);

  const isEndType = (t?: string | number | null) => {
    if (!t) return false;
    const s = String(t).toUpperCase().trim();
    return ["EN", "END", "ED", "TERMINATE", "ENDNODE", "EXIT"].includes(s);
  };

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

        const varNodes = nodes.filter((n) => n?.type === "DC" || n?.type === "DECLARE" || n?.type === "VAR");

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

  // accept string | number | null for nodeId because callers may pass numeric ids
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

  // append outputs to chat and (for non-auto) pause until user acknowledges
  const handleResponseOutputs = (resp: ExecuteResponse | undefined | null, autoContinue = false): boolean => {
    const respOutputs = resp?.result?.context?.output ?? resp?.context?.output ?? [];
    if (Array.isArray(respOutputs) && respOutputs.length > 0) {
      const mapped = respOutputs.map((o) => ({ sender: "system" as const, text: renderValue(o) }));
      setChatMessages((m) => [...m, ...mapped]);

      if (!autoContinue) {
        // set pending highlight and wait for user to press Acknowledge in the persistent panel
        return true;
      }
      console.log("Auto-continue: output recorded", respOutputs);
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

  // accept number as well
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

      const resp = (await executeStepNode(flowchartId, varsToSend, forceAdvanceBP)) as ExecuteResponse;
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
        setPendingHighlightAfterOutput(nextId);
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
          await apiResetFlowchart(flowchartId);
        } catch (err) {
          console.warn("apiResetFlowchart failed during auto-reset, trying executeStepNode reset", err);
          try {
            await executeStepNode(flowchartId, [], false);
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

    try {
      const resolvedInitialVars = initialVariables ?? fetchedVariables ?? [];
      let firstCallVars = variablesSent ? [] : resolvedInitialVars;

      let resp = (await executeStepNode(flowchartId, firstCallVars, forceAdvanceBP)) as ExecuteResponse;
      setLastResponse(resp);
      setVariablesSent(true);
      setStepCount((s) => s + 1);

      let nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
      let finalDone = Boolean(resp?.result?.done ?? resp?.done ?? false) || isEndType(nextType);

      let nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      let nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

      if (handleResponseOutputs(resp, autoPlayInputs)) {
        if (!autoPlayInputs) {
          setPendingHighlightAfterOutput(nextId);
          await new Promise<void>((resolve) => (outputResumeRef.current = resolve));
          outputResumeRef.current = null;
          setPendingHighlightAfterOutput(null);
          if (nextId) safeHighlight(nextId);
        } else {
          if (nextId) safeHighlight(nextId);
        }
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
          resp = (await executeStepNode(flowchartId, singleVarPayload, forceAdvanceBP)) as ExecuteResponse;
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
        setIsLoading(false);
        runAllActiveRef.current = false;
        return;
      }

      while (runAllActiveRef.current) {
        await new Promise((r) => setTimeout(r, 180));

        resp = (await executeStepNode(flowchartId, [], forceAdvanceBP)) as ExecuteResponse;
        setLastResponse(resp);
        setStepCount((s) => s + 1);
        setVariablesSent(true);

        const backendDoneLoop = Boolean(resp?.result?.done ?? resp?.done ?? false);
        let nextTypeLoop = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
        const inferredDoneLoop = isEndType(nextTypeLoop);
        const finalDoneLoop = backendDoneLoop || inferredDoneLoop;

        nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
        nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;

        if (handleResponseOutputs(resp, autoPlayInputs)) {
          setPendingHighlightAfterOutput(nextId);
          if (!autoPlayInputs) {
            await new Promise<void>((resolve) => (outputResumeRef.current = resolve));
            outputResumeRef.current = null;
            setPendingHighlightAfterOutput(null);
            if (nextId) safeHighlight(nextId);
          } else {
            setPendingHighlightAfterOutput(null);
            if (nextId) safeHighlight(nextId);
          }
        } else {
          const rawLoopId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
          const loopNodeId = rawLoopId !== null && typeof rawLoopId !== "undefined" ? String(rawLoopId) : null;
          safeHighlight(loopNodeId);
        }

        if (nextTypeLoop === "IN" || nextTypeLoop === "INPUT") {
          const resolvedVarName = await getFirstVarNameForNode(nextId ?? null);
          const defaultVal = resolveDefaultValueForVar(resolvedVarName ?? null);
          if (autoPlayInputs) {
            const payload: Variable[] = [{ name: resolvedVarName ?? "input", value: defaultVal }];
            resp = (await executeStepNode(flowchartId, payload, forceAdvanceBP)) as ExecuteResponse;
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
        } catch { }
        runAllWaitingForInputRef.current = null;
      }
      if (outputResumeRef.current) {
        try {
          outputResumeRef.current();
        } catch { }
        outputResumeRef.current = null;
      }
    }
  };

  // --- Input submit (unchanged) ---
  const handleSubmitInput = async () => {
    if (!expectingInput) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // current vars from response / context / fetched flowchart vars
      let currentVars: Variable[] = lastResponse?.result?.node?.variables ?? lastResponse?.result?.context?.variables ?? fetchedVariables ?? [];

      // determine node id to try to resolve var name from
      const targetNodeIdRaw = inputNodeId ?? lastResponse?.nextNodeId ?? null;
      const targetNodeId = targetNodeIdRaw !== null && typeof targetNodeIdRaw !== "undefined" ? String(targetNodeIdRaw) : null;

      // Try to resolve variable name from several places (inputVarName -> flowchart -> currentVars)
      const resolvedFromFlow = await getFirstVarNameForNode(targetNodeId);
      const resolvedVarName = inputVarName ?? resolvedFromFlow ?? currentVars[0]?.name ?? null;

      if (!resolvedVarName) {
        // debug info for why frontend can't find a var name
        console.warn("No variable name found for input. lastResponse:", lastResponse, "fetchedVariables:", fetchedVariables, "targetNodeId:", targetNodeId);
        setErrorMsg("ไม่พบชื่อตัวแปรสำหรับการป้อนข้อมูล — โปรดตรวจสอบ response จาก backend (result.node / result.context / nextNodeId) หรือ node ใน flowchart ว่ามี data.variable / data.name หรือไม่");
        setIsLoading(false);
        return;
      }

      // debug: what we're about to send
      console.log("Submitting input:", { targetNodeId, resolvedVarName, inputValue });

      setChatMessages((m) => [...m, { sender: "user", text: String(inputValue) }]);

      const singleVarPayload: Variable[] = [{ name: resolvedVarName, value: inputValue }];

      const resp = (await executeStepNode(flowchartId, singleVarPayload, forceAdvanceBP)) as ExecuteResponse;

      // save response and update UI state (same as original)
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
      if (hadOutputs) {
        const nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
        const nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;
        setPendingHighlightAfterOutput(nextId);
        // leave expectingInput=false and keep persistent panel visible so user can acknowledge
        setExpectingInput(false);
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
        } catch {
          /* ignore */
        }
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

  const acknowledgeOutputs = () => {
    const pending = pendingHighlightAfterOutput;
    setPendingHighlightAfterOutput(null);
    try {
      if (outputResumeRef.current) outputResumeRef.current();
    } catch (e) { }
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
      } catch { }
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
        } catch { }
        runAllWaitingForInputRef.current = null;
      }
      if (outputResumeRef.current) {
        try {
          outputResumeRef.current();
        } catch { }
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
  // New: test UI state & handler
  // -------------------
  type TestLevel = "error" | "warning" | "info" | "success";
  const [testResults, setTestResults] = useState<Record<string, { level: TestLevel; text: string }[]>>({});

  const [runningTests, setRunningTests] = useState(false);
  const [labTestcases, setLabTestcases] = useState<any[]>([]);

  useEffect(() => {
    if (!flowchartId) return;
    // Attempt to fetch lab testcases if we can find a labId from flowchart details
    let mounted = true;
    const loadTestcases = async () => {
      try {
        // Mockup labId = 2 as requested by user
        const labId = 4;

        if (labId) {
          const resp = await apiGetTestcases(labId);
          console.log("apiGetTestcases response:", resp);

          let tcs = [];
          if (Array.isArray(resp)) {
            tcs = resp;
          } else if (resp && Array.isArray(resp.data)) {
            tcs = resp.data;
          } else if (resp && Array.isArray(resp.testcases)) {
            tcs = resp.testcases;
          }

          if (mounted) {
            setLabTestcases(tcs);
          }
        }
      } catch (err) {
        console.warn("Failed to load testcases", err);
      }
    };
    loadTestcases();
    return () => { mounted = false; };
  }, [flowchartId]);


  const handleRunTests = async () => {
    if (!flowchartId) return;
    setRunningTests(true);
    setTestResults({});

    try {
      const data = await apiRunTestcaseFromFlowchart(flowchartId);
      console.log("apiRunTestcaseFromFlowchart raw response:", data);

      // รองรับหลายโครงสร้างที่เป็นไปได้
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
        // normalize testcase id (รองรับหลายชื่อตัวแปร)
        const rawId =
          r.testcaseId ??
          r.testcase_id ??
          r.id ??
          r.tcId ??
          r.testcase?.id ??
          r.testcase?.testcaseId ??
          (typeof r === "object" && r?.inputVal ? idx + 1 : undefined);

        const tcId = String(rawId ?? idx + 1);

        // normalize status (รองรับ string / object / number / nested)
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

        // normalize error / message fields
        const errorMessage =
          r.errorMessage ??
          r.error_message ??
          r.error ??
          (typeof r.error === "object" ? r.error?.message ?? JSON.stringify(r.error) : undefined) ??
          r.message ??
          r.msg ??
          (Array.isArray(r.errors) ? r.errors.join("; ") : undefined) ??
          null;

        // expected / actual (เพื่อแสดงรายละเอียด)
        const expected =
          r.expected ??
          r.expectedVal ??
          r.expected_val ??
          r.expectedOutput ??
          r.expected_output ??
          r.expectedResult ??
          r.expected_result ??
          r.expected?.output ??
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

        // Decide level
        let level: TestLevel = "info";
        if (["PASS", "PASSED", "OK", "SUCCESS"].includes(status)) level = "success";
        else if (["FAIL", "FAILED", "ERROR", "INPUT_MISSING", "TIMEOUT", "WRONG"].includes(status)) level = "error";
        else if (["WARN", "WARNING"].includes(status)) level = "warning";

        const messages: { level: TestLevel; text: string }[] = [];

        // Add status message first
        messages.push({ level, text: `${status}` });

        if (errorMessage) {
          messages.push({ level: "error", text: String(errorMessage) });
        }

        // If expected/actual exist, show them
        // if (expected !== null && typeof expected !== "undefined") {
        //   try {
        //     const eStr = Array.isArray(expected) ? expected.join(", ") : String(expected);
        //     messages.push({ level: "info", text: `Expected: ${eStr}` });
        //   } catch {
        //     messages.push({ level: "info", text: `Expected: ${String(expected)}` });
        //   }
        // }
        if (actual !== null && typeof actual !== "undefined") {
          try {
            const aStr = Array.isArray(actual) ? actual.join(", ") : String(actual);
            messages.push({ level: "info", text: `Actual: ${aStr}` });
          } catch {
            messages.push({ level: "info", text: `Actual: ${String(actual)}` });
          }
        }

        // store mapped result
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

  const renderBadge = (r: { level: TestLevel; text: string }, idx: number) => {
    const base = "inline-block text-xs px-2 py-1 rounded-md mb-2";
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

  // New: compact summary badge that shows only the level word
  const renderSummaryBadge = (level?: TestLevel | null, text?: string) => {
    const base = "inline-block text-xs px-2 py-1 rounded-md font-semibold";
    const displayText = text || ""; // Use provided text or fallback to level name
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

  // helper parse helpers used in render
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

      {/* Persistent single chat panel (always visible) */}
      <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[420px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex items-center justify-between">
          <div className="font-medium">Interactive Chat</div>
          <div className="text-sm opacity-90">{expectingInput ? `Expecting: ${inputVarName ?? "input"}` : "Status"}</div>
        </div>

        <div ref={chatRef} className="p-3 overflow-auto bg-gray-50" style={{ maxHeight: 260 }}>
          {chatMessages.length === 0 && <div className="text-sm text-gray-400">ระบบพร้อม — กด Step หรือ Run เพื่อเริ่ม</div>}
          {chatMessages.map((m, i) => (
            <div key={i} className={`mb-3 flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] px-3 py-2 rounded-lg whitespace-pre-wrap ${m.sender === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-200 text-gray-800 rounded-bl-sm"}`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-white border-t border-gray-100">
          {expectingInput ? (
            <div className="flex gap-2">
                {/* เปลี่ยนเป็น text + inputMode เพื่อเลี่ยง spinner และรองรับตัวอักษร */}
                <input
                  type="text"
                  inputMode="text" // ถ้าต้องการ keyboard ตัวเลขบนมือถือ ให้เปลี่ยนเป็น "decimal" หรือ "numeric"
                  value={inputValue}
                  onChange={(e) => {
                    const raw = e.target.value;

                    // ถ้าว่าง ให้เก็บเป็น empty string
                    if (raw === "") {
                      setInputValue("");
                      return;
                    }

                    // ถ้าเป็นตัวเลข "สมบูรณ์" (เช่น 123, -12.34) ให้แปลงเป็น Number
                    // จะไม่แปลงกรณีพิมพ์ "-" หรือ "1." ระหว่างพิมพ์
                    const fullNumberRegex = /^-?\d+(\.\d+)?$/;
                    if (fullNumberRegex.test(raw)) {
                      setInputValue(Number(raw));
                    } else {
                      // กรณีอื่นเก็บเป็น string (รับตัวอักษรได้)
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
              <div className="text-sm text-gray-500">ไม่มีข้อความที่ต้องการการป้อนข้อมูล</div>
              <div className="flex gap-2">
                <button onClick={() => setChatMessages([])} className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
                  Clear
                </button>
                <button onClick={acknowledgeOutputs} className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">
                  Acknowledge
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPopup && (
        <div className="absolute z-50 w-120 h-auto rounded-xl bg-white p-4 shadow-xl border border-gray-200 ml-20 mt-3 transform translate-x-[-10%] animate-fadeIn">
          <div className="relative w-full">
            <div className="text-gray-800 text-sm font-medium font-['Sarabun'] leading-snug mb-4">
              จงเขียนโปรแกรม เพื่อคํานวณหาพื้นที่ของสามเหลี่ยม <br />
              Area = 1⁄2 x ฐาน x สูง โดยมีข้อมูลเข้า (Input) <br />
              จากคีย์บอร์ด คือ ค่าของฐานของสามเหลี่ยม (b: Base) และค่าความสูงของสามเหลี่ยม (h: Height)
            </div>

            {/* Non-table testcases layout: cards/list */}
            <div className="space-y-3 max-h-96 overflow-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300">
              {labTestcases.map((tc, index) => {
                // Map API fields to UI fields
                // Normalize ID to match what handleRunTests sets in testResults
                const displayId = String(tc.testcaseId ?? tc.testcase_id ?? tc.id ?? tc.tcId ?? (index + 1));

                // parse input/output values for display
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
                  <div key={displayId} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="text-xs font-semibold text-gray-600">No {displayId}</div>
                          <div className="text-sm text-gray-500">Input: <span className="font-medium text-gray-700">{inputDisplay}</span></div>
                        </div>

                        <div className="mt-2 text-sm text-gray-500">Output: <span className="ml-1 text-gray-700">{outputDisplay}</span></div>

                        {Array.isArray(tc.inHiddenVal) && tc.inHiddenVal.length > 0 && (
                          <div className="mt-1 text-xs text-gray-400">Hidden Inputs: {tc.inHiddenVal.join(", ")}</div>
                        )}
                      </div>

                      <div className="flex gap-4">
                        <div className="w-16 text-center">
                          <div className="text-xs text-gray-400">Score</div>
                          <div className="mt-2 text-sm font-semibold text-blue-600">{tc.score ?? 0}</div>
                        </div>

                        <div className="w-24 text-right">
                          <div className="text-xs text-gray-400">Status</div>
                          <div className="mt-2">
                            {(testResults[displayId] ?? []).length === 0 ? (
                              <div className="inline-block text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 border border-gray-200">Not run</div>
                            ) : (
                              (() => {
                                const items = testResults[displayId] ?? [];
                                // Get the first message which should be the status (PASS/FAIL/etc)
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
                    </div>

                    {/* expanded messages under card */}
                    <div className="mt-3 border-t border-gray-200 pt-3">
                      <div className="flex flex-col">
                        {(testResults[displayId] ?? []).map((r, idx) => (
                          <div key={idx} className="mb-2">
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
                className={`text-sm px-6 py-2 rounded-full ${runningTests ? "bg-gray-200 text-gray-600 cursor-not-allowed " : "bg-yellow-500 text-white hover:bg-yellow-600"}`}>
                {runningTests ? "Testing..." : "Test"}
              </button>

              <button className="mt-0 bg-blue-900 text-white text-sm px-6 py-2 rounded-full hover:bg-blue-800 transition-colors">Submit</button>
            </div>
          </div>
        </div>
      )
      }
    </div >
  );
}
