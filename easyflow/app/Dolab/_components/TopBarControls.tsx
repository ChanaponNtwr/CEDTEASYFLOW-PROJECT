// TopBarControls.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { FaPlay, FaStepForward, FaStop } from "react-icons/fa";
import {
  executeStepNode,
  apiGetFlowchart,
  apiResetFlowchart,
  apiRunTestcaseFromFlowchart,
  apiGetTestcases,
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
  flowchartId?: number | string | null;
  initialVariables?: Variable[] | null;
  forceAdvanceBP?: boolean;
  onHighlightNode?: (nodeId: string | number | null) => void;
  autoPlayInputs?: boolean;
}

export default function TopBarControls({
  flowchartId,
  initialVariables = null,
  forceAdvanceBP = true,
  onHighlightNode,
  autoPlayInputs = false,
}: TopBarControlsProps) {
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

  const outputResumeRef = useRef<(() => void) | null>(null);
  const [pendingHighlightAfterOutput, setPendingHighlightAfterOutput] = useState<string | number | null>(null);

  const runAllActiveRef = useRef(false);
  const runAllWaitingForInputRef = useRef<(() => void) | null>(null);

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
        console.log("[TopBarControls] fetchVars - apiGetFlowchart resp:", resp);

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
      console.log("[TopBarControls] getFirstVarNameForNode - flowResp:", flowResp);
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
        // set pending highlight and wait for user to press Acknowledge
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
          resp = (await executeStepNode(flowchartId ?? null, singleVarPayload, forceAdvanceBP)) as ExecuteResponse;
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
          if (flowchartId) await apiResetFlowchart(flowchartId);
        } catch (err) {
          console.warn("reset without advance failed (runAll)", err);
          try {
            await executeStepNode(flowchartId ?? null, [], false);
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

        resp = (await executeStepNode(flowchartId ?? null, [], forceAdvanceBP)) as ExecuteResponse;
        setLastResponse(resp);
        setStepCount((s) => s + 1);
        setVariablesSent(true);

        const backendDoneLoop = Boolean(resp?.result?.done ?? resp?.done ?? false);
        let nextTypeLoop = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
        const inferredDoneLoop = isEndType(nextTypeLoop);
        const finalDoneLoop = backendDoneLoop || inferredDoneLoop;

        let nextIdRawLoop = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
        let nextIdLoop = nextIdRawLoop !== null && typeof nextIdRawLoop !== "undefined" ? String(nextIdRawLoop) : null;

        if (handleResponseOutputs(resp, autoPlayInputs)) {
          setPendingHighlightAfterOutput(nextIdLoop);
          if (!autoPlayInputs) {
            await new Promise<void>((resolve) => (outputResumeRef.current = resolve));
            outputResumeRef.current = null;
            setPendingHighlightAfterOutput(null);
            if (nextIdLoop) safeHighlight(nextIdLoop);
          } else {
            setPendingHighlightAfterOutput(null);
            if (nextIdLoop) safeHighlight(nextIdLoop);
          }
        } else {
          const rawLoopId = resp?.result?.node?.id ?? resp?.nextNodeId ?? null;
          const loopNodeId = rawLoopId !== null && typeof rawLoopId !== "undefined" ? String(rawLoopId) : null;
          safeHighlight(loopNodeId);
        }

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
        console.warn("No variable name found for input. lastResponse:", lastResponse, "fetchedVariables:", fetchedVariables, "targetNodeId:", targetNodeId);
        setErrorMsg("ไม่พบชื่อตัวแปรสำหรับการป้อนข้อมูล — โปรดตรวจสอบ response จาก backend หรือ node ใน flowchart ว่ามี data.variable / data.name หรือไม่");
        setIsLoading(false);
        return;
      }

      console.log("Submitting input:", { targetNodeId, resolvedVarName, inputValue });

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
      if (hadOutputs) {
        const nextIdRaw = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
        const nextId = nextIdRaw !== null && typeof nextIdRaw !== "undefined" ? String(nextIdRaw) : null;
        setPendingHighlightAfterOutput(nextId);
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
  // Test UI state & handler (ปรับปรุงการดึงโจทย์ + testcase แบบ dynamic ตาม flowchartId)
  // -------------------
  type TestLevel = "error" | "warning" | "info" | "success";
  const [testResults, setTestResults] = useState<Record<string, { level: TestLevel; text: string }[]>>({});
  const [runningTests, setRunningTests] = useState(false);
  const [labTestcases, setLabTestcases] = useState<any[]>([]);
  const [problemDetail, setProblemDetail] = useState<{ title?: string; description?: string } | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(false);
  const [loadingTestcases, setLoadingTestcases] = useState(false);

  // helper: deep search for possible lab/assignment id keys
  const findLabLikeId = (obj: any): number | string | null => {
    const seen = new WeakSet();
    const queue: any[] = [obj];

    while (queue.length) {
      const cur = queue.shift();
      if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
      seen.add(cur);

      for (const key of Object.keys(cur)) {
        const val = cur[key];

        // direct keys we care about
        if (/(lab|assignment).?id$/i.test(key) && (typeof val === "number" || (typeof val === "string" && /^\d+$/.test(val)))) {
          return typeof val === "string" ? Number(val) : val;
        }

        // if container named lab or assignment with id inside
        if (/^lab$/i.test(key) && val && (val.id || val.labId || val.lab_id)) {
          const candidate = val.id ?? val.labId ?? val.lab_id;
          if (typeof candidate === "number" || (typeof candidate === "string" && /^\d+$/.test(candidate))) {
            return typeof candidate === "string" ? Number(candidate) : candidate;
          }
        }
        if (/^assignment$/i.test(key) && val && (val.id || val.assignmentId || val.assignment_id)) {
          const candidate = val.id ?? val.assignmentId ?? val.assignment_id;
          if (typeof candidate === "number" || (typeof candidate === "string" && /^\d+$/.test(candidate))) {
            return typeof candidate === "string" ? Number(candidate) : candidate;
          }
        }

        if (typeof val === "object") queue.push(val);
      }
    }
    return null;
  };

  // ดึงรายละเอียดโจทย์และ Testcases ตาม flowchartId (robust mapping)
  useEffect(() => {
    if (!flowchartId) {
      setProblemDetail(null);
      setLabTestcases([]);
      return;
    }

    let mounted = true;
    const loadTestcases = async () => {
      setLoadingProblem(true);
      setLoadingTestcases(true);
      

      try {
        // 1. ดึงข้อมูล Flowchart (เก็บทั้ง fullResp และ nested flowchart ถ้ามี)
        const fullResp = await apiGetFlowchart(flowchartId);
        const nestedFlow = fullResp?.flowchart ?? null;

        // debug log (ช่วยดูว่าข้อมูลอยู่ตรงไหน)
        console.log("loadTestcases: flowResp (full):", fullResp);
        console.log("loadTestcases: nestedFlow (flowchart):", nestedFlow);
        

        // 2. หา ID ของ Lab หรือ Assignment (รองรับหลายฟอร์แมต และทั้ง top-level / nested)
        let targetLabId =
          fullResp?.labId ??
          fullResp?.lab_id ??
          fullResp?.assignmentId ??
          fullResp?.assignment_id ??
          fullResp?.assignment?.id ??
          fullResp?.lab?.id ??
          fullResp?.session?.labId ??
          fullResp?.session?.lab_id ??
          nestedFlow?.labId ??
          nestedFlow?.lab_id ??
          nestedFlow?.assignmentId ??
          nestedFlow?.assignment_id ??
          nestedFlow?.assignment?.id ??
          nestedFlow?.lab?.id ??
          nestedFlow?.session?.labId ??
          fullResp?.raw?.labId ??
          fullResp?.raw?.lab_id ??
          nestedFlow?.raw?.labId ??
          null;
          console.log("Resolved targetLabId for testcases:", targetLabId);


        // If still null, do a deeper scan
        if (!targetLabId) {
          const found = findLabLikeId(fullResp) ?? findLabLikeId(nestedFlow);
          if (found) targetLabId = found;
        }

        // 3. เซ็ตข้อมูลโจทย์ (Title/Description) จากทั้งสองที่
        const title =
          nestedFlow?.assignment?.title ??
          nestedFlow?.lab?.title ??
          nestedFlow?.title ??
          nestedFlow?.name ??
          fullResp?.assignment?.title ??
          fullResp?.lab?.title ??
          fullResp?.title ??
          fullResp?.name ??
          fullResp?.meta?.title ??
          null;
        const desc =
          nestedFlow?.assignment?.description ??
          nestedFlow?.assignment?.detail ??
          nestedFlow?.lab?.description ??
          nestedFlow?.lab?.detail ??
          nestedFlow?.description ??
          nestedFlow?.meta?.description ??
          fullResp?.assignment?.description ??
          fullResp?.lab?.description ??
          fullResp?.description ??
          fullResp?.meta?.description ??
          null;

        if (mounted) setProblemDetail({ title: title ?? "โจทย์ Lab", description: desc ?? "" });

        // 4. ถ้ามี ID ให้ไปดึง Testcases (apiGetTestcases อาจ accept labId/assignmentId)
        if (targetLabId) {
          try {
            // ensure numeric if looks like number
            const normalizedLabId =
              typeof targetLabId === "string" && /^\d+$/.test(String(targetLabId)) ? Number(String(targetLabId)) : targetLabId;
            console.log("Calling apiGetTestcases with id:", normalizedLabId);
            const resp = await apiGetTestcases(normalizedLabId);
            console.log("apiGetTestcases response:", resp);
            let tcs: any[] = [];

            if (Array.isArray(resp)) tcs = resp;
            else if (Array.isArray(resp?.data)) tcs = resp.data;
            else if (Array.isArray(resp?.testcases)) tcs = resp.testcases;
            else if (Array.isArray(resp?.result)) tcs = resp.result;
            else if (Array.isArray(resp?.items)) tcs = resp.items;
            else if (resp?.data?.testcases && Array.isArray(resp.data.testcases)) tcs = resp.data.testcases;
            // sometimes nested under raw
            else if (resp?.raw?.testcases && Array.isArray(resp.raw.testcases)) tcs = resp.raw.testcases;

            // final fallback: try to find first array-valued prop
            if (!Array.isArray(tcs) && typeof resp === "object" && resp !== null) {
              const arrProp = Object.keys(resp).find((k) => Array.isArray((resp as any)[k]));
              if (arrProp) tcs = (resp as any)[arrProp];
            }

            if (!Array.isArray(tcs)) tcs = [];

            if (mounted) setLabTestcases(tcs);
          } catch (err) {
            console.warn("apiGetTestcases failed", err);
            if (mounted) setLabTestcases([]);
          }
        } else {
          // ถ้าไม่เจอ ID: ลองดึง testcases จาก flowResp โดยตรง (บางระบบ embed อยู่)
          const embeddedTcs =
            nestedFlow?.testcases ??
            nestedFlow?.lab?.testcases ??
            nestedFlow?.assignment?.testcases ??
            fullResp?.testcases ??
            fullResp?.data?.testcases ??
            fullResp?.raw?.testcases ??
            [];
          if (Array.isArray(embeddedTcs)) {
            if (mounted) setLabTestcases(embeddedTcs);
          } else {
            if (mounted) setLabTestcases([]);
          }
        }
      } catch (err) {
        console.warn("Failed to load data", err);
        if (mounted) {
          setProblemDetail({ title: "ไม่สามารถโหลดโจทย์", description: "" });
          setLabTestcases([]);
        }
      } finally {
        if (mounted) {
          setLoadingProblem(false);
          setLoadingTestcases(false);
        }
      }
    };

    loadTestcases();
    return () => {
      mounted = false;
    };
  }, [flowchartId]);

  // --- Run tests handler (แทนของเดิมด้วยอันนี้) ---
const handleRunTests = async () => {
  if (!flowchartId) return;
  setRunningTests(true);
  setTestResults({});

  try {
    const data = await apiRunTestcaseFromFlowchart(flowchartId);
    console.log("apiRunTestcaseFromFlowchart raw response:", data);

    // พยายามหา rawResults ในที่ต่าง ๆ
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

    // สร้าง mapping ของผลทดสอบ (เหมือนเดิม)
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

      let level: TestLevel = "info";
      if (["PASS", "PASSED", "OK", "SUCCESS"].includes(status)) level = "success";
      else if (["FAIL", "FAILED", "ERROR", "INPUT_MISSING", "TIMEOUT", "WRONG"].includes(status)) level = "error";
      else if (["WARN", "WARNING"].includes(status)) level = "warning";

      const messages: { level: TestLevel; text: string }[] = [];
      messages.push({ level, text: `${status}` });

      if (errorMessage) {
        messages.push({ level: "error", text: String(errorMessage) });
      }

      if (actual !== null && typeof actual !== "undefined") {
        try {
          const aStr = Array.isArray(actual) ? actual.join(", ") : String(actual);
          messages.push({ level: "info", text: `Actual: ${aStr}` });
        } catch {
          messages.push({ level: "info", text: `Actual: ${String(actual)}` });
        }
      }

      // alternate keys
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

    // ถ้า our labTestcases ยังว่างอยู่ ให้สร้างรายการแบบย่อจากผลทดสอบ
    if ((!labTestcases || labTestcases.length === 0) && Object.keys(newResults).length > 0) {
      const synthetic: any[] = [];
      const keys = Array.from(new Set(Object.keys(newResults))).sort((a, b) => {
        // พยายาม sort ตัวเลขก่อน ถ้าเป็นตัวเลข
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });

      keys.forEach((k) => {
        // หาข้อความ Actual/Expected ใน newResults[k] (ถ้ามี)
        const msgs = newResults[k];
        const actualMsg = msgs.find((m) => m.text?.startsWith("Actual:"))?.text?.replace(/^Actual:\s*/, "") ?? null;
        // สร้าง testcase แบบย่อ
        synthetic.push({
          id: k,
          testcaseId: k,
          inputVal: null,
          outputVal: actualMsg ?? null,
          score: 0,
          // keep original object for debugging if needed
          __generatedFromResults: true,
        });
      });

      console.log("Generated synthetic labTestcases from results:", synthetic);
      setLabTestcases(synthetic);
    }

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

  // --- Render UI (เหมือนเดิม) ---
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
            <div className="text-gray-800 text-sm font-medium font-['Sarabun'] leading-snug mb-4 whitespace-pre-wrap">
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

                // --- find matching testResults using multiple possible keys ---
                const possibleKeys = [
                  displayId,
                  String(tc.id ?? ""),
                  String(tc.testcaseId ?? ""),
                  String(tc.testcase_id ?? ""),
                  String(tc.tcId ?? ""),
                  String(index + 1),
                ].filter((k) => k !== ""); // remove empty strings

                let matchedKey: string | null = null;
                for (const k of possibleKeys) {
                  if (k && Array.isArray(testResults[k]) && testResults[k].length > 0) {
                    matchedKey = k;
                    break;
                  }
                }

                const statusItems = matchedKey ? testResults[matchedKey] : [];

                return (
                  <div key={displayId + "-" + index} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
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
                            {statusItems.length === 0 ? (
                              <div className="inline-block text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 border border-gray-200">Not run</div>
                            ) : (
                              (() => {
                                const statusMsg = statusItems[0];
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
                        {(statusItems ?? []).map((r, idx) => (
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
                disabled={runningTests || !flowchartId}
                className={`text-sm px-6 py-2 rounded-full ${runningTests ? "bg-gray-200 text-gray-600 cursor-not-allowed " : "bg-yellow-500 text-white hover:bg-yellow-600"}`}>
                {runningTests ? "Testing..." : "Test"}
              </button>

              <button className="mt-0 bg-blue-900 text-white text-sm px-6 py-2 rounded-full hover:bg-blue-800 transition-colors">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
