/**
 * Auto-generate README.md for project
 * -----------------------------------
 * Scans dependencies, npm scripts, source files, and Angular components.
 * Creates a structured README with setup instructions and summaries.
 *
 * Usage:
 *   node .github/scripts/generate-readme.js
 */

const fs = require("fs");
const path = require("path");

/* -----------------------------------------------------
 * Utility Functions
 * --------------------------------------------------- */

/**
 * Read and parse JSON file safely.
 */
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Recursively list all files in a directory.
 */
function listFiles(dir, base = "") {
  let out = [];
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.join(base, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      out = out.concat(listFiles(full, rel));
    } else {
      out.push(rel.replace(/\\/g, "/")); // normalize slashes
    }
  }

  return out;
}

/**
 * List top-level folders (excluding ignored directories/files).
 */
function listTopLevelFolders() {
  const ignore = new Set([
    "node_modules",
    ".git",
    ".github",
    "README.md",
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
  ]);

  if (!fs.existsSync(".")) return [];

  return fs
    .readdirSync(".")
    .filter((n) => fs.statSync(n).isDirectory() && !ignore.has(n))
    .sort();
}

/**
 * Find Angular components and extract selector + class name.
 */
function findComponents() {
  const baseDir = "src";
  const components = [];
  if (!fs.existsSync(baseDir)) return components;

  const files = listFiles(baseDir).filter((f) => f.endsWith(".component.ts"));
  for (const f of files) {
    try {
      const txt = fs.readFileSync(f, "utf8");
      const selectorMatch = txt.match(/selector\s*:\s*['"`]([^'"`]+)['"`]/m);
      const classMatch = txt.match(/export\s+class\s+(\w+)/m);
      components.push({
        file: f,
        selector: selectorMatch ? selectorMatch[1] : "",
        className: classMatch ? classMatch[1] : "",
      });
    } catch {
      // ignore parse errors
    }
  }

  return components.sort((a, b) => a.file.localeCompare(b.file));
}

/* -----------------------------------------------------
 * Data Extraction
 * --------------------------------------------------- */

const pkg = readJSON("package.json") || {};
const title = pkg.name || path.basename(process.cwd());
const desc = pkg.description || "";
const nodeVer = pkg.engines?.node || "";

let files = listFiles("src").sort();
const scripts = Object.entries(pkg.scripts || {}).sort((a, b) =>
  a[0].localeCompare(b[0])
);
const deps = Object.entries(pkg.dependencies || {}).sort((a, b) =>
  a[0].localeCompare(b[0])
);
const devDeps = Object.entries(pkg.devDependencies || {}).sort((a, b) =>
  a[0].localeCompare(b[0])
);

const isAngular =
  fs.existsSync("angular.json") ||
  deps.some(([n]) => n.startsWith("@angular/")) ||
  devDeps.some(([n]) => n.startsWith("@angular/"));

const components = findComponents();
const topFolders = listTopLevelFolders();

/* -----------------------------------------------------
 * Build README Content
 * --------------------------------------------------- */

const now = new Date().toISOString();
let content = `# ${title}\n\n`;
if (desc) content += `${desc}\n\n`;
content += `Generated: ${now}\n\n`;
if (nodeVer) content += `Node requirement: ${nodeVer}\n\n`;

/* ---------- Getting Started ---------- */
content += "## Getting started\n\n";
content += "These commands use PowerShell; adjust for bash if needed.\n\n";

content += "Install dependencies:\n\n";
content += "```powershell\nnpm ci\n```\n\n";

if (isAngular) {
  content += "Run the dev server (Angular):\n\n";
  content += "```powershell\nnpx ng serve --open\n```\n\n";
}

const startCmd = scripts.find(([name]) => /^(start|serve)$/.test(name));
if (startCmd) {
  content += "Start the app using npm script:\n\n";
  content += `\`\`\`powershell\nnpm run ${startCmd[0]}\n\`\`\`\n\n`;
}

content += "Build for production:\n\n";
content += "```powershell\n";
if (scripts.some(([name]) => /^(build|prod|prepare)$/.test(name))) {
  const build = scripts.find(([name]) =>
    /^(build|prod|prepare)$/.test(name)
  )[0];
  content += `npm run ${build}\n`;
} else if (isAngular) {
  content += "npx ng build --prod\n";
} else {
  content += "npm run build\n";
}
content += "```\n\n";

content += "Run tests:\n\n";
content += "```powershell\n";
if (scripts.some(([name]) => name === "test")) {
  content += "npm test\n";
} else {
  content += "npm run test\n";
}
content += "```\n\n";

/* ---------- npm Scripts ---------- */
content += "## Available npm scripts\n\n";
if (scripts.length === 0) {
  content += "_No scripts defined in `package.json`._\n\n";
} else {
  for (const [name, cmd] of scripts) {
    content += `- **${name}**: \`${cmd.replace(/`/g, "\\`")}\`\n`;
  }
  content += "\n";
}

/* ---------- Dependencies ---------- */
content += "## Dependencies\n\n";
if (deps.length === 0) content += "_No dependencies listed._\n\n";
else {
  for (const [n, v] of deps) content += `- \`${n}\`: ${v}\n`;
  content += "\n";
}

/* ---------- Dev Dependencies ---------- */
content += "## Dev dependencies\n\n";
if (devDeps.length === 0) content += "_No devDependencies listed._\n\n";
else {
  for (const [n, v] of devDeps) content += `- \`${n}\`: ${v}\n`;
  content += "\n";
}

/* ---------- Project Structure ---------- */
content += "## Project structure (top-level folders)\n\n";
if (topFolders.length === 0)
  content += "_No top-level folders found or repository is empty._\n\n";
else {
  for (const f of topFolders) content += `- \`${f}\`\n`;
  content += "\n";
}

/* ---------- Angular Components ---------- */
content += "## Angular components (detected)\n\n";
if (!isAngular) {
  content += "_Angular project not detected._\n\n";
} else if (components.length === 0) {
  content += "_No `*.component.ts` files detected under `src/`._\n\n";
} else {
  for (const c of components) {
    content += `- \`${c.file}\` — selector: \`${c.selector || "-"}\`, class: \`${c.className || "-"}\`\n`;
  }
  content += "\n";
}

/* ---------- Files in src ---------- */
content += "## Files in src/\n\n";
if (files.length === 0) content += "_No files found in `src/`._\n";
else {
  for (const f of files) content += `- \`${f}\`\n`;
}
content += "\n---\n\n";
// content += "This README is auto-generated by `.github/scripts/generate-readme.js` on push.\n";

/* -----------------------------------------------------
 * Write Output
 * --------------------------------------------------- */

const outPath = "README.md";
const prev = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : "";

if (prev !== content) {
  fs.writeFileSync(outPath, content, "utf8");
  console.log("✅ README.md updated");
  process.exit(0);
} else {
  console.log("ℹ️  README.md unchanged");
  process.exit(0);
}
