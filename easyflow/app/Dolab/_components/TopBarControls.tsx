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

  const togglePopup = () => setShowPopup((v) => !v);

  // 🧩 ดึง variables จาก node ที่ type เป็น DECLARE / VAR / DC
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

        const vars: Variable[] = varNodes.map((n) => {
          const d = n?.data ?? {};
          const name = d?.name ?? d?.variable ?? n?.label ?? `var_${n?.id ?? 'unknown'}`;
          const value = d?.value ?? 0;
          return { name, value };
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
    return () => {
      mounted = false;
    };
  }, [flowchartId, initialVariables]);

  // ▶️ Step ทีละขั้น
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

      const nextType = resp?.nextNodeType?.trim()?.toUpperCase();
      if (nextType === 'IN' || nextType === 'INPUT') {
        setTimeout(() => setShowInputModal(true), 0);
      }

      if (resp?.result?.done ?? resp?.done ?? false) resetFlowchart();
    } catch (err) {
      console.error('execute step error', err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  // 💬 เมื่อถึง Node Input
  const handleSubmitInput = async () => {
    if (!lastResponse) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const currentVars: Variable[] =
        lastResponse.result?.context?.variables ?? fetchedVariables ?? [];

      const inputVarName = lastResponse.result?.node?.data?.name ?? 'input';

      const varsWithInput = [
        ...currentVars.map((v) => ({ name: v.name, value: v.value })),
        { name: inputVarName, value: inputValue },
      ];

      console.log('📤 Sending input:', varsWithInput);

      const resp = await executeStepNode(flowchartId, varsWithInput, forceAdvanceBP);
      setLastResponse(resp);
      setStepCount((s) => s + 1);
      setVariablesSent(true);
      setDone(Boolean(resp?.result?.done ?? resp?.done ?? false));
      setShowInputModal(false);
      setInputValue('');

      const nextType = resp?.nextNodeType?.trim()?.toUpperCase();
      if (nextType === 'IN' || nextType === 'INPUT') {
        setTimeout(() => setShowInputModal(true), 0);
      }

      if (resp?.result?.done ?? resp?.done ?? false) resetFlowchart();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔁 Reset เมื่อ done
  const resetFlowchart = async () => {
    try {
      await executeStepNode(flowchartId, [], true, 'reset');
      setLastResponse(null);
      setStepCount(0);
      setDone(false);
      setVariablesSent(false);
    } catch (err) {
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
              กรอกค่า {lastResponse?.result?.node?.data?.name ?? 'input'}:
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
