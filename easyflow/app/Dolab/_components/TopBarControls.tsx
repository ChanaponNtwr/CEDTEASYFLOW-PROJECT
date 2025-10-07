'use client';

import { useEffect, useState } from 'react';
import { FaPlay, FaStepForward, FaUndo, FaRedo } from 'react-icons/fa';
import { executeStepNode, apiGetFlowchart } from '@/app/service/FlowchartService';

type Variable = {
  name: string;
  value: any;
};

type NodeResult = {
  id: string;
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
  nextNodeId?: string;
  nextNodeType?: string;
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
}

export default function TopBarControls({
  flowchartId = 8,
  initialVariables = null,
  forceAdvanceBP = true,
}: TopBarControlsProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputValue, setInputValue] = useState<any>('');
  const [isLoading, setIsLoading] = useState(false);
  const [variablesSent, setVariablesSent] = useState(false);
  const [lastResponse, setLastResponse] = useState<ExecuteResponse | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fetchedVariables, setFetchedVariables] = useState<Variable[] | null>(null);
  const [fetchingVars, setFetchingVars] = useState(false);

  // Node id ที่ modal จะส่งค่าเข้า (เช่น 'n4' หรือ 'n5')
  const [inputNodeId, setInputNodeId] = useState<string | null>(null);
  // ชื่อตัวแปรที่ node เป้าหมายต้องการรับ (เช่น 'b')
  const [inputVarName, setInputVarName] = useState<string | null>(null);

  const togglePopup = () => setShowPopup((v) => !v);

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
          (n) => n?.type === 'DC' || n?.type === 'DECLARE' || n?.type === 'VAR'
        );

        const vars: Variable[] = varNodes.flatMap((n) => {
          if (Array.isArray(n.variables) && n.variables.length > 0) {
            return n.variables.map((v: any) => ({ name: v.name, value: v.value ?? 0 }));
          }
          const d = n?.data ?? {};
          const name = d?.name ?? d?.variable ?? n?.label ?? `var_${n?.id ?? 'unknown'}`;
          const value = d?.value ?? 0;
          return [{ name, value }];
        });

        if (mounted) setFetchedVariables(vars);
      } catch (err) {
        console.error('failed to fetch flowchart for variables', err);
        const message = err instanceof Error ? err.message : String(err);
        setErrorMsg((prev) => prev ?? `fetch vars: ${message}`);
        if (mounted) setFetchedVariables([]);
      } finally {
        if (mounted) setFetchingVars(false);
      }
    };

    fetchVars();
    return () => { mounted = false; };
  }, [flowchartId, initialVariables]);

  // --- Helper: resolve first variable name for a given nodeId ---
  // Try in order: lastResponse.result.node (if matches), lastResponse.result.context.variables,
  // then fetch flowchart and find node by id.
  const getFirstVarNameForNode = async (nodeId?: string | null): Promise<string | undefined> => {
    if (!nodeId) return undefined;

    // 1) If lastResponse included the node details and matches target id
    const nodeFromLast = lastResponse?.result?.node;
    if (nodeFromLast && String(nodeFromLast.id) === String(nodeId)) {
      const v = nodeFromLast.variables?.[0]?.name;
      if (v) return v;
      // try data fields
      const d = nodeFromLast.data ?? {};
      const name = d?.name ?? d?.variable ?? nodeFromLast?.label;
      if (name) return name;
    }

    // 2) maybe the context contains variables that correspond to upcoming node
    const maybeVars = lastResponse?.result?.context?.variables;
    if (Array.isArray(maybeVars) && maybeVars.length > 0) {
      return maybeVars[0].name;
    }

    // 3) fallback: fetch flowchart and find node
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
      console.warn('getFirstVarNameForNode: failed to fetch flowchart', err);
    }
    return undefined;
  };

  // --- Step execution (▶️) ---
  const handleStep = async () => {
    if (isLoading || done) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const resolvedInitialVars = initialVariables ?? fetchedVariables ?? [];
      const varsToSend = variablesSent ? [] : resolvedInitialVars;

      const resp = (await executeStepNode(flowchartId, varsToSend, forceAdvanceBP)) as ExecuteResponse;

      console.log('executeStepNode response:', resp);
      setLastResponse(resp);
      setVariablesSent(true);
      setStepCount((s) => s + 1);
      setDone(Boolean(resp?.result?.done ?? resp?.done ?? false));

      // Resolve next node / input behavior
      const nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
      const nextId = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;

      if (nextType === 'IN' || nextType === 'INPUT') {
        // Resolve the variable name for the next node, then open modal
        const resolvedVarName = await getFirstVarNameForNode(nextId ?? null);
        setInputNodeId(nextId ?? null);
        setInputVarName(resolvedVarName ?? null);
        // open modal on next tick
        setTimeout(() => setShowInputModal(true), 0);
      } else {
        // not expecting input: clear modal state
        setInputNodeId(null);
        setInputVarName(null);
        setShowInputModal(false);
      }

      if (resp?.result?.done ?? resp?.done ?? false) {
        resetFlowchart();
      }
    } catch (err) {
      console.error('execute step error', err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Submit input from modal (💬) ---
  // UPDATED: ส่งเฉพาะตัวแปรตัวเดียวเป็น payload (เช่น [{ name: 'a', value: 1 }])
  const handleSubmitInput = async () => {
    if (!lastResponse) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // Base list of vars to read names from: prefer node variables if present, else context variables, else fetchedVariables
      let currentVars: Variable[] =
        lastResponse.result?.node?.variables ??
        lastResponse.result?.context?.variables ??
        fetchedVariables ??
        [];

      if (currentVars.length === 0) {
        throw new Error('No variable available to input.');
      }

      // target node id (explicit state or fallback from last response)
      const targetNodeId = inputNodeId ?? lastResponse?.nextNodeId ?? null;

      // Determine which variable name to update:
      // prefer inputVarName (already resolved when modal opened), else try helper as fallback
      const resolvedVarName =
        inputVarName ?? (await getFirstVarNameForNode(targetNodeId)) ?? currentVars[0].name;

      // *** Build minimal payload: only the single variable object ***
      const singleVarPayload: Variable[] = [{ name: resolvedVarName, value: inputValue }];

      console.log('📤 Sending minimal input payload for nodeId=', targetNodeId, singleVarPayload);

      // Send to backend; pass action 'input' and target node id (pattern consistent with your reset call)
      const resp = await executeStepNode(
        flowchartId,
        singleVarPayload,      // <-- only this single var is sent
        forceAdvanceBP,
        'input',
        targetNodeId ?? undefined
      );

      setLastResponse(resp);
      setStepCount((s) => s + 1);
      setVariablesSent(true);
      setDone(Boolean(resp?.result?.done ?? resp?.done ?? false));
      setShowInputModal(false);
      setInputValue('');
      setInputNodeId(null);
      setInputVarName(null);

      // If the next node is again input, prepare next modal
      const nextType = resp?.nextNodeType?.toString?.().trim?.()?.toUpperCase?.();
      const nextId = resp?.nextNodeId ?? resp?.result?.node?.id ?? null;
      if (nextType === 'IN' || nextType === 'INPUT') {
        const nextVarName = await getFirstVarNameForNode(nextId ?? null);
        setInputNodeId(nextId ?? null);
        setInputVarName(nextVarName ?? null);
        setTimeout(() => setShowInputModal(true), 0);
      }

      if (resp?.result?.done ?? resp?.done ?? false) resetFlowchart();
    } catch (err) {
      console.error('submit input error', err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Reset flowchart ---
  const resetFlowchart = async () => {
    try {
      await executeStepNode(flowchartId, [], true, 'reset');
      setLastResponse(null);
      setStepCount(0);
      setDone(false);
      setVariablesSent(false);
      setInputNodeId(null);
      setInputVarName(null);
      setShowInputModal(false);
    } catch (err) {
      console.error('reset error', err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    }
  };

  const currentNode: NodeResult | null = lastResponse?.result?.node ?? null;
  const outputs: any[] =
    lastResponse?.result?.context?.output ??
    lastResponse?.context?.output ??
    [];

  const previewVariables: Variable[] = (() => {
    const fromResult = lastResponse?.result?.context?.variables;
    if (Array.isArray(fromResult) && fromResult.length > 0) return fromResult;
    if (Array.isArray(fetchedVariables) && fetchedVariables.length > 0)
      return fetchedVariables;
    if (Array.isArray(initialVariables) && initialVariables.length > 0)
      return initialVariables;
    return [];
  })();

  return (
    <div className="absolute z-1 pt-4">
      {/* Control bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md border border-gray-200 w-fit hover:shadow-lg transition-shadow duration-200">
        <button
          title="Run"
          className="text-green-600 hover:text-green-700 text-lg p-2 rounded-full hover:bg-green-100 transition-colors"
        >
          <FaPlay />
        </button>
        <button
          onClick={handleStep}
          disabled={isLoading || done}
          title={done ? 'Finished' : 'Step'}
          className={`text-yellow-600 text-lg p-2 rounded-full transition-colors ${
            isLoading
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:text-yellow-700 hover:bg-yellow-100'
          } ${done ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <span className={`${isLoading ? 'animate-pulse' : ''}`}>
            <FaStepForward />
          </span>
        </button>
        <button className="text-gray-600 hover:text-gray-700 text-lg p-2 rounded-full hover:bg-gray-100 transition-colors">
          <FaUndo />
        </button>
        <button className="text-gray-600 hover:text-gray-700 text-lg p-2 rounded-full hover:bg-gray-100 transition-colors">
          <FaRedo />
        </button>
        <span
          onClick={() => setShowPopup((v) => !v)}
          className="ml-2 px-3 py-1 bg-blue-200 text-blue-800 text-sm font-semibold rounded-lg cursor-pointer hover:bg-blue-300 transition-colors select-none"
        >
          Problem solving
        </span>
      </div>

      {/* Information */}
      <div className="mt-2 ml-2 bg-white rounded-md shadow-sm border border-gray-100 p-3 w-[360px] text-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-600">
            Step: <strong className="text-gray-800">{stepCount}</strong>
          </div>
          <div
            className={`text-xs font-semibold ${
              done ? 'text-green-700' : 'text-gray-600'
            }`}
          >
            {done ? 'Done' : isLoading ? 'Running...' : 'Paused'}
          </div>
        </div>

        <div className="text-xs text-gray-600 mb-1">Current node:</div>
        <div className="mb-2 text-sm text-gray-800">
          {currentNode ? (
            <>
              <div><b>ID:</b> {currentNode.id}</div>
              <div><b>Type:</b> {currentNode.type}</div>
              <div><b>Label:</b> {currentNode.label}</div>
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
                <li key={i}>{String(o)}</li>
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
      </div>

      {/* Input Modal */}
      {showInputModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-opacity-100 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80">
            <div className="mb-4 text-gray-700">
              กรอกค่า {inputVarName ?? lastResponse?.result?.node?.variables?.[0]?.name ?? 'input'}:
              <div className="text-xs text-gray-400">จะถูกเก็บที่ node: {inputNodeId ?? '—'}</div>
            </div>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-2 py-1 mb-4"
            />
            <button
              onClick={handleSubmitInput}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
