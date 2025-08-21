export interface NodeData {
  id: string;
  flowchartid: string;
  type: string;
  label: string;
  x: number;
  y: number;
}

export interface EdgeData {
  id: string;
  flowchartid: string;
  from: string;
  to: string;
  label: string;
}

export interface FlowchartData {
  flowchartID: string;
  name: string;
  description: string;
  nodes: NodeData[];
  edges: EdgeData[];
}
