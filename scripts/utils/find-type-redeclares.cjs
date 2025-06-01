// save as find-type-redeclares.js
const fs = require("fs");
const glob = require("glob");

glob("**/*.d.ts", { ignore: "node_modules/**" }, (err, files) => {
  if (err) throw err;
  const propMap = {};
  files.forEach(file => {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, idx) => {
      const match = line.match(/(\w+)\??:\s*([^;]+);/);
      if (match) {
        const [_, prop, type] = match;
        if (!propMap[prop]) propMap[prop] = [];
        propMap[prop].push({ type: type.trim(), file, line: idx + 1 });
      }
    });
  });
  Object.keys(propMap).forEach(prop => {
    if (propMap[prop].length > 1) {
      const types = [...new Set(propMap[prop].map(e => e.type))];
      if (types.length > 1) {
        console.log(`\n[WARN] Property "${prop}" declared with different types:`);
        propMap[prop].forEach(e => {
          console.log(`  - ${e.type} in ${e.file}:${e.line}`);
        });
      }
    }
  });
});
