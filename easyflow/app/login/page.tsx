"use client";
import Navbar from "@/components/Navbar";
import { signIn } from "next-auth/react";
import Image from "next/image";

function Login() {
  return (
    <div 
      className="min-h-screen flex flex-col"
    >
              <Image
                src="/images/Login.png"
                alt="Background"
                fill
                className="object-cover"
                priority
              />
      <Navbar />
      <div className="flex items-center justify-center flex-1 relative">
        
        <div className="relative bg-white/20 backdrop-blur-md rounded-lg shadow-lg p-8 w-full max-w-md z-10">
          <h2 className="text-3xl font-bold text-center mb-6 text-white bo">Login</h2>
          
          <div className="space-y-4">
            <button
              onClick={() => signIn("google", { callbackUrl: "/profile" })}
              className="text-xl w-full bg-white text-[#757575] py-2.5 rounded-lg flex items-center justify-start gap-5 pl-4 cursor-pointer transition duration-200 font-semibold"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-10 h-10" />
              Continue with Google
            </button>

            <button
              className="text-xl w-full bg-[#0866FF] text-white py-2.5 rounded-lg flex items-center justify-start gap-5 pl-4 cursor-pointer transition duration-200 font-semibold"
            >
              <img src="https://www.facebook.com/favicon.ico" alt="Facebook" className="w-10 h-10" />
              Continue with Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;