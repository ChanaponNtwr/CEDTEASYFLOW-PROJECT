// FlowchartService.js (แก้แล้ว)
import axios from "axios";

const BASE_URL = "http://localhost:8080"; // <<-- เอา /flowchart ออก

export const apiPostFlowchart = async (data) => {
  try {
    const response = await axios.post(`${BASE_URL}/flowchart/create`, data);
    return response.data;
  } catch (error) {
    console.error("Error posting flowchart:", error);
    throw error;
  }
};

export const apiGetFlowchart = async (id) => {
  if (!id) {
    throw new Error("apiGetFlowchart: missing flowchart id");
  }
  try {
    const response = await axios.get(`${BASE_URL}/flowchart/${encodeURIComponent(id)}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching flowchart:", error);
    throw error;
  }
};

export const insertNode = async (flowchartId, edgeId, node) => {
  if (!flowchartId) {
    throw new Error("insertNode: missing flowchartId");
  }
  try {
    // ถ้า backend ของคุณรับเป็น POST /flowchart/insert-node กับ payload ที่มี flowchartId นี่ก็โอเค,
    // แต่ผมใส่ path เป็น /flowchart/insert-node และยังส่ง payload เดิมให้เหมือนก่อนหน้า
    const response = await axios.post(`${BASE_URL}/flowchart/insert-node`, {
      flowchartId,
      edgeId,
      node,
    });
    return response.data;
  } catch (err) {
    console.error("insertNode error:", err);
    throw err;
  }
};


export const deleteNode = async (flowchartId, nodeId) => {
  try {
    const resp = await axios.delete(`${BASE_URL}/flowchart/${flowchartId}/node/${nodeId}`
    );
    return resp.data; // { ok: true, message: "...", diffs: {...} }
  } catch (error) {
    console.error("Error deleting node:", error);
    throw error;
  }
};


export const editNode = async (flowchartId, nodeId, updateData) => {
  if (!flowchartId || !nodeId) {
    throw new Error("editNode: missing flowchartId or nodeId");
  }
  try {
    const resp = await axios.put(`${BASE_URL}/flowchart/${flowchartId}/node/${nodeId}`,
      updateData
    );
    return resp.data; // { ok: true, message: "...", flowchartId: "...", diffs: {...} }
  } catch (error) {
    console.error("Error editing node:", error);
    throw error;
  }
};


export const executeStepNode = async (flowchartId, variables = [], forceAdvanceBP = false) => {
  if (!flowchartId) {
    throw new Error("executeStepNode: missing flowchartId");
  }

  try {
    const payload = {
      flowchartId,
      action: "step", // สั่งให้ execute ทีละ step
      variables,
      forceAdvanceBP,
    };

    const response = await axios.post(`${BASE_URL}/flowchart/execute`, payload);
    return response.data; // คาดว่า backend จะส่งข้อมูลสถานะ flowchart กลับมา เช่น node ปัจจุบัน
  } catch (error) {
    console.error("Error executing step node:", error);
    throw error;
  }
};
