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


export const apiResetFlowchart = async (flowchartId) => {
  if (!flowchartId) {
    throw new Error("apiResetFlowchart: missing flowchartId");
  }

  try {
    const payload = {
      flowchartId,
      action: "reset",
    };

    const response = await axios.post(`${BASE_URL}/flowchart/execute`, payload);
    return response.data;
  } catch (error) {
    console.error("Error resetting flowchart:", error);
    throw error;
  }
};

export const apiCreateTestcase = async (labId, tcPayload) => {
  try {
    const resp = await axios.post(`${BASE_URL}/api/testcase/lab/${encodeURIComponent(labId)}/create`, tcPayload);
    return resp.data;
  } catch (err) {
    console.error("apiCreateTestcase error:", err);
    throw err;
  }
};

export const apiGetTestcases = async (labId) => {
  try {
    const resp = await axios.get(`${BASE_URL}/api/testcase/lab/${encodeURIComponent(labId)}/list`);
    return resp.data;
  } catch (err) {
    console.error("apiGetTestcases error:", err);
    throw err;
  }
};

export const apiUpdateTestcase = async (testcaseId, data) => {
  try {
    const resp = await axios.put(`${BASE_URL}/api/testcase/${testcaseId}/update`, data);
    return resp.data;
  } catch (err) {
    console.error("apiUpdateTestcase error:", err);
    throw err;
  }
};

export const apiDeleteTestcase = async (testcaseId) => {
  try {
    const resp = await axios.delete(`${BASE_URL}/api/testcase/${testcaseId}/delete`);
    return resp.data;
  } catch (err) {
    console.error("apiDeleteTestcase error:", err);
    throw err;
  }
};

export const apiRunTestcaseFromFlowchart = async (flowchartId) => {
  try {
    const resp = await axios.post(`${BASE_URL}/api/testcase/run/from-flowchart/${flowchartId}`);
    return resp.data;
  } catch (err) {
    console.error("apiRunTestcaseFromFlowchart error:", err);
    throw err;
  }
};

// (ต่อจากไฟล์ FlowchartService.js ที่มีอยู่)
export const apiCreateLab = async (labPayload) => {
  try {
    // axios จะ resolve สำหรับสถานะ 2xx (รวม 201) ดังนั้นเราตรวจสอบ status เผื่อความแน่นอน
    const resp = await axios.post(`${BASE_URL}/labs`, labPayload, {
      headers: { "Content-Type": "application/json" },
    });

    if (resp.status !== 201) {
      // ขึ้นข้อความเตือนถ้า backend ตอบไม่ใช่ 201
      console.warn(`apiCreateLab: expected status 201 but got ${resp.status}`);
    }

    return resp.data; // คาดเป็น { ok: true, lab: { labId: ..., ... } }
  } catch (err) {
    console.error("apiCreateLab error:", err);
    throw err;
  }
};


// เพิ่มที่ท้ายไฟล์ FlowchartService.js

export const apiGetLab = async (labId) => {
  if (!labId) {
    throw new Error("apiGetLab: missing labId");
  }

  try {
    const resp = await axios.get(`${BASE_URL}/labs/${encodeURIComponent(labId)}`, {
      headers: { "Content-Type": "application/json" },
      // NOTE: GET should not have a body. axios.get doesn't send a body by default.
    });

    // resp.status ควรเป็น 200 สำหรับ success
    if (resp.status !== 200) {
      console.warn(`apiGetLab: expected status 200 but got ${resp.status}`);
    }

    // คืนข้อมูลที่ backend ส่งมา (เช่น { ok: true, lab: { labId: ..., testcases: [...] } })
    return resp.data;
  } catch (err) {
    console.error("apiGetLab error:", err);
    throw err;
  }
};


