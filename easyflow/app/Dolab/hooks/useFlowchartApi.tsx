// File: app/flowchart/hooks/useFlowchartApi.ts

// Hook นี้รับผิดชอบการดึงข้อมูล Flowchart จาก API และจัดการ State ที่เกี่ยวกับ Loading/Error

import { useState, useEffect } from "react";
import axios from "axios";
import { Node, Edge } from "@xyflow/react";
import { convertBackendFlowchart } from "../utils/backendConverter";

type UseFlowchartApiProps = {
  flowchartId: string;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
};

export const useFlowchartApi = ({ flowchartId, setNodes, setEdges }: UseFlowchartApiProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const idToFetch = flowchartId ?? 9;
    let cancelled = false;

    const loadFlowchart = async () => {
      setLoading(true);
      setError(null);
      try {
        const BASE_URL = "http://localhost:8080";
        const resp = await axios.get(`${BASE_URL}/flowchart/${idToFetch}`);
        const payload = resp.data;

        if (cancelled) return;

        if (!payload || !payload.flowchart) {
          setError("No flowchart returned from API");
          setLoading(false);
          return;
        }

        const converted = convertBackendFlowchart(payload);
        setNodes(converted.nodes);
        setEdges(converted.edges);
        console.log("Loaded flowchart payload:", payload);
      } catch (err: any) {
        console.error("Error loading flowchart:", err);
        setError(err?.message ?? "Error fetching flowchart");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFlowchart();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowchartId, setNodes, setEdges]);

  return { loading, error };
};