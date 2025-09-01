"use client";
import { FaUser, FaBook } from "react-icons/fa";
import { motion } from "framer-motion";
import Link from "next/link";

const teachingItemVariants = {
  hover: { 
    scale: 1.03,
    background: "linear-gradient(90deg, rgba(59,130,246,0.15), rgba(59,130,246,0.1))",
    boxShadow: "0px 2px 6px rgba(0,0,0,0.1)",
    x: 2,
    transition: { type: "spring", stiffness: 250 },
  },
};

const enrolledItemVariants = {
  hover: { 
    scale: 1.03,
    background: "linear-gradient(90deg, rgba(16,185,129,0.15), rgba(16,185,129,0.1))",
    boxShadow: "0px 2px 6px rgba(0,0,0,0.1)",
    x: 2,
    transition: { type: "spring", stiffness: 250 },
  },
};

const iconVariants = {
  hover: { rotate: 20, transition: { type: "spring", stiffness: 300 } },
};

function Sidebar() {
  return (
    <div className="w-64 h-screen bg-white shadow-md p-4 fixed left-0 top-20 overflow-y-auto">
      {/* TEACHING Section */}
      <div className="mb-6">
        <div className="flex items-center mb-2 bg-blue-600 px-2 py-3 rounded">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mr-2">
            <FaUser className="text-blue-600 w-4 h-4" />
          </div>
          <h3 className="text-white font-semibold">TEACHING</h3>
        </div>
        <ul>
          <Link href="Classwork" passHref legacyBehavior>
            <motion.li
              className="flex items-center mb-2 px-2 py-1 rounded cursor-pointer text-gray-700 font-medium"
              whileHover="hover"
              variants={teachingItemVariants}
            >
              <motion.span 
                className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2 text-white text-xs font-semibold"
                variants={iconVariants}
              >
                P
              </motion.span>
              OOP-53
            </motion.li>
          </Link>

          <Link href="Classwork" passHref legacyBehavior>
            <motion.li
              className="flex items-center mb-2 px-2 py-1 rounded cursor-pointer text-gray-700 font-medium"
              whileHover="hover"
              variants={teachingItemVariants}
            >
              <motion.span 
                className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2 text-white text-xs font-semibold"
                variants={iconVariants}
              >
                P
              </motion.span>
              Soft Dev-53
            </motion.li>
          </Link>
        </ul>
      </div>

      {/* ENROLLED Section */}
      <div>
        <div className="flex items-center mb-2 bg-blue-600 px-2 py-3 rounded">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mr-2">
            <FaBook className="text-blue-600 w-4 h-4" />
          </div>
          <h3 className="text-white font-semibold">ENROLLED</h3>
        </div>
        <ul>
          <Link href="Classstudent" passHref legacyBehavior>
            <motion.li
              className="flex items-center mb-2 px-2 py-1 rounded cursor-pointer text-gray-700 font-medium"
              whileHover="hover"
              variants={enrolledItemVariants}
            >
              <motion.span 
                className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2 text-white text-xs font-semibold"
                variants={iconVariants}
              >
                Ch
              </motion.span>
              IST
            </motion.li>
          </Link>

          <Link href="Classstudent" passHref legacyBehavior>
            <motion.li
              className="flex items-center mb-2 px-2 py-1 rounded cursor-pointer text-gray-700 font-medium"
              whileHover="hover"
              variants={enrolledItemVariants}
            >
              <motion.span 
                className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2 text-white text-xs font-semibold"
                variants={iconVariants}
              >
                De
              </motion.span>
              humen
            </motion.li>
          </Link>
        </ul>
      </div>
    </div>
  );
}

export default Sidebar;
