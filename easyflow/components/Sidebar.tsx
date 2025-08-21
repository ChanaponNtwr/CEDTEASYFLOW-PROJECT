import { FaUser, FaBook } from 'react-icons/fa'; // นำเข้าไอคอนจาก react-icons

function Sidebar() {
  return (
    <div className="w-64 h-full bg-white shadow-md  p-4">
      {/* TEACHING Section */}
      <div className="mb-6">
        <div className="flex items-center mb-2 bg-blue-600 px-2 py-3 rounded">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mr-2">
            <FaUser className="text-blue-600 w-4 h-4" />
          </div>
          <h3 className="text-white font-semibold">TEACHING</h3>
        </div>
        <ul>
          <li className="flex items-center mb-2 hover:bg-blue-100 hover:text-blue-600 px-2 py-1 rounded transition-colors duration-200">
            <span className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2 text-white text-xs font-semibold">
              P
            </span>
            <a
              href="#"
              className="text-gray-700 "
            >
              Project-Flowchart1
            </a>
          </li>
          <li className="flex items-center mb-2 hover:bg-blue-100 hover:text-blue-600 px-2 py-1 rounded transition-colors duration-200">
            <span className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2 text-white text-xs font-semibold">
              P
            </span>
            <a
              href="#"
              className="text-gray-700 "
            >
              Project-Flowchart2
            </a>
          </li>
        </ul>
      </div>

      {/* ENROLLED Section */}
     
        <div className="flex items-center mb-2 bg-blue-600 px-2 py-3 rounded">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mr-2">
            <FaBook className="text-blue-600 w-4 h-4" />
          </div>
          <h3 className="text-white font-semibold">ENROLLED</h3>
        </div>
        <ul>
          <li className="flex items-center mb-2 hover:bg-blue-100 hover:text-blue-600 px-2 py-1 rounded transition-colors duration-200">
            <span className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2 text-white text-xs font-semibold">
              P
            </span>
            <a
              href="#"
              className="text-gray-700"
            >
              Project-Flowchart3
            </a>
          </li>
          <li className="flex items-center mb-2 hover:bg-blue-100 hover:text-blue-600 px-2 py-1 rounded transition-colors duration-200">
            <span className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2 text-white text-xs font-semibold">
              P
            </span>
            <a
              href="#"
              className="text-gray-700 "
            >
              Project-Flowchart4
            </a>
          </li>
          <li className="flex items-center mb-2 hover:bg-blue-100 hover:text-blue-600 px-2 py-1 rounded transition-colors duration-200">
            <span className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2 text-white text-xs font-semibold">
              P
            </span>
            <a
              href="#"
              className="text-gray-700 "
            >
              Project-Flowchart5
            </a>
          </li>
          <li className="flex items-center mb-2 hover:bg-blue-100 hover:text-blue-600 px-2 py-1 rounded transition-colors duration-200">
            <span className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-2 text-white text-xs font-semibold">
              P
            </span>
            <a
              href="#"
              className="text-gray-700 "
            >
              Project-Flowchart6
            </a>
          </li>
        </ul>
      </div>
    
  );
}

export default Sidebar;