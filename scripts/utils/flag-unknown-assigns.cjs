// save as flag-unknown-assigns.js
const fs = require("fs");
const glob = require("glob");

glob("**/*.ts", { ignore: "node_modules/**" }, (err, files) => {
  files.forEach(file => {
    const contents = fs.readFileSync(file, "utf8");
    const unknownAssigns = contents.match(/:\s*unknown\s*;[\s\S]*?=\s*[a-zA-Z0-9_.]+;/g);
    if (unknownAssigns) {
      console.log(`[WARN] Potential unknown assignment in ${file}:`);
      unknownAssigns.forEach(a => console.log("  ", a.trim()));
    }
  });
});
