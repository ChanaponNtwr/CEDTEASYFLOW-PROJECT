"use client";

import { FaFileAlt } from "react-icons/fa";

interface AssignmentItemProps {
  title?: string;
  due?: string;
  onEditClick?: () => void;
}

function AssignmentItem({ title = "Untitled Assignment", due = "No due date", onEditClick }: AssignmentItemProps) {
  return (
    <div className="relative h-32 bg-white p-4 rounded-lg shadow-md hover:bg-gray-100 hover:scale-100 transition-all cursor-pointer">
      {/* Start Lab Button - Top Right */}
      <button
        onClick={onEditClick}
        className="absolute top-2 right-4 text-green-600 underline text-sm hover:text-green-800"
        disabled={!onEditClick}
      >
        Start Lab
      </button>

      {/* Main Content - Center Left */}
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center">
        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4">
          <FaFileAlt className="w-8 h-8 text-gray-500" />
        </div>
        <div>
          <p className="text-gray-800 font-semibold text-lg">{title}</p>
          <p className="text-gray-500 text-lg">{due}</p>
        </div>
      </div>

      {/* Time Slot - Bottom Right */}
      <div className="absolute bottom-2 right-4">
        <p className="text-gray-600 text-sm">9:00-12:00(อ.) - 13:00-15:00(พ.)</p>
      </div>
    </div>
  );
}

export default AssignmentItem;
