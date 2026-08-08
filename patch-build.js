// Run after every Unity WebGL export: node patch-build.js
// 1. Copies custom_override/ files into the build folder.
// 2. Re-injects the 3 custom lines into the freshly overwritten index.html.

const fs   = require('fs');
const path = require('path');
const root = __dirname;

// ── Step 1: Copy custom_override files ───────────────────────────────────────
const overrideDir = path.join(root, 'custom_override');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src,  entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✔ Copied  ${path.relative(root, destPath)}`);
    }
  }
}

if (fs.existsSync(overrideDir)) {
  copyDir(overrideDir, root);
  console.log('');
} else {
  console.warn('  custom_override/ not found — skipping file copy');
}

// ── Step 2: Patch index.html ──────────────────────────────────────────────────
const file = path.join(root, 'index.html');
let html = fs.readFileSync(file, 'utf8');

const cssTag   = '<link rel="stylesheet" href="TemplateData/custom.css">';
const hookLine = 'if (window.__onUnityLoaded) window.__onUnityLoaded(unityInstance);';
const jsTag    = '<script src="TemplateData/custom.js"></script>';

if (!html.includes(cssTag)) {
  html = html.replace(
    '<link rel="stylesheet" href="TemplateData/style.css">',
    '<link rel="stylesheet" href="TemplateData/style.css">\n    ' + cssTag
  );
  console.log('✔ Injected custom.css link');
} else { console.log('  custom.css already present'); }

// Anchor on 'loadingBar.style.display = "none";' inside the .then() callback —
// works across Unity template versions (the older 'unityInstance.SetFullscreen(1);'
// anchor doesn't exist in Unity 6's default WebGL template and silently no-ops,
// which is why this hook kept vanishing after every rebuild).
const thenAnchor = 'loadingBar.style.display = "none";';
if (!html.includes(hookLine)) {
  if (html.includes(thenAnchor)) {
    html = html.replace(thenAnchor, thenAnchor + '\n          ' + hookLine);
    console.log('✔ Injected __onUnityLoaded hook');
  } else {
    console.warn('✘ __onUnityLoaded hook anchor not found — hook NOT injected. Check index.html manually.');
  }
} else { console.log('  __onUnityLoaded hook already present'); }

if (!html.includes(jsTag)) {
  html = html.replace('</body>', '    ' + jsTag + '\n  </body>');
  console.log('✔ Injected custom.js script');
} else { console.log('  custom.js already present'); }

fs.writeFileSync(file, html, 'utf8');
console.log('\nDone — build patched.');
