// save as check-imports.js
const fs = require("fs");
const glob = require("glob");
const path = require("path");

glob("**/*.ts", { ignore: "node_modules/**" }, (err, files) => {
  files.forEach(file => {
    const contents = fs.readFileSync(file, "utf8");
    const importRegex = /import\s*{\s*([A-Za-z0-9_,\s]+)\s*}\s*from\s*['"](.+)['"]/g;
    let match;
    while ((match = importRegex.exec(contents))) {
      const names = match[1].split(",").map(x => x.trim());
      let importFile = match[2];
      if (!importFile.startsWith(".")) continue; // only check local
      let resolved = importFile;
      if (!resolved.endsWith(".ts")) resolved += ".ts";
      if (!fs.existsSync(path.join(path.dirname(file), resolved))) continue;
      const importedContents = fs.readFileSync(path.join(path.dirname(file), resolved), "utf8");
      names.forEach(name => {
        if (!new RegExp(`(export (const|function|type|interface|class) ${name}\\b)`).test(importedContents)) {
          console.log(`[WARN] ${name} imported in ${file} but not found in ${resolved}`);
        }
      });
    }
  });
});
