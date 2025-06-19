import { useEffect, useState } from "react";

export function VerifyCSSLoading() {
  const [cssStatus, setCssStatus] = useState({
    stylesheets: 0,
    tailwindFound: false,
    primaryColor: "",
    testResults: {} as Record<string, boolean>,
  });

  useEffect(() => {
    // Count stylesheets
    const styleSheets = document.querySelectorAll(
      'link[rel="stylesheet"], style',
    );

    // Test Tailwind classes
    const tests = {
      "bg-primary": false,
      "text-white": false,
      "rounded-lg": false,
      "shadow-md": false,
      "p-4": false,
    };

    // Create test elements
    Object.keys(tests).forEach((className) => {
      const testEl = document.createElement("div");
      testEl.className = className;
      document.body.appendChild(testEl);
      const computed = window.getComputedStyle(testEl);

      // Check if styles are applied
      if (className === "bg-primary") {
        tests[className] = computed.backgroundColor === "rgb(79, 70, 229)"; // #4F46E5
      } else if (className === "text-white") {
        tests[className] = computed.color === "rgb(255, 255, 255)";
      } else if (className === "rounded-lg") {
        tests[className] = computed.borderRadius !== "0px";
      } else if (className === "shadow-md") {
        tests[className] = computed.boxShadow !== "none";
      } else if (className === "p-4") {
        tests[className] = computed.padding === "16px";
      }

      document.body.removeChild(testEl);
    });

    // Get primary color
    const rootStyles = getComputedStyle(document.documentElement);
    const primaryColor = rootStyles.getPropertyValue("--primary") || "not set";

    setCssStatus({
      stylesheets: styleSheets.length,
      tailwindFound: Object.values(tests).some((v) => v),
      primaryColor,
      testResults: tests,
    });
  }, []);

  return (
    <div className="fixed bottom-4 left-4 bg-black text-white p-4 rounded-lg max-w-sm z-50">
      <h3 className="font-bold mb-2">CSS Status</h3>
      <div className="text-sm space-y-1">
        <div>Stylesheets: {cssStatus.stylesheets}</div>
        <div>Tailwind: {cssStatus.tailwindFound ? "✅" : "❌"}</div>
        <div>Primary Color: {cssStatus.primaryColor}</div>
        <div className="mt-2">
          <div className="font-semibold">Class Tests:</div>
          {Object.entries(cssStatus.testResults).map(([cls, works]) => (
            <div key={cls} className="ml-2">
              {cls}: {works ? "✅" : "❌"}
            </div>
          ))}
        </div>
      </div>

      {/* Visual test of actual Tailwind classes */}
      <div className="mt-4 space-y-2">
        <div className="bg-primary text-white p-2 rounded">
          Primary Button Test
        </div>
        <div className="bg-blue-500 text-white p-2 rounded">Blue-500 Test</div>
      </div>
    </div>
  );
}
