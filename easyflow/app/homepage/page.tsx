"use client";
import Navbar from '@/components/Navbar';

export default function Home() {
  return (
    <div className="pt-20 min-h-screen text-white relative overflow-hidden">
      <video
        autoPlay
        muted
        loop
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
        style={{ minHeight: '100vh' }}
      >
        <source src="https://assets.mixkit.co/videos/preview/mixkit-abstract-geometric-shapes-background-993-large.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <Navbar />
      <header className="flex flex-col items-start justify-center h-screen text-left pl-10 relative z-10 bg-black bg-opacity-50">
        <h1 className="text-5xl font-bold">Create Flowcharts<br />In Minutes!</h1>
        <p className="mt-4 text-lg">Easily Visualize Processes, Workflows, And Ideas With<br />Our Intuitive Drag-And-Drop Editor</p>
        <button className="mt-6 px-6 py-3 bg-yellow-500 text-white rounded-full hover:bg-yellow-600">Get Started</button>
        <p className="mt-2 text-sm">Get Started for Free</p>
      </header>
    </div>
  );
}