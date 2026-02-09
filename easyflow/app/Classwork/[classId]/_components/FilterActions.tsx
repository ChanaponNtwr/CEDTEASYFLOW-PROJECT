"use client";

import React, { useState, useRef, useEffect } from "react";
import { FaChevronDown, FaPlus } from "react-icons/fa";

interface FilterActionsProps {
  onCreateClick?: () => void;
  onFilterChange?: (filter: "all" | "oldest" | "newest" | "todo") => void;
}

function FilterActions({ onCreateClick, onFilterChange }: FilterActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "oldest" | "newest" | "todo"
  >("newest"); // Default to newest for better UX
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filterOptions = [
    { value: "all", label: "All Items" },
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "todo", label: "To Do" },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFilterSelect = (
    filter: "all" | "oldest" | "newest" | "todo"
  ) => {
    setSelectedFilter(filter);
    onFilterChange?.(filter);
    setIsOpen(false);
  };

  const currentLabel = filterOptions.find((opt) => opt.value === selectedFilter)?.label;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
      <h2 className="text-xl font-bold text-gray-800">Assignments</h2>
      
      <div className="flex items-center space-x-3">
        {/* Dropdown Filter */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-between space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm min-w-[140px]"
          >
            <span className="text-sm font-medium">{currentLabel}</span>
            <FaChevronDown
              className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${
                isOpen ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl z-20 border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="py-1">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      handleFilterSelect(
                        option.value as "all" | "oldest" | "newest" | "todo"
                      )
                    }
                    className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        selectedFilter === option.value 
                        ? "bg-blue-50 text-blue-600 font-medium" 
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Create/Import Button */}
        {onCreateClick && (
          <button
            onClick={onCreateClick}
            className="flex items-center justify-center space-x-2 px-5 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-200"
          >
            <FaPlus className="w-3.5 h-3.5" />
            <span className="text-sm font-semibold">Create</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default FilterActions;