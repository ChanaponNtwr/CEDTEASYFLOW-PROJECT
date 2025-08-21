"use client"; // Mark as client component for Next.js App Router

import { FaFileAlt } from "react-icons/fa";

// Define prop types using TypeScript
interface AssignmentItemProps {
  title?: string;
  due?: string;
  onEditClick?: () => void; // Optional handler for Edit button
}

function AssignmentItem({ title = "Untitled Assignment", due = "No due date", onEditClick }: AssignmentItemProps) {
  return (
    <div className="h-26 flex items-center justify-between bg-white p-4 rounded-lg shadow-md hover:bg-gray-100 hover:scale-100 transition-all cursor-pointer">
      <div className="flex items-center">
        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4">
          <FaFileAlt className="w-8 h-8 text-gray-500" />
        </div>
        <div>
          <p className="text-gray-800 font-semibold text-lg">{title}</p>
          <p className="text-gray-500 text-lg">{due}</p>
        </div>
      </div>
      <button
        onClick={onEditClick}
        className="text-gray-500 hover:text-gray-700"
        disabled={!onEditClick} // Disable button if no handler is provided
      >
        Edit
      </button>
    </div>
  );
}

export default AssignmentItem;