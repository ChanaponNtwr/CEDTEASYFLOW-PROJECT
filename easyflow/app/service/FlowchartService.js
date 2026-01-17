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


// FlowchartService.js

export const apiAddLabToClass = async (classId, labId, userId, dueDate) => { // ✅ รับ dueDate เพิ่ม
  if (!classId) throw new Error("apiAddLabToClass: missing classId");
  if (!labId) throw new Error("apiAddLabToClass: missing labId");
  
  // เพิ่มการเช็ค userId
  if (!userId) throw new Error("apiAddLabToClass: missing userId (x-user-id)");

  try {
    // เตรียม Body Payload
    const payload = { 
      labId: labId 
    };

    // ✅ ถ้ามี dueDate ส่งมา ให้เพิ่มเข้าไปใน Body
    if (dueDate) {
      payload.dueDate = dueDate;
    }

    const resp = await axios.post(
      `${BASE_URL}/classes/${encodeURIComponent(classId)}/labs`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(userId), // ✅ แก้ไข: ส่ง userId ใน Header ตาม Spec
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

export const apiGetClassUsers = async (classId) => {
  if (!classId) {
    throw new Error("apiGetClassUsers: missing classId");
  }

  try {
    const resp = await axios.get(
      `${BASE_URL}/classes/${encodeURIComponent(classId)}/users`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (resp.status !== 200) {
      console.warn(`apiGetClassUsers: expected status 200 but got ${resp.status}`);
    }

    // Expected response: { ok: true, users: [...] }
    return resp.data;
  } catch (err) {
    console.error("apiGetClassUsers error:", err?.response ?? err);
    throw err;
  }
};

export const apiSearchUsers = async (query) => {
  try {
    // ใช้ params เพื่อให้ axios จัดการ ?q=... ให้ (รวมถึง encode ตัวอักษรพิเศษ)
    const resp = await axios.get(`${BASE_URL}/classes/users/search`, {
      params: { q: query }, 
      headers: { "Content-Type": "application/json" },
    });

    // คาดหวัง return shape: { ok: true, users: [...] } หรือตามที่ backend ส่งมา
    return resp.data;
  } catch (err) {
    console.error("apiSearchUsers error:", err?.response ?? err);
    throw err;
  }
};

export const apiAddUserToClass = async (classId, targetUserId, roleId, actorId) => {
  // actorId = คนที่กดปุ่มเพิ่ม (ส่งไปใน Header x-user-id)
  // targetUserId = คนที่จะถูกเพิ่ม (Body)
  // roleId = บทบาท (Body)

  if (!classId || !targetUserId || !roleId || !actorId) {
    throw new Error("apiAddUserToClass: Missing required parameters");
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/classes/${encodeURIComponent(classId)}/users`,
      { 
        userId: Number(targetUserId), // แปลงเป็น int
        roleId: Number(roleId)        // แปลงเป็น int
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(actorId), // ✅ Header: x-user-id
        },
      }
    );

    // Expected Response: { ok: true, result: { userId: 8, classId: 17, roleId: 2 } }
    return response.data; 
  } catch (error) {
    console.error("apiAddUserToClass error:", error?.response ?? error);
    throw error;
  }
};











export const apiStartTrial = async (labId) => {
  if (!labId) {
    throw new Error("apiStartTrial: missing labId");
  }

  try {
    const resp = await axios.post(
      `${BASE_URL}/trial/start`,
      { labId: Number(labId) }, // ส่ง body เป็น JSON { "labId": ... }
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    // ตรวจสอบ status code (ปกติ axios จะ throw ถ้าไม่ใช่ 2xx แต่เช็คเผื่อไว้ตามสไตล์ไฟล์เดิม)
    if (resp.status !== 200 && resp.status !== 201) {
      console.warn(`apiStartTrial: unexpected status ${resp.status}`);
    }

    // Return response data (คาดหวัง { ok: true, trialId: "...", flowchart: {...}, ... })
    return resp.data;
  } catch (err) {
    console.error("apiStartTrial error:", err?.response ?? err);
    throw err;
  }
};


export const apiGetTrialFlowchart = async (trialId) => {
  // รับ trialId เป็น string (UUID)
  if (!trialId) {
    throw new Error("apiGetFlowchart: missing trialId");
  }

  try {
    // ยิง GET ไปที่ /trial/{trialId}/flowchart
    const response = await axios.get(`${BASE_URL}/trial/${trialId}/flowchart`);
    
    // คาดหวัง return เป็น { ok: true, flowchart: { nodes: [], edges: [] }, ... }
    return response.data; 
  } catch (err) {
    console.error("apiGetFlowchart error:", err);
    throw err;
  }
};

export const insertTrialNode = async (trialId, edgeId, node) => {
  if (!trialId) {
    throw new Error("insertTrialNode: missing trialId");
  }

  try {
    const response = await axios.post(`${BASE_URL}/trial/${trialId}/flowchart/node`, {
      edgeId,
      node,
    });
    return response.data;
  } catch (err) {
    console.error("insertTrialNode error:", err);
    throw err;
  }
};

// ---------------------------------------------------------
// 2. Edit/Update Node (PUT)
// Path: /trial/{trialId}/flowchart/node/{nodeId}
// ---------------------------------------------------------
export const editTrialNode = async (trialId, nodeId, updateData) => {
  if (!trialId || !nodeId) {
    throw new Error("editTrialNode: missing trialId or nodeId");
  }

  try {
    const resp = await axios.put(
      `${BASE_URL}/trial/${trialId}/flowchart/node/${nodeId}`,
      updateData
    );
    return resp.data;
  } catch (error) {
    console.error("editTrialNode error:", error);
    throw error;
  }
};

// ---------------------------------------------------------
// 3. Delete Node (DELETE)
// Path: /trial/{trialId}/flowchart/node/{nodeId}
// ---------------------------------------------------------
export const deleteTrialNode = async (trialId, nodeId) => {
  if (!trialId || !nodeId) {
    throw new Error("deleteTrialNode: missing trialId or nodeId");
  }

  try {
    const resp = await axios.delete(
      `${BASE_URL}/trial/${trialId}/flowchart/node/${nodeId}`
    );
    return resp.data;
  } catch (error) {
    console.error("deleteTrialNode error:", error);
    throw error;
  }
};


export const apiGetTrialTestcases = async (trialId) => {
  if (!trialId) throw new Error("apiGetTrialTestcases: missing trialId");

  try {
    const resp = await axios.get(`${BASE_URL}/trial/${trialId}/testcases`);
    return resp.data; // { ok: true, testcases: [...] }
  } catch (err) {
    console.error("apiGetTrialTestcases error:", err);
    throw err;
  }
};

// ---------------------------------------------------------
// 5. Run Trial Testcases
// POST /trial/{trialId}/testcases/run
// ---------------------------------------------------------
export const apiRunTrialTestcases = async (trialId, body = {}) => {
  if (!trialId) throw new Error("apiRunTrialTestcases: missing trialId");

  try {
    const resp = await axios.post(`${BASE_URL}/trial/${trialId}/testcases/run`, body);
    return resp.data; // { ok: true, results: [...], totalScore, maxScore }
  } catch (err) {
    console.error("apiRunTrialTestcases error:", err);
    throw err;
  }
};

// ---------------------------------------------------------
// 6. Execute Trial (Run / Step / Reset)
// POST /trial/{trialId}/execute
// ---------------------------------------------------------
export const apiExecuteTrial = async (trialId, payload) => {
  // payload: { action: "step" | "runAll" | "reset", variables?: [], forceAdvanceBP?: boolean }
  if (!trialId) throw new Error("apiExecuteTrial: missing trialId");

  try {
    const resp = await axios.post(`${BASE_URL}/trial/${trialId}/execute`, payload);
    return resp.data; 
  } catch (err) {
    console.error("apiExecuteTrial error:", err);
    throw err;
  }
};

// --- Helper Wrappers (เรียกใช้ง่ายขึ้น) ---

// สั่ง Run All (รวดเดียวจบ)
export const apiTrialRunAll = (trialId) => {
  return apiExecuteTrial(trialId, { action: "runAll" });
};

// สั่ง Step (ทีละก้าว)
export const apiTrialStep = (trialId, variables = []) => {
  return apiExecuteTrial(trialId, { action: "step", variables });
};

// สั่ง Reset
export const apiTrialReset = (trialId) => {
  return apiExecuteTrial(trialId, { action: "reset" });
};


export const apiGetTrialShapeRemaining = async (trialId) => {
  if (!trialId) {
    throw new Error("apiGetTrialShapeRemaining: missing trialId");
  }

  try {
    const resp = await axios.get(`${BASE_URL}/trial/${trialId}/shapes/remaining`);
    
    // คาดหวัง response: { ok: true, trialId: "...", shapeRemaining: { ... } }
    return resp.data;
  } catch (err) {
    console.error("apiGetTrialShapeRemaining error:", err);
    throw err;
  }
};