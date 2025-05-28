// save as warn-missing-type-reexports.js
const fs = require("fs");
const glob = require("glob");

glob("**/*.ts", { ignore: "node_modules/**" }, (err, files) => {
  files.forEach(file => {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, idx) => {
      // Heuristic: flags `export { Foo }` and `export { Foo as Bar }`
      if (line.match(/export\s*{\s*[^}]+\s*}/) && !line.includes("type")) {
        console.log(`[WARN] Possible missing "export type" in ${file}:${idx + 1}:`);
        console.log("  ", line.trim());
      }
    });
  });
});
