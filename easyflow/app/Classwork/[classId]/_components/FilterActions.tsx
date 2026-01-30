"use client";

import React, { useState } from "react";
import { FaChevronDown, FaPenSquare } from "react-icons/fa";

interface FilterActionsProps {
  onCreateClick?: () => void;
  onFilterChange?: (filter: "all" | "oldest" | "newest" | "todo") => void;
}

function FilterActions({ onCreateClick, onFilterChange }: FilterActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "oldest" | "newest" | "todo"
  >("all");

  const filterOptions = [
    { value: "all", label: "All" },
    { value: "oldest", label: "Oldest" },
    { value: "newest", label: "Newest" },
    { value: "todo", label: "To Do" },
  ];

  const handleFilterSelect = (
    filter: "all" | "oldest" | "newest" | "todo"
  ) => {
    setSelectedFilter(filter);
    onFilterChange?.(filter);
    setIsOpen(false);
  };

  return (
    <div className="flex justify-end space-x-4 mb-6">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-red-500 text-white px-4 py-2 rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 min-w-[120px] h-10"
        >
          {filterOptions.find((opt) => opt.value === selectedFilter)?.label ||
            "All"}
          <FaChevronDown
            className={`ml-2 w-4 h-4 transition-transform duration-200 ease-in-out ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg z-10 border border-gray-100">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() =>
                  handleFilterSelect(
                    option.value as "all" | "oldest" | "newest" | "todo"
                  )
                }
                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition-all duration-200 first:rounded-t-lg last:rounded-b-lg"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {onCreateClick && (
        <button
          onClick={onCreateClick}
          className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center justify-center hover:bg-blue-700 transition-all duration-200 min-w-[120px] h-10"
        >
          <FaPenSquare className="w-5 h-5 mr-2" />
          Import
        </button>
      )}
    </div>
  );
}

export default FilterActions;
