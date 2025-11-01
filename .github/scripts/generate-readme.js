const fs = require('fs');
const path = require('path');

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
}

function listFiles(dir, base = '') {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.join(base, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out = out.concat(listFiles(full, rel));
    } else {
      out.push(rel.replace(/\\/g, '/'));
    }
  }
  return out;
}

function listTopLevelFolders() {
  const ignore = new Set(['node_modules', '.git', '.github', 'README.md', 'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);
  return fs.existsSync('.')
    ? fs.readdirSync('.').filter(n => fs.statSync(n).isDirectory() && !ignore.has(n)).sort()
    : [];
}

function findComponents() {
  const globDir = 'src';
  const out = [];
  if (!fs.existsSync(globDir)) return out;
  const files = listFiles(globDir).filter(f => f.endsWith('.component.ts'));
  for (const f of files) {
    try {
      const txt = fs.readFileSync(f, 'utf8');
      const selectorMatch = txt.match(/selector\s*:\s*['"`]([^'"`]+)['"`]/m);
      const classMatch = txt.match(/export\s+class\s+(\w+)/m);
      out.push({ file: f, selector: selectorMatch ? selectorMatch[1] : '', className: classMatch ? classMatch[1] : '' });
    } catch (e) { /* ignore parse errors */ }
  }
  return out.sort((a,b) => a.file.localeCompare(b.file));
}

const pkg = readJSON('package.json') || {};
const title = pkg.name || path.basename(process.cwd());
const desc = pkg.description || '';
const nodeVer = pkg.engines && pkg.engines.node ? pkg.engines.node : '';
let files = listFiles('src');
files = files.sort();

const scripts = pkg.scripts ? Object.entries(pkg.scripts).sort((a,b)=>a[0].localeCompare(b[0])) : [];
const deps = pkg.dependencies ? Object.entries(pkg.dependencies).sort((a,b)=>a[0].localeCompare(b[0])) : [];
const devDeps = pkg.devDependencies ? Object.entries(pkg.devDependencies).sort((a,b)=>a[0].localeCompare(b[0])) : [];

const isAngular = fs.existsSync('angular.json') || (deps.some(d=>d[0].startsWith('@angular/')) || devDeps.some(d=>d[0].startsWith('@angular/')));
const components = findComponents();
const topFolders = listTopLevelFolders();

const now = new Date().toISOString();
let content = `# ${title}\n\n`;
if (desc) content += `${desc}\n\n`;
content += `Generated: ${now}\n\n`;

if (nodeVer) content += `Node requirement: ${nodeVer}\n\n`;

// Getting started
content += '## Getting started\n\n';
content += 'These commands use PowerShell; adjust for bash if needed.\n\n';
content += 'Install dependencies:\n\n';
content += '```powershell\n';
content += 'npm ci\n';
content += '```\n\n';

if (isAngular) {
  content += 'Run the dev server (Angular):\n\n';
  content += '```powershell\n';
  content += 'npx ng serve --open\n';
  content += '```\n\n';
}

if (scripts.length > 0) {
  // Suggest common script names
  const startCmd = scripts.find(s => s[0].match(/^(start|serve)$/)) || null;
  if (startCmd) {
    content += 'Start the app using npm script:\n\n';
    content += '```powershell\n';
    content += `npm run ${startCmd[0]}\n`;
    content += '```\n\n';
  }
}

content += 'Build for production:\n\n';
content += '```powershell\n';
if (scripts.some(s=>s[0].match(/^(build|prod|prepare)$/))) {
  const build = scripts.find(s=>s[0].match(/^(build|prod|prepare)$/))[0];
  content += `npm run ${build}\n`;
} else if (isAngular) {
  content += 'npx ng build --prod\n';
} else {
  content += 'npm run build\n';
}
content += '```\n\n';

content += 'Run tests:\n\n';
content += '```powershell\n';
if (scripts.some(s=>s[0].match(/^(test)$/))) {
  content += 'npm test\n';
} else {
  content += 'npm run test\n';
}
content += '```\n\n';

// Scripts
content += '## Available npm scripts\n\n';
if (scripts.length === 0) {
  content += '_No scripts defined in `package.json`._\n\n';
} else {
  for (const [name, cmd] of scripts) {
    content += `- **${name}**: \`${cmd.replace(/`/g,'\\`')}\`\n`;
  }
  content += '\n';
}

// Dependencies
content += '## Dependencies\n\n';
if (deps.length === 0) content += '_No dependencies listed._\n\n';
else {
  for (const [n,v] of deps) content += `- \`${n}\`: ${v}\n`;
  content += '\n';
}

content += '## Dev dependencies\n\n';
if (devDeps.length === 0) content += '_No devDependencies listed._\n\n';
else {
  for (const [n,v] of devDeps) content += `- \`${n}\`: ${v}\n`;
  content += '\n';
}

// Project structure summary
content += '## Project structure (top-level folders)\n\n';
if (topFolders.length === 0) content += '_No top-level folders found or repository is empty._\n\n';
else {
  for (const f of topFolders) content += `- \`${f}\`\n`;
  content += '\n';
}

// Components
content += '## Angular components (detected)\n\n';
if (!isAngular) {
  content += '_Angular project not detected._\n\n';
} else if (components.length === 0) {
  content += '_No `*.component.ts` files detected under `src/`._\n\n';
} else {
  for (const c of components) {
    content += `- \`${c.file}\` — selector: \`${c.selector || '-'}\`, class: \`${c.className || '-'}\`\n`;
  }
  content += '\n';
}

// Files in src
content += '## Files in src/\n\n';
if (files.length === 0) {
  content += '_No files found in `src/`_\n';
} else {
  for (const f of files) {
    content += `- \`${f}\`\n`;
  }
}

// content += '\n---\n\n';
// content += 'This README is auto-generated by `.github/scripts/generate-readme.js` on push.\n';

const outPath = 'README.md';
const prev = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;

if (prev !== content) {
  fs.writeFileSync(outPath, content, 'utf8');
  console.log('README.md updated');
  process.exit(0);
} else {
  console.log('README.md unchanged');
  process.exit(0);
}
