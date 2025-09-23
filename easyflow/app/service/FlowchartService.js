import axios from "axios"; 

export const apiPostFlowchart = async (data) => {
  try {
    const response = await axios.post("http://localhost:8080/flowchart/create", data);
    return response.data;
  } catch (error) {
    console.error("Error posting flowchart:", error);
    throw error;
  }
};
