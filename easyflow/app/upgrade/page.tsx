import React from "react";
import Navbar from "@/components/Navbar";

/**
 * Upgrade / Pricing page tailored for an LMS (Learning Management System).
 * Background changed to solid white as requested.
 *
 * Place this component in your Next.js route (e.g. app/upgrade/page.tsx).
 */

export default function UpgradePage() {
  

  const plans = [
    {
      title: "Starter",
      subtitle: "For small classrooms",
      price: "฿500",
      period: "/ year",
      desc: "Up to 70 students • Basic course tools",
      highlight: false,
      features: ["Create unlimited courses", "Student roster", "Basic quizzes"],
    },
    {
      title: "Instructor",
      subtitle: "For active teachers",
      price: "฿900",
      period: "/ year",
      desc: "Up to 100 students • Grading & analytics",
      highlight: true,
      features: ["Advanced quizzes & grading", "Attendance & reports", "CSV export"],
    },
    {
      title: "Institution",
      subtitle: "For schools & academies",
      price: "฿1299",
      period: "/ year",
      desc: "Unlimited students • Team admin",
      highlight: false,
      features: ["SAML/SSO & teams", "Priority support", "Custom integrations"],
    },
  ];

  return (
    <main className="min-h-screen relative bg-white text-gray-900 antialiased">
     <div className="pt-20  transition-all duration-300">
        <Navbar />
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="text-center mb-12">
          {/* Title with logo placed to the left of the text "Easy Flow LMS" */}
          <div className="mb-4 flex flex-col items-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-4">

              <span>Easy Flow</span>
            </h1>

            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
              A lightweight learning management platform for teachers and institutions.
            </p>
          </div>

          <p className="mx-auto max-w-2xl text-gray-600">
            Empower your classroom with course creation, quizzes, grading, attendance and analytics — pick a plan that suits your needs.
          </p>
        </header>

        {/* Pricing cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((p) => (
            <article
              key={p.title}
              className={`relative rounded-2xl px-6 py-8 shadow-sm border transition-transform transform hover:-translate-y-1 ${p.highlight ? "ring-2 ring-indigo-200 bg-white" : "bg-gray-50 border-gray-200"
                }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{p.title}</h3>
                  <div className="text-xs text-gray-500">{p.subtitle}</div>
                </div>
                {p.highlight && <div className="text-xs px-3 py-1 rounded-full bg-indigo-600 text-white font-medium">Recommended</div>}
              </div>

              <div className="mb-4">
                <div className="flex items-end gap-3">
                  <div className="text-3xl sm:text-4xl font-extrabold text-gray-900">{p.price}</div>
                  <div className="text-sm text-gray-500 mb-1">{p.period}</div>
                </div>
                <div className="text-sm text-gray-600 mt-2">{p.desc}</div>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
                <li className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 8v12h12V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Secure payments & GDPR-ready
                </li>
              </ul>

              <div className="mt-6 flex items-center justify-between gap-4">
                <button
                  className={`flex-1 py-2 rounded-full font-semibold transition ${p.highlight ? "bg-orange-600 hover:bg-orange-700 text-white shadow-md" : "bg-white border border-gray-200 hover:bg-gray-100 text-gray-900"
                    }`}
                >
                  Start free trial
                </button>
                <div className="text-right text-xs text-gray-500">Billed yearly</div>
              </div>
            </article>
          ))}
        </section>

        {/* Features / LMS highlights */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-2 text-gray-900">Course Builder</h4>
            <p className="text-sm text-gray-600">Drag & drop content, create modules, attach resources and set prerequisites.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-2 text-gray-900">Assessment & Grading</h4>
            <p className="text-sm text-gray-600">Multiple question types, auto-grading and manual review with gradebook export.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold mb-2 text-gray-900">Analytics</h4>
            <p className="text-sm text-gray-600">Student progress, engagement and attendance reports to help you improve outcomes.</p>
          </div>
        </section>

        {/* CTA area */}
        <section className="mt-10 bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">Need help choosing?</div>
            <div className="text-sm text-gray-600 mt-1">Talk to our education specialists — setup assistance and site migration available.</div>
          </div>

          <div className="flex gap-3">
            <button className="px-5 py-2 rounded-full bg-white border border-gray-200 text-gray-900 hover:bg-gray-100">Contact sales</button>
            <button className="px-5 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700">Start 14-day trial</button>
          </div>
        </section>

        <footer className="mt-8 text-center text-xs text-gray-500">Pricing shown in THB. Taxes may apply. Cancel anytime. Educational discount available for institutions.</footer>
      </div>
    </div>
    </main>
  );
}
