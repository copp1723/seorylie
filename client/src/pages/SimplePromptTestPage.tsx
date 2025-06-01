import React from "react";
import SimplePromptTest from "@/components/simple-prompt-test";

export default function SimplePromptTestPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">
            Automotive Sales Agent Prompt Testing
          </h1>
          <SimplePromptTest />
        </div>
      </div>
    </div>
  );
}
