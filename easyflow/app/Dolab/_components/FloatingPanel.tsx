// components/FloatingPanel.tsx
import React from 'react';

interface FloatingPanelProps {
  isOpen: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onAddInputNode: () => void; // New prop to handle adding Input node
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({ isOpen, x, y, onClose, onAddInputNode }) => {
  if (!isOpen) return null;

  const handleButtonClick = () => {
    onClose(); // Close the panel
  };

  return (
    <div
      className="fixed bg-white shadow-lg p-4 rounded-lg border border-gray-300 z-10"
      style={{ top: `${y}px`, left: `${x}px`, maxHeight: '50vh', overflowY: 'auto' }}
    >
      <button
        onClick={onClose}
        className="absolute top-1 right-1 text-gray-500 hover:text-gray-700"
      >
        ✕
      </button>
      <h2 className="text-xl font-bold mb-2">Statement</h2>
      <div className="grid grid-cols-2 gap-2">
        {/* Input/Output */}
        <div>
          <h3 className="font-semibold">Input/Output</h3>
          <button
            onClick={() => {
              onAddInputNode(); // Call the function to add Input node
            }}
            className="bg-blue-200 p-2 mt-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
          >
            Input
          </button>
          <button
            onClick={handleButtonClick}
            className="bg-green-200 p-2 mt-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
          >
            Output
          </button>
        </div>
        {/* Variables */}
        <div>
          <h3 className="font-semibold">Variables</h3>
          <button
            onClick={handleButtonClick}
            className="bg-yellow-200 p-2 mt-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
          >
            Declare
          </button>
          <button
            onClick={handleButtonClick}
            className="bg-yellow-200 p-2 mt-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
          >
            Assign
          </button>
        </div>
        {/* Control */}
        <div>
          <h3 className="font-semibold">Control</h3>
          <button
            onClick={handleButtonClick}
            className="bg-pink-200 p-2 mt-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
          >
            If
          </button>
          <button
            onClick={handleButtonClick}
            className="bg-purple-200 p-2 mt-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
          >
            Call
          </button>
        </div>
        {/* Looping */}
        <div>
          <h3 className="font-semibold">Looping</h3>
          <button
            onClick={handleButtonClick}
            className="bg-orange-200 p-2 mt-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
          >
            While
          </button>
          <button
            onClick={handleButtonClick}
            className="bg-orange-200 p-2 mt-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
          >
            For
          </button>
          <button
            onClick={handleButtonClick}
            className="bg-orange-200 p-2 mt-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
          >
            Do
          </button>
        </div>
      </div>
      <h2 className="text-xl font-bold mt-4 mb-2">Turtle Graphics</h2>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleButtonClick}
          className="bg-green-200 p-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
        >
          Forward
        </button>
        <button
          onClick={handleButtonClick}
          className="bg-yellow-200 p-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
        >
          Turn
        </button>
        <button
          onClick={handleButtonClick}
          className="bg-yellow-200 p-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
        >
          Pen
        </button>
        <button
          onClick={handleButtonClick}
          className="bg-green-200 p-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
        >
          Clear
        </button>
        <button
          onClick={handleButtonClick}
          className="bg-yellow-200 p-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
        >
          Home
        </button>
      </div>
      <h2 className="text-xl font-bold mt-4 mb-2">Files</h2>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleButtonClick}
          className="bg-blue-200 p-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
        >
          Read
        </button>
        <button
          onClick={handleButtonClick}
          className="bg-yellow-200 p-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
        >
          Open
        </button>
        <button
          onClick={handleButtonClick}
          className="bg-green-200 p-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
        >
          Write
        </button>
        <button
          onClick={handleButtonClick}
          className="bg-yellow-200 p-2 rounded w-full text-left hover:bg-opacity-80 hover:shadow-md transition duration-200"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default FloatingPanel;