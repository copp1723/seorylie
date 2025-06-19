#!/usr/bin/env tsx

console.log("🔍 Production Environment Check\n");

// Check critical environment variables
const requiredEnvVars = ["NODE_ENV", "PORT", "DATABASE_URL", "SESSION_SECRET"];

const optionalEnvVars = ["OPENAI_API_KEY", "SENDGRID_API_KEY", "REDIS_URL"];

console.log("📋 Required Environment Variables:");
requiredEnvVars.forEach((varName) => {
  const value = process.env[varName];
  const status = value ? "✅" : "❌";
  const display = value
    ? varName === "SESSION_SECRET" || varName === "DATABASE_URL"
      ? "[HIDDEN]"
      : value
    : "NOT SET";
  console.log(`  ${varName}: ${status} ${display}`);
});

console.log("\n📋 Optional Environment Variables:");
optionalEnvVars.forEach((varName) => {
  const value = process.env[varName];
  const status = value ? "✅" : "⚠️";
  const display = value ? "[SET]" : "NOT SET";
  console.log(`  ${varName}: ${status} ${display}`);
});

console.log("\n🚀 Server Configuration:");
console.log(`  NODE_ENV: ${process.env.NODE_ENV || "development"}`);
console.log(`  PORT: ${process.env.PORT || "3000"}`);
console.log(`  HOST: ${process.env.HOST || "0.0.0.0"}`);

// Check if we're in production mode
if (process.env.NODE_ENV === "production") {
  console.log("\n✅ Running in production mode");

  // Check static file paths
  const path = require("path");
  const fs = require("fs");

  const __dirname = process.cwd();
  const publicPath = path.join(__dirname, "dist/public");
  const indexPath = path.join(publicPath, "index.html");

  console.log("\n📁 Production File Paths:");
  console.log(`  Current directory: ${__dirname}`);
  console.log(`  Public path: ${publicPath}`);
  console.log(`  Index exists: ${fs.existsSync(indexPath) ? "✅" : "❌"}`);

  if (fs.existsSync(publicPath)) {
    const files = fs.readdirSync(publicPath, { recursive: true });
    console.log(`  Total files: ${files.length}`);
  }
} else {
  console.log("\n⚠️  Not running in production mode");
}

console.log("\n🔧 Debugging Commands:");
console.log("  Check logs: docker logs <container-name>");
console.log("  Test API: curl https://your-domain.com/api/test");
console.log("  Test user: curl https://your-domain.com/api/user");
console.log(
  "  Check static: curl -I https://your-domain.com/assets/index-*.js",
);
