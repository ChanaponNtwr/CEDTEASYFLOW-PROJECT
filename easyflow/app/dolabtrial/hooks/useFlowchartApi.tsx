// File: app/flowchart/hooks/useFlowchartApi.tsx

import { useState, useEffect } from "react";
import { Node, Edge } from "@xyflow/react";
import { convertBackendFlowchart } from "../utils/backendConverter";
import { apiGetTrialFlowchart } from "@/app/service/FlowchartService";

type UseFlowchartApiProps = {
  flowchartId: string;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
};

export const useFlowchartApi = ({ flowchartId, setNodes, setEdges }: UseFlowchartApiProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!flowchartId) {
      console.warn("❌ useFlowchartApi: No flowchartId provided");
      return;
    }

    let cancelled = false;

    const loadFlowchart = async () => {
      console.log("🚀 Fetching flowchart for trial:", flowchartId); // LOG 1
      setLoading(true);
      setError(null);
      try {
        const payload = await apiGetTrialFlowchart(flowchartId);

        if (cancelled) return;

        console.log("📦 Payload received:", payload); // LOG 2

        // --- แก้ไข: ลบเงื่อนไขที่ return ทิ้งออกให้หมด ---
        // เราจะส่ง payload ไปให้ converter จัดการต่อเสมอ แม้ว่า flowchart จะเป็น null

        const converted = convertBackendFlowchart(payload || {});
        console.log("✅ Converted Data:", converted); // LOG 3

        if (converted.nodes.length === 0) {
          console.warn("⚠️ Converted nodes are empty! Check convertBackendFlowchart logic.");
        }

        setNodes(converted.nodes);
        setEdges(converted.edges);

      } catch (err: any) {
        console.error("❌ Error loading flowchart:", err);
        setError(err?.message ?? "Error fetching flowchart");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFlowchart();

    return () => {
      cancelled = true;
    };
  }, [flowchartId, setNodes, setEdges]);

  return { loading, error };
};