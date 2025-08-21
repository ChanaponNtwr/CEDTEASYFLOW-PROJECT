import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

const InputNode: React.FC<{ data: { label: string } }> = ({ data }) => {
  return (
    <div
      className="bg-blue-200 border border-blue-500 rounded p-2 shadow-md"
      style={{
        width: '150px', // Match default React Flow node width
        minHeight: '36px', // Approximate height for single-line text
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px', // Match default font size
        lineHeight: '1.5', // Ensure text alignment consistency
        boxSizing: 'border-box',
        transform: 'skewX(-20deg)', // Apply skew to create parallelogram shape
        transformOrigin: 'center', // Ensure skew is centered
      }}
    >
      {/* Counter-skew the content to keep text upright */}
      <div style={{ transform: 'skewX(20deg)' }}>{data.label}</div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default InputNode;