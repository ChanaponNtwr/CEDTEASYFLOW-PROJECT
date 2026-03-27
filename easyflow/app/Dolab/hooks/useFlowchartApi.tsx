import { useState, useEffect } from "react";
import { apiGetFlowchart } from "@/app/service/FlowchartService";
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
    // DEBUG: เช็คว่า ID เข้ามาใน Hook หรือไม่
    console.log(`🪝 [useFlowchartApi] Hook triggered with ID: ${flowchartId} (type: ${typeof flowchartId})`);

    if (!flowchartId) {
      console.warn("⚠️ [useFlowchartApi] No flowchartId provided. Skipping fetch.");
      return;
    }

    let cancelled = false;

    const loadFlowchart = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`📡 [useFlowchartApi] Calling API for ID: ${flowchartId}`);
        const payload = await apiGetFlowchart(flowchartId);

        if (cancelled) return;

        //  DEBUG: ดูข้อมูลดิบที่ได้จาก API
        console.log("📦 [useFlowchartApi] API Response:", payload);

        // ส่งเข้า Converter
        const converted = convertBackendFlowchart(payload);

        // DEBUG: ดูผลลัพธ์หลังแปลงเสร็จ
        console.log(`✅ [useFlowchartApi] Converted Nodes: ${converted.nodes.length}, Edges: ${converted.edges.length}`);

        setNodes(converted.nodes);
        setEdges(converted.edges);

      } catch (err: any) {
        console.error("❌ [useFlowchartApi] Error:", err);
        if (!cancelled) {
          // ถ้า Error ให้สร้าง Default Start/End
          console.log("⚠️ [useFlowchartApi] Falling back to default nodes due to error.");
          const defaultFlow = convertBackendFlowchart(null);
          setNodes(defaultFlow.nodes);
          setEdges(defaultFlow.edges);
          setError(err?.message ?? "Error fetching flowchart");
        }
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