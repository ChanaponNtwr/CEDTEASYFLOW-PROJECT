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



// FlowchartService.js (axios instance 'api' ตามที่มีอยู่แล้ว)
export const apiCreateClass = async (payload) => {
  try {
    const resp = await axios.post(`${BASE_URL}/classes`, payload); // <<-- Change to axios and correct URL
    return resp.data; // Expected { ok: true, class: { ... } }
  } catch (err) {
    console.error("apiCreateClass error:", err?.response ?? err);
    throw err;
  }
};

export const apiGetClasses = async () => {
  try {
    const resp = await axios.get(`${BASE_URL}/classes`);
    return resp.data; // Expected { ok: true, classes: [...] }
  } catch (err) {
    console.error("apiGetClasses error:", err);
    throw err;
  }
};

// Update (replace) lab (testcases)
export const apiUpdateLab = async (labId, labPayload) => {
  if (!labId) {
    throw new Error("apiUpdateLab: missing labId");
  }
  if (!labPayload || typeof labPayload !== "object") {
    throw new Error("apiUpdateLab: missing or invalid labPayload");
  }

  try {
    const resp = await axios.put(
      `${BASE_URL}/labs/${encodeURIComponent(labId)}`,
      labPayload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (resp.status !== 200) {
      console.warn(`apiUpdateLab: expected status 200 but got ${resp.status}`);
    }

    // คาด backend ส่งกลับรูปแบบเช่น { ok: true, lab: { labId: ..., testcases: [...] } }
    return resp.data;
  } catch (err) {
    console.error("apiUpdateLab error:", err?.response ?? err);
    throw err;
  }
};

export const apiGetClass = async (classId) => {
  if (!classId) {
    throw new Error("apiGetClass: missing classId");
  }

  try {
    const resp = await axios.get(
      `${BASE_URL}/classes/${encodeURIComponent(classId)}`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (resp.status !== 200) {
      console.warn(`apiGetClass: expected status 200 but got ${resp.status}`);
    }

    const data = resp.data;

    // ✅ รองรับ backend shape { ok, class }
    const classData = data?.class ?? data;

    // ⚠️ เตือนเฉย ๆ ถ้าโครงสร้างไม่ตรงที่คาด
    if (
      !classData ||
      typeof classData !== "object" ||
      !("classLabs" in classData) ||
      !("userClasses" in classData) ||
      !("packageClasses" in classData)
    ) {
      console.warn(
        "apiGetClass: response missing expected fields (classLabs, userClasses, packageClasses). Response keys:",
        classData ? Object.keys(classData) : classData
      );
    }

    // ✅ return class object จริง
    return classData;
  } catch (err) {
    console.error("apiGetClass error:", err?.response ?? err);
    throw err;
  }
};


export const apiAddLabToClass = async (classId, labId, userId) => {
  if (!classId) throw new Error("apiAddLabToClass: missing classId");
  if (!labId) throw new Error("apiAddLabToClass: missing labId");

  try {
    const resp = await axios.post(
      `${BASE_URL}/classes/${encodeURIComponent(classId)}/labs`,
      { labId },
      {
        headers: {
          "Content-Type": "application/json",
          ...(userId ? { "x-user-id": String(userId) } : {}),
        },
        // allow axios to resolve for 2xx; we'll check status below
        validateStatus: (status) => status >= 200 && status < 300,
      }
    );

    // Accept both 200 and 201 as success
    if (resp.status !== 200 && resp.status !== 201) {
      console.warn(`apiAddLabToClass: expected 200/201 but got ${resp.status}`);
    }

    // Expect response like { ok: true }
    return resp.data;
  } catch (err) {
    // If backend returns non-2xx, axios throws: err.response may exist
    console.error("apiAddLabToClass error:", err?.response ?? err);
    // Re-throw with helpful message
    const message =
      err?.response?.data?.message ||
      err?.response?.data ||
      err.message ||
      "apiAddLabToClass failed";
    const e = new Error(message);
    // attach response for callers who want more detail
    e.response = err?.response;
    throw e;
  }
};


export const apiListLabsInClass = async (classId) => {
  if (!classId) throw new Error("apiListLabsInClass: missing classId");

  try {
    const resp = await axios.get(
      `${BASE_URL}/classes/${encodeURIComponent(classId)}/labs`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (resp.status !== 200) {
      console.warn(`apiListLabsInClass: expected status 200 but got ${resp.status}`);
    }

    // Normalize response: prefer resp.data.labs if backend wraps, otherwise return resp.data
    const labs = resp.data && typeof resp.data === "object" && "labs" in resp.data ? resp.data.labs : resp.data;
    return labs;
  } catch (err) {
    console.error("apiListLabsInClass error:", err?.response ?? err);
    // rethrow (caller should handle)
    throw err;
  }
};