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


export const apiGetFlowchart = async (id) => {
  try {
    const response = await axios.get(`${BASE_URL}/flowchart/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching flowchart:", error);
    throw error;
  }
};


// export const apiDeleteFlowchart = async (id) => {
//   try {
//     const response = await axios.delete(`${BASE_URL}/flowchart/${id}`);
//     return response.data;
//   } catch (error) {
//     console.error("Error fetching flowchart:", error);
//     throw error;
//   }
// };


// // --- ลบ Node ตาม flowchartId และ nodeId ---
// export const apiDeleteNode = async (flowchartId, nodeId) => {
//   try {
//     const response = await axios.delete(
//       `${BASE_URL}/flowchart/${flowchartId}/node/${nodeId}`
//     );
//     return response.data;
//   } catch (error) {
//     console.error("Error deleting node:", error);
//     throw error;
//   }
// };


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



