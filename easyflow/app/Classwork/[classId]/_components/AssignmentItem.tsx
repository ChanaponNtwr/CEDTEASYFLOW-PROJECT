"use client"; 

import { FaCode, FaEdit, FaTrash, FaRegCalendarAlt } from "react-icons/fa";

interface AssignmentItemProps {
  title?: string;
  due?: string;
  description?: string;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
}

function AssignmentItem({
  title = "Untitled Assignment",
  due = "No due date",
  description,
  onEditClick,
  onDeleteClick,
}: AssignmentItemProps) {
  return (
    <div className="group relative bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 cursor-pointer flex items-start sm:items-center justify-between gap-4">
      
      {/* Decorative Left Strip (Optional visual indicator) */}
      <div className="absolute left-0 top-4 bottom-4 w-1 bg-blue-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Left Content */}
      <div className="flex items-start sm:items-center flex-1 overflow-hidden gap-4">
        {/* Icon Container */}
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
          <FaCode className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-gray-800 font-bold text-lg truncate group-hover:text-blue-700 transition-colors">
            {title}
          </h3>

          {/* Description */}
          {description && (
            <p className="text-gray-500 text-sm truncate mt-0.5 font-medium">
              {description}
            </p>
          )}

          {/* Meta Info (Mobile View mostly, but good for structure) */}
          <div className="flex items-center mt-1.5 text-xs text-gray-400 font-medium">
            <FaRegCalendarAlt className="mr-1.5" />
            <span className={due.includes("No due") ? "text-gray-400" : "text-orange-500"}>
               {due.includes("No due") ? due : `Due: ${due}`}
            </span>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
        {onEditClick && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEditClick();
            }}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <FaEdit size={18} />
          </button>
        )}

        {onDeleteClick && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDeleteClick();
            }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <FaTrash size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export default AssignmentItem;