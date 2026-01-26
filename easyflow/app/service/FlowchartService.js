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

export const apiAddLabToClass = async (classId, labId, userId, dueDate) => {
  if (!classId || !labId || !userId) {
    throw new Error("apiAddLabToClass: missing required parameters");
  }

  try {
    const url = `${BASE_URL}/classes/${encodeURIComponent(classId)}/labs`;
    
    // Body: { "labId": 3, "dueDate": "..." }
    const payload = { 
      labId: Number(labId) 
    };

    // ถ้ามี dueDate ส่งมาด้วย ให้เพิ่มเข้าไปใน body
    if (dueDate) {
      payload.dueDate = dueDate;
    }

    const resp = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-user-id": String(userId), // Teacher ID
      },
      // ยอมรับ status 200 หรือ 201 ว่าสำเร็จ
      validateStatus: (status) => status === 200 || status === 201,
    });

    return resp.data;
  } catch (err) {
    console.error("apiAddLabToClass error:", err?.response ?? err);
    throw err;
  }
};

// ✅ แก้ไขวันครบกำหนด (Edit Due Date)
// Method: PATCH /classes/:classId/labs/:labId
export const apiUpdateLabDueDate = async (classId, labId, userId, newDueDate) => {
  if (!classId || !labId || !userId || !newDueDate) {
    throw new Error("apiUpdateLabDueDate: missing required parameters");
  }

  try {
    const url = `${BASE_URL}/classes/${encodeURIComponent(classId)}/labs/${encodeURIComponent(labId)}`;
    
    const payload = { 
      dueDate: newDueDate 
    };

    const resp = await axios.patch(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-user-id": String(userId),
      },
      validateStatus: (status) => status === 200 || status === 201,
    });

    return resp.data;
  } catch (err) {
    console.error("apiUpdateLabDueDate error:", err?.response ?? err);
    throw err;
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

// แก้ไขฟังก์ชัน apiSearchUsers
export const apiSearchUsers = async (classId, query, currentUserId) => {
  // ตรวจสอบข้อมูลเบื้องต้น (Optional)
  if (!classId || !currentUserId) {
    console.warn("apiSearchUsers: Missing classId or currentUserId");
    // อาจจะ return ค่าว่างกลับไปเพื่อป้องกัน error
    return { ok: true, users: [] };
  }

  try {
    // 1. แทรก classId ลงใน URL ตาม Requirement: /classes/{id}/users/search
    const url = `${BASE_URL}/classes/${encodeURIComponent(classId)}/users/search`;

    const resp = await axios.get(url, {
      params: { q: query }, 
      headers: { 
        "Content-Type": "application/json",
        // 2. เพิ่ม Header x-user-id ตาม Requirement
        "x-user-id": currentUserId 
      },
    });

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


// เปลี่ยน Role ของ User ใน Class
export const apiUpdateUserRole = async (classId, targetUserId, newRoleId, currentUserId) => {
  if (!classId || !targetUserId || !newRoleId || !currentUserId) {
    throw new Error("apiUpdateUserRole: Missing required parameters");
  }

  try {
    // URL format: /classes/:classId/users/:userId/role
    const url = `${BASE_URL}/classes/${classId}/users/${targetUserId}/role`;

    const resp = await axios.patch(
      url,
      { roleId: newRoleId }, // Body: { "roleId": ... }
      {
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUserId, // Header: x-user-id
        },
      }
    );

    return resp.data;
  } catch (err) {
    console.error("apiUpdateUserRole error:", err?.response ?? err);
    throw err;
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


// ---------------------------------------------------------
// Submission APIs (ส่งงาน / ตรวจงาน)
// ---------------------------------------------------------

/**
 * ส่งงาน (Submit Flowchart)
 * Endpoint: POST /api/submission/submit
 */
export const apiSubmitFlowchart = async (flowchartId, userId) => {
  if (!flowchartId || !userId) {
    throw new Error("apiSubmitFlowchart: missing flowchartId or userId");
  }

  try {
    const payload = {
      flowchartId: Number(flowchartId),
      userId: Number(userId),
    };

    const resp = await axios.post(`${BASE_URL}/api/submission/submit`, payload);
    return resp.data; // Expected: { ok: true, summary: {...}, normalizedResults: [...] }
  } catch (err) {
    console.error("apiSubmitFlowchart error:", err?.response ?? err);
    throw err;
  }
};

/**
 * ดึงรายการส่งงานของ Lab นั้นๆ (List Submissions by Lab)
 * Endpoint: GET /api/submission/lab/{labId}
 */
export const apiGetSubmissionsByLab = async (labId) => {
  if (!labId) {
    throw new Error("apiGetSubmissionsByLab: missing labId");
  }

  try {
    const resp = await axios.get(`${BASE_URL}/api/submission/lab/${encodeURIComponent(labId)}`);
    return resp.data; // Expected: List of submissions or specific submission structure
  } catch (err) {
    console.error("apiGetSubmissionsByLab error:", err?.response ?? err);
    throw err;
  }
};

/**
 * ยืนยัน/อนุมัติงาน (Confirm Submission)
 * Endpoint: POST /api/submission/lab/{labId}/user/{userId}/confirm
 */
export const apiConfirmSubmission = async (labId, studentUserId, reviewerId) => {
  if (!labId || !studentUserId || !reviewerId) {
    throw new Error("apiConfirmSubmission: missing required parameters");
  }

  try {
    const url = `${BASE_URL}/api/submission/lab/${encodeURIComponent(labId)}/user/${encodeURIComponent(studentUserId)}/confirm`;
    
    const payload = { 
      reviewerId: Number(reviewerId) 
    };

    const resp = await axios.post(url, payload);
    return resp.data;
  } catch (err) {
    console.error("apiConfirmSubmission error:", err?.response ?? err);
    throw err;
  }
};

/**
 * ปฏิเสธงาน (Reject Submission)
 * Endpoint: POST /api/submission/lab/{labId}/user/{userId}/reject
 */
export const apiRejectSubmission = async (labId, studentUserId, reviewerId) => {
  if (!labId || !studentUserId || !reviewerId) {
    throw new Error("apiRejectSubmission: missing required parameters");
  }

  try {
    const url = `${BASE_URL}/api/submission/lab/${encodeURIComponent(labId)}/user/${encodeURIComponent(studentUserId)}/reject`;
    
    const payload = { 
      reviewerId: Number(reviewerId) 
    };

    const resp = await axios.post(url, payload);
    return resp.data;
  } catch (err) {
    console.error("apiRejectSubmission error:", err?.response ?? err);
    throw err;
  }
};


export const apiLeaveClass = async (classId, userId) => {
  if (!classId || !userId) {
    throw new Error("apiLeaveClass: Missing classId or userId");
  }

  try {
    const resp = await axios.post(
      `${BASE_URL}/classes/${encodeURIComponent(classId)}/leave`,
      {}, // Body ว่าง
      {
        headers: { "x-user-id": String(userId) },
      }
    );
    return resp.data;
  } catch (err) {
    console.error("apiLeaveClass error:", err?.response ?? err);
    throw err;
  }
};

/**
 * Owner ลบ User ออกจากคลาส (Kick user)
 * DELETE /classes/:classId/users/:userId
 * Header: x-user-id (Actor/Owner)
 */
export const apiRemoveUserFromClass = async (classId, targetUserId, actorId) => {
  if (!classId || !targetUserId || !actorId) {
    throw new Error("apiRemoveUserFromClass: Missing required parameters");
  }

  try {
    const resp = await axios.delete(
      `${BASE_URL}/classes/${encodeURIComponent(classId)}/users/${encodeURIComponent(targetUserId)}`,
      {
        headers: { "x-user-id": String(actorId) },
      }
    );
    return resp.data;
  } catch (err) {
    console.error("apiRemoveUserFromClass error:", err?.response ?? err);
    throw err;
  }
};

/**
 * ลบ Lab ออกจาก Class (Owner ลบได้หมด, Teacher/TA ลบได้เฉพาะที่สร้าง)
 * DELETE /classes/:classId/labs/:labId
 * Header: x-user-id (Actor)
 */
export const apiRemoveLabFromClass = async (classId, labId, actorId) => {
  if (!classId || !labId || !actorId) {
    throw new Error("apiRemoveLabFromClass: Missing required parameters");
  }

  try {
    const resp = await axios.delete(
      `${BASE_URL}/classes/${encodeURIComponent(classId)}/labs/${encodeURIComponent(labId)}`,
      {
        headers: { "x-user-id": String(actorId) },
      }
    );
    return resp.data;
  } catch (err) {
    console.error("apiRemoveLabFromClass error:", err?.response ?? err);
    throw err;
  }
};

/**
 * Owner ลบ Class ทิ้งถาวร
 * DELETE /classes/:classId
 * Header: x-user-id (Owner)
 */
export const apiDeleteClass = async (classId, actorId) => {
  if (!classId || !actorId) {
    throw new Error("apiDeleteClass: Missing classId or actorId");
  }

  try {
    const resp = await axios.delete(
      `${BASE_URL}/classes/${encodeURIComponent(classId)}`,
      {
        headers: { "x-user-id": String(actorId) },
      }
    );
    return resp.data;
  } catch (err) {
    console.error("apiDeleteClass error:", err?.response ?? err);
    throw err;
  }
};

/**
 * ผู้ใช้ลบ Lab ของตัวเอง (My Lab)
 * DELETE /labs/:labId
 * Header: x-user-id
 */
export const apiDeleteLab = async (labId, userId) => {
  if (!labId || !userId) {
    throw new Error("apiDeleteLab: Missing labId or userId");
  }

  try {
    const resp = await axios.delete(
      `${BASE_URL}/labs/${encodeURIComponent(labId)}`,
      {
        headers: { "x-user-id": String(userId) },
      }
    );
    return resp.data;
  } catch (err) {
    console.error("apiDeleteLab error:", err?.response ?? err);
    throw err;
  }
};