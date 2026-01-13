"use client"; // Mark as client component for Next.js App Router

import { FaFileAlt } from "react-icons/fa";

// Define prop types using TypeScript
interface AssignmentItemProps {
  title?: string;
  due?: string;
  description?: string; // ✅ เพิ่ม prop นี้
  onEditClick?: () => void; // Optional handler for Edit button
}

function AssignmentItem({
  title = "Untitled Assignment",
  due = "No due date",
  description,
  onEditClick,
}: AssignmentItemProps) {
  return (
    <div className="relative h-32 bg-white p-4 rounded-lg shadow-md hover:bg-gray-100 transition-all cursor-pointer flex items-center justify-between">
      {/* Left Content */}
      <div className="flex items-center flex-1 overflow-hidden">
        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4 shrink-0">
          <FaFileAlt className="w-8 h-8 text-gray-500" />
        </div>

        <div className="overflow-hidden">
          {/* Title */}
          <p className="text-gray-800 font-semibold text-lg truncate">
            {title}
          </p>

          {/* Description (Problem Solving) */}
          {description && (
            <p className="text-gray-600 text-sm truncate">
              {description}
            </p>
          )}

          {/* Due Date */}
          <p className="text-gray-500 text-sm">
            {due}
          </p>
        </div>
      </div>

      {/* Right Edit Button */}
      {onEditClick && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEditClick();
          }}
          className="ml-4 text-gray-500 hover:text-gray-700"
        >
          
        </button>
      )}
    </div>
  );
}

export default AssignmentItem;
