import axios from "axios";

const BASE_URL = "http://localhost:8080/flowchart";

export const apiPostFlowchart = async (data) => {
  try {
    const response = await axios.post(`${BASE_URL}/create`, data);
    return response.data;
  } catch (error) {
    console.error("Error posting flowchart:", error);
    throw error;
  }
};


// Get flowchart by ID
export const getFlowchart = async (flowchartId) => {
  try {
    const response = await axios.get(`${BASE_URL}/${flowchartId}`);
    return response.data;
  } catch (err) {
    console.error("getFlowchart error:", err);
    throw err;
  }
};

// Get only edges
export const getEdges = async (flowchartId) => {
  try {
    const response = await axios.get(`${BASE_URL}/${flowchartId}/edges`);
    return response.data;
  } catch (err) {
    console.error("getEdges error:", err);
    throw err;
  }
};

// Insert node at edge
export const insertNode = async (flowchartId, edgeId, node) => {
  try {
    const response = await axios.post(`${BASE_URL}/insert-node`, {
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

// Delete node
export const deleteNode = async (flowchartId, nodeId) => {
  try {
    const response = await axios.delete(`${BASE_URL}/${flowchartId}/node/${nodeId}`);
    return response.data;
  } catch (err) {
    console.error("deleteNode error:", err);
    throw err;
  }
};

/* ---------------- Execute Flowchart ---------------- */

// Execute flowchart (run, step, resume, reset)
export const executeFlowchart = async (data) => {
  try {
    const response = await axios.post(`${BASE_URL}/execute`, data);
    return response.data;
  } catch (err) {
    console.error("executeFlowchart error:", err);
    throw err;
  }
};




