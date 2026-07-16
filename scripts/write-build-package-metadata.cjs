const fs = require("node:fs");
const path = require("node:path");

const buildDirectory = path.join(__dirname, "..", "build");
const commonJsDirectory = path.join(buildDirectory, "cjs");

fs.mkdirSync(commonJsDirectory, { recursive: true });
fs.writeFileSync(
  path.join(buildDirectory, "package.json"),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(commonJsDirectory, "package.json"),
  `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
);
