"use client"; // Mark as client component for Next.js

import { FaChevronDown, FaPenSquare } from "react-icons/fa";

// Define prop types using TypeScript
interface FilterActionsProps {
  onCreateClick?: () => void; // Optional onCreateClick handler
}

function FilterActions({ onCreateClick }: FilterActionsProps) {
  return (
    <div className="flex justify-end space-x-4 mb-6">
      <button className="bg-red-500 text-white px-4 py-2 rounded-full flex items-center hover:bg-red-600">
        ALL
        <FaChevronDown className="ml-2 w-4 h-4" />
      </button>
    </div>
  );
}

export default FilterActions;