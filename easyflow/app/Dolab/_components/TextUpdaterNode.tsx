import { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

export function TextUpdaterNode({ data }:{data:{ label:string }}) {
  const onChange = useCallback((evt:any) => {
    console.log(evt.target.value);
  }, []);
 
  return (
    <div className="text-updater-node">
      <div>
    <Handle
      type="target"
      position={Position.Bottom}
      style={{ background: '#fff' }}
    />

    <Handle
      type="source"
      position={Position.Top}
      style={{ background: '#fff' }}
    />
        <label htmlFor="text">Text: {data.label} </label>
      </div>
    </div>
  );
}