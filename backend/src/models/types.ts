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
