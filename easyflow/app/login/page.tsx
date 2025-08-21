"use client";
import Navbar from "@/components/Navbar";
import { signIn } from "next-auth/react";

function Login() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    console.log("Email:", email, "Password:", password);
    // ทำการส่งข้อมูลไปยัง API หรือ logic อื่น ๆ
  };

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage: "url('https://img5.pic.in.th/file/secure-sv1/1dac286e1af55b21b.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Navbar />
      <div className="flex items-center justify-center flex-1 relative">
        <div className="absolute inset-0 bg-black/40 rounded-lg shadow-lg overflow-hidden" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 80%, 90% 100%, 10% 100%, 0 80%)' }}></div>
        <div className="relative bg-white/20 backdrop-blur-md rounded-lg shadow-lg p-8 w-full max-w-md z-10">
          <h2 className="text-3xl font-bold text-center mb-6 text-white">LOGIN</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-white text-sm font-bold mb-2" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  name="email" // เพิ่ม name เพื่อให้ FormData ใช้งานได้
                  className="w-full px-4 py-2 bg-white/10 border border-gray-300 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400"
                  placeholder="Enter your email"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300">📧</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-white text-sm font-bold mb-2" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="password"
                  name="password" // เพิ่ม name เพื่อให้ FormData ใช้งานได้
                  className="w-full px-4 py-2 bg-white/10 border border-gray-300 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400"
                  placeholder="Enter your password"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300">👁️</span>
              </div>
              <div className="text-right mt-2">
                <a href="#" className="text-sm text-gray-300 hover:underline">
                  Forget Password
                </a>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-orange-500 text-white py-2.5 rounded-lg hover:bg-orange-600 transition duration-200 font-semibold"
            >
              Login
            </button>
          </form>

          <div className="text-center mt-6">
            <a className="text-sm text-gray-300">
              Add other accounts
            </a>
          </div>

          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => {
                console.log("Clicked signIn Google");
                signIn("google", { callbackUrl: "/profile" });
              }}
              className="p-2 bg-white/20 rounded-full shadow hover:shadow-lg"
              aria-label="Login with Google"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
            </button>
            <button className="p-2 bg-white/20 rounded-full shadow hover:shadow-lg">
              <span className="text-blue-300 text-xl">📧</span>
            </button>
            <button className="p-2 bg-white/20 rounded-full shadow hover:shadow-lg">
              <img src="https://www.facebook.com/favicon.ico" alt="Facebook" className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;