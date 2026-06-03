// Run after every Unity WebGL export: node patch-build.js
// Re-injects the 3 custom lines into the freshly overwritten index.html.

const fs   = require('fs');
const path = require('path');
const file = path.join(__dirname, 'index.html');

let html = fs.readFileSync(file, 'utf8');

const cssTag    = '<link rel="stylesheet" href="TemplateData/custom.css">';
const hookLine  = 'if (window.__onUnityLoaded) window.__onUnityLoaded(unityInstance);';
const jsTag     = '<script src="TemplateData/custom.js"></script>';

if (!html.includes(cssTag)) {
  html = html.replace(
    '<link rel="stylesheet" href="TemplateData/style.css">',
    '<link rel="stylesheet" href="TemplateData/style.css">\n    ' + cssTag
  );
  console.log('✔ Injected custom.css');
} else { console.log('  custom.css already present'); }

if (!html.includes(hookLine)) {
  html = html.replace(
    'unityInstance.SetFullscreen(1);',
    'unityInstance.SetFullscreen(1);\n                };\n                ' + hookLine + '\n              }).catch'
  );
  // Remove the duplicate }).catch that the naive replace would leave
  html = html.replace(';\n                };\n                ' + hookLine + '\n              }).catch' + '\n              }).catch',
                      ';\n                };\n                ' + hookLine + '\n              }).catch');
  console.log('✔ Injected __onUnityLoaded hook');
} else { console.log('  __onUnityLoaded hook already present'); }

if (!html.includes(jsTag)) {
  html = html.replace('</body>', '    ' + jsTag + '\n  </body>');
  console.log('✔ Injected custom.js');
} else { console.log('  custom.js already present'); }

fs.writeFileSync(file, html, 'utf8');
console.log('Done — index.html patched.');
