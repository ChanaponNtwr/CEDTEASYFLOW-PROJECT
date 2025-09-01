"use client";
import React from "react";
import { FaTrash, FaEllipsisV, FaUserPlus } from "react-icons/fa";

type Person = { name: string; email: string; position?: string };

interface PeopleListProps {
  title: "Teacher" | "TA" | "Classmates";
  people: Person[];
  onAdd: () => void;
}

const PeopleList: React.FC<PeopleListProps> = ({ title, people, onAdd }) => {
  return (
    <div className="mb-10 w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold">{title}</h2>

      </div>
      <hr className="border-t border-gray-300 mb-4" />

      {/* Table header */}
      <div className="flex justify-between text-gray-500 text-sm font-medium mb-2 px-2">
        <span className="w-1/3">ชื่อ</span>
        <span className="w-1/3">อีเมล</span>
        <span className="w-1/6 text-right">การจัดการ</span>
      </div>

      {/* People list */}
      {people.map((person, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm mb-2 hover:bg-gray-50"
        >
          <span className="w-1/3 text-gray-800">{person.name}</span>
          <span className="w-1/3 text-gray-600">{person.email}</span>
          <div className="w-1/6 flex justify-end items-center space-x-4">
            {!(title === "Teacher" && idx === 0) && (
              <>
                <FaEllipsisV className="text-gray-600 cursor-pointer hover:text-gray-800" />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PeopleList;
