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


// Create a new Lab
export const apiCreateLab = async (labPayload) => {
  if (!labPayload || typeof labPayload !== "object") {
    throw new Error("apiCreateLab: missing or invalid labPayload");
  }


  try {
    const resp = await axios.post(
      `${BASE_URL}/labs`,
      labPayload,
      {
        headers: { "Content-Type": "application/json" },
        validateStatus: (status) => status >= 200 && status < 300,
    }
  );


// Accept 200 or 201 as success
  if (resp.status !== 200 && resp.status !== 201) {
    console.warn(`apiCreateLab: expected 200/201 but got ${resp.status}`);
  }


// Return created lab object or whatever backend returns
  return resp.data;
  } catch (err) {
  console.error("apiCreateLab error:", err?.response ?? err);
  const message = err?.response?.data?.message || err?.message || "apiCreateLab failed";
  const e = new Error(message);
  e.response = err?.response;
  throw e;
  }
  };


// เพิ่มที่ท้ายไฟล์ FlowchartService.js

export const apiGetLab = async (labId) => {
  if (!labId) {
    throw new Error("apiGetLab: missing labId");
  }

  // small helper: try JSON.parse, fallback to custom parse
  const tryParseJsonArray = (raw) => {
    if (raw === null || typeof raw === "undefined") return null;
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string") return raw;

    // fast attempt JSON.parse for strings like "[1,2]" or '["a","b"]'
    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (e) {
      // fallback: split by comma or whitespace like your parseValues earlier
      const hasComma = raw.indexOf(",") !== -1;
      const parts = hasComma ? raw.split(",") : raw.split(/\s+/);
      return parts
        .map((s) => s.trim())
        .filter((s) => s !== "")
        .map((s) => {
          const n = Number(s);
          return Number.isNaN(n) ? s : n;
        });
    }
  };

  try {
    const resp = await axios.get(`${BASE_URL}/labs/${encodeURIComponent(labId)}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!(resp.status >= 200 && resp.status < 300)) {
      console.warn(`apiGetLab: unexpected status ${resp.status}`);
    }

    const data = resp.data;

    // if backend returns shape { lab: { ... } } normalize testcases
    if (data && data.lab && Array.isArray(data.lab.testcases)) {
      const lab = { ...data.lab };
      lab.testcases = lab.testcases.map((tc) => {
        return {
          ...tc,
          // parse fields that may be stringified arrays
          inputVal: tryParseJsonArray(tc.inputVal),
          outputVal: tryParseJsonArray(tc.outputVal),
          inHiddenVal:
            tc.inHiddenVal === null || typeof tc.inHiddenVal === "undefined"
              ? null
              : tryParseJsonArray(tc.inHiddenVal),
          outHiddenVal:
            tc.outHiddenVal === null || typeof tc.outHiddenVal === "undefined"
              ? null
              : tryParseJsonArray(tc.outHiddenVal),
          // score likely already number; keep as-is
        };
      });

      return { ...data, lab };
    }

    // otherwise just return raw data
    return data;
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

// ดึงข้อมูล shape ที่เหลือสำหรับ flowchart
export const apiGetShapeRemaining = async (flowchartId) => {
  if (!flowchartId) {
    throw new Error("apiGetShapeRemaining: missing flowchartId");
  }

  try {
    const resp = await axios.get(
      `${BASE_URL}/flowchart/${encodeURIComponent(flowchartId)}/shapes/remaining`,
      {
        headers: { "Content-Type": "application/json" },
        // GET ไม่มี body สำหรับ axios.get
      }
    );

    // ตรวจสถานะ (ถ้า backend คืน 200 เป็น success ปกติ)
    if (resp.status !== 200) {
      console.warn(`apiGetShapeRemaining: expected status 200 but got ${resp.status}`);
    }

    // คืนข้อมูลทั้งหมดที่ backend ส่งมา (ตัวอย่างตามที่คุณให้)
    // {
    //   ok: true,
    //   flowchartId: 15,
    //   shapeRemaining: { PH: {...}, DC: {...}, ... }
    // }
    return resp.data;
  } catch (err) {
    console.error("apiGetShapeRemaining error:", err?.response ?? err);
    throw err;
  }
};

