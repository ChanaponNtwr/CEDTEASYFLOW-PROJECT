'use client';

import { useState } from 'react';
import { FaPlay, FaStepForward, FaUndo, FaRedo } from 'react-icons/fa';

export default function TopBarControls() {
  const [showPopup, setShowPopup] = useState(false);

  const togglePopup = () => setShowPopup((v) => !v);

  return (
    <div className="absolute z-1 pt-4">
      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md border border-gray-200 w-fit hover:shadow-lg transition-shadow duration-200">
        <button className="text-green-600 hover:text-green-700 text-lg p-2 rounded-full hover:bg-green-100 transition-colors">
          <FaPlay />
        </button>
        <button className="text-yellow-600 hover:text-yellow-700 text-lg p-2 rounded-full hover:bg-yellow-100 transition-colors">
          <FaStepForward />
        </button>
        <button className="text-gray-600 hover:text-gray-700 text-lg p-2 rounded-full hover:bg-gray-100 transition-colors">
          <FaUndo />
        </button>
        <button className="text-gray-600 hover:text-gray-700 text-lg p-2 rounded-full hover:bg-gray-100 transition-colors">
          <FaRedo />
        </button>
        <span
          onClick={togglePopup}
          className="ml-2 px-3 py-1 bg-blue-200 text-blue-800 text-sm font-semibold rounded-lg cursor-pointer hover:bg-blue-300 transition-colors select-none"
        >
          Problem solving
        </span>
      </div>

      {showPopup && (
        <div className="absolute z-50 w-96 h-80 rounded-xl bg-white p-3 shadow-xl border border-gray-200 ml-20 mt-3 transform translate-x-[-10%] animate-fadeIn">
          <div className="relative w-full h-full">
            <div className="text-gray-800 text-sm font-medium font-['Sarabun'] leading-snug mb-6">
              จงเขียนโปรแกรม เพื่อคํานวณหาพื้นที่ของสามเหลี่ยม <br />
              Area = 1⁄2 x ฐาน x สูง โดยมีข้อมูลเข้า (Input) <br />
              จากคีย์บอร์ด คือ ค่าของฐานของสามเหลี่ยม (b: Base) และค่าความสูงของสามเหลี่ยม (h: Height)
            </div>
            <div className="mt-6">
              <table className="w-full text-sm font-['Sarabun'] border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left border-b border-gray-300">Testcase</th>
                    <th className="p-2 text-left border-b border-gray-300">Input</th>
                    <th className="p-2 text-left border-b border-gray-300">Output</th>
                    <th className="p-2 text-left border-b border-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border-b border-gray-200">y</td>
                    <td className="p-2 border-b border-gray-200">8</td>
                    <td className="p-2 border-b border-gray-200" />
                    <td className="p-2 border-b border-gray-200"><button className="bg-yellow-500 text-white text-sm px-3 py-1 rounded-full hover:bg-yellow-600 transition-colors">Test</button></td>
                  </tr>
                  <tr>
                    <td className="p-2 border-b border-gray-200">x</td>
                    <td className="p-2 border-b border-gray-200">ลอง</td>
                    <td className="p-2 border-b border-gray-200" />
                    <td className="p-2 border-b border-gray-200"><button className="bg-yellow-500 text-white text-sm px-3 py-1 rounded-full hover:bg-yellow-600 transition-colors">Test</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button className="mt-6 bg-blue-900 text-white text-sm px-6 py-2 rounded-full hover:bg-blue-800 transition-colors absolute bottom-4 right-6">
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}