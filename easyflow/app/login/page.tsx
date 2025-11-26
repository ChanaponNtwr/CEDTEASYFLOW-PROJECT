"use client";
import Navbar from "@/components/Navbar";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function Login() {
  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Background */}
      <div className="absolute inset-0">
        <Image
          src="/images/Login.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"></div>
      </div>

      <Navbar />

      {/* Content */}
      <div className="flex justify-center items-center flex-1 relative z-10 px-4">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 
                        shadow-xl rounded-2xl p-10 w-full max-w-md">
          
          <h2 className="text-4xl font-bold text-center mb-8 text-white drop-shadow-lg">
            Login
          </h2>

          <div className="space-y-5">
            {/* Google Button */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/profile" })}
              className="w-full py-3 text-lg font-semibold bg-white text-[#5f5f5f] 
                         rounded-xl flex items-center justify-center gap-4 shadow-md
                         hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] 
                         transition-all cursor-pointer"
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                className="w-7 h-7"
              />
              Continue with Google
            </button>

            {/* Facebook future button */}
            {/* 
            <button className="w-full py-3 text-lg font-semibold bg-[#1877F2] text-white 
                               rounded-xl flex items-center justify-center gap-4 shadow-md
                               hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
              <img
                src="https://www.facebook.com/favicon.ico"
                className="w-7 h-7"
              />
              Continue with Facebook
            </button>
            */}
          </div>
        </div>
      </div>
    </div>
  );
}
