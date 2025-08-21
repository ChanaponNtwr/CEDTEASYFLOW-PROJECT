import axios from "axios";

const BASE_URL = "http://localhost:5000/api";

export const getFlowchart = async (id: string) => {
  const res = await axios.get(`${BASE_URL}/flowcharts/${id}`);
  return res.data;
};

export const saveFlowchart = async (data: any) => {
  const res = await axios.post(`${BASE_URL}/flowcharts`, data);
  return res.data;
};

