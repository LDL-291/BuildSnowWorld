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

// ── Step 1.5: Auto-bump ServiceWorker cacheVersion from Build/* content hash ──
// The SW's fetch handler is cache-first with no revalidation (see ServiceWorker.js
// comment) — a stale cacheName means browsers serve old Build/*.br bytes forever
// regardless of what's redeployed. Deriving cacheVersion from a hash of the actual
// Build/* files means it only changes when those bytes actually change, and it can
// never be forgotten before a production deploy the way a manually-edited version
// string can.
const crypto = require('crypto');
const swPath = path.join(root, 'ServiceWorker.js');

if (fs.existsSync(swPath)) {
  let swSrc = fs.readFileSync(swPath, 'utf8');

  const contentToCacheMatch = swSrc.match(/const contentToCache = \[([\s\S]*?)\];/);
  const cachedFiles = contentToCacheMatch
    ? [...contentToCacheMatch[1].matchAll(/"([^"]+)"/g)].map(m => m[1])
    : [];
  // Per-texture-format variants live in Build/<dxt|astc|etc2>/ (see index.html picker).
  // The cache key hashes every variant so a change to any of them busts the cache.
  const buildFiles = [];
  for (const v of ['dxt', 'astc', 'etc2']) {
    const dir = path.join(root, 'Build', v);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.br') || f.endsWith('.js')) buildFiles.push(`Build/${v}/${f}`);
    const sa = path.join(dir, 'StreamingAssets', 'aa', 'catalog.hash');
    if (fs.existsSync(sa)) buildFiles.push(`Build/${v}/StreamingAssets/aa/catalog.hash`);
  }
  // The worker caches every response cache-first (index.html and TemplateData included), so changes to
  // the page template or the patch logic must also change the cache key or returning visitors keep the old page.
  for (const f of ['patch-build.js', 'custom_override/TemplateData/custom.js', 'custom_override/TemplateData/custom.css', 'custom_override/ServiceWorker.js']) buildFiles.push(f);

  if (buildFiles.length === 0) {
    console.warn('  Could not find Build/* entries in ServiceWorker.js contentToCache — skipping cacheVersion bump');
  } else {
    const hash = crypto.createHash('sha256');
    let missing = false;
    for (const rel of buildFiles) {
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs)) {
        console.warn(`  Build file referenced by ServiceWorker.js missing: ${rel} — skipping cacheVersion bump`);
        missing = true;
        break;
      }
      // The service worker source holds the cacheVersion line itself; hash it without that line so the key
      // only changes when the worker's logic changes, not every time the key is written.
      hash.update(rel.endsWith('ServiceWorker.js')
        ? fs.readFileSync(abs, 'utf8').replace(/const cacheVersion = "[^"]*";/, '')
        : fs.readFileSync(abs));
    }

    if (!missing) {
      const newVersion = hash.digest('hex').slice(0, 12);
      const versionRegex = /const cacheVersion = "([^"]*)";/;
      const oldMatch = swSrc.match(versionRegex);
      const oldVersion = oldMatch ? oldMatch[1] : null;

      if (oldVersion === newVersion) {
        console.log(`  cacheVersion unchanged (${newVersion}) — Build/* content identical to last patch`);
      } else {
        swSrc = swSrc.replace(versionRegex, `const cacheVersion = "${newVersion}";`);
        fs.writeFileSync(swPath, swSrc, 'utf8');
        // Keep custom_override/ (the source of truth copied on the next run) in sync
        // too, so a diff against it doesn't show a false "drift".
        const overrideSwPath = path.join(overrideDir, 'ServiceWorker.js');
        if (fs.existsSync(overrideSwPath)) {
          fs.writeFileSync(overrideSwPath, swSrc, 'utf8');
        }
        console.log(`✔ Bumped cacheVersion: ${oldVersion || '(none)'} → ${newVersion}`);
      }
    }
  }
  console.log('');
} else {
  console.warn('  ServiceWorker.js not found — skipping cacheVersion bump');
}

// ── Step 2: Patch index.html ──────────────────────────────────────────────────
const file = path.join(root, 'index.html');
const FORMAT_PICKER = `var buildUrl = "Build/" + (function () {
        // Pick the GPU texture format this browser can sample natively: ASTC on mobile, DXT (S3TC) on
        // desktop, ETC2 as the fallback. The matching player build lives in Build/<format>/.
        try {
          var c = document.createElement('canvas');
          var gl = c.getContext('webgl2') || c.getContext('webgl');
          if (!gl) return 'etc2';
          var has = function (n) { return !!(gl.getExtension(n) || gl.getExtension('WEBKIT_' + n) || gl.getExtension('MOZ_' + n)); };
          var mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (mobile && has('WEBGL_compressed_texture_astc')) return 'astc';
          if (has('WEBGL_compressed_texture_s3tc')) return 'dxt';
          if (has('WEBGL_compressed_texture_astc')) return 'astc';
          return 'etc2';
        } catch (e) { return 'etc2'; }
      })();
      window.__texFmt = buildUrl.split('/')[1]; // read by the game to pick the matching Addressables set`;
let html = fs.readFileSync(file, 'utf8');

if (html.includes('var buildUrl = "Build";')) {
  html = html.replace('var buildUrl = "Build";', () => FORMAT_PICKER);
  console.log('✔ Injected texture-format picker');
} else { console.log('  texture-format picker already present'); }
// Local Addressables bundles in StreamingAssets/aa are texture-format specific too, so each variant
// carries its own copy next to its player: Build/<format>/StreamingAssets.
if (html.includes('streamingAssetsUrl: "StreamingAssets"')) {
  html = html.replace('streamingAssetsUrl: "StreamingAssets"', 'streamingAssetsUrl: buildUrl + "/StreamingAssets"');
  console.log('✔ streamingAssetsUrl -> per-format folder');
}
if (html.includes('var buildUrl = "Build/"') && !html.includes('window.__texFmt')) {
  html = html.replace(/\}\)\(\);(\s*)var loaderUrl/, (m, ws) => "})();" + ws + "window.__texFmt = buildUrl.split('/')[1]; // read by the game to pick the matching Addressables set" + ws + "var loaderUrl");
  console.log('✔ Added window.__texFmt');
}

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

// ── AdSense content requirements ──────────────────────────────────────────
// A bare Unity canvas page has no crawlable text, which trips AdSense's
// "Google-served ads on screens without publisher-content / Low value
// content" review flag. Inject a real <title>/meta description and a
// visible content block (heading, description, how-to-play text) around
// the game container so the page reads as actual content, not just a canvas.
const titleTag = '<title>Snow World – Free Online Sled Physics Game | Arghorithm</title>';
if (!html.includes(titleTag)) {
  html = html.replace(/<title>.*<\/title>/, titleTag);
  console.log('✔ Updated <title>');
} else { console.log('  title already present'); }

const metaDescTag = '<meta name="description" content="Play Snow World, a free browser-based sled physics game by Arghorithm. Race down snowy slopes, collect stars, and climb the online leaderboard — no download required.">';
if (!html.includes('name="description"')) {
  html = html.replace(titleTag, titleTag + '\n    ' + metaDescTag);
  console.log('✔ Injected meta description');
} else { console.log('  meta description already present'); }

const adsenseAccountTag = '<meta name="google-adsense-account" content="ca-pub-2272798159327207">';
if (!html.includes('google-adsense-account')) {
  const adsenseHead = `${adsenseAccountTag}
    <script>
      (function () {
        var consent = localStorage.getItem('ad_consent');
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.requestNonPersonalizedAds = consent === 'personalized' ? 0 : 1;
      })();
    </script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2272798159327207" crossorigin="anonymous"></script>`;
  html = html.replace('</head>', '    ' + adsenseHead + '\n  </head>');
  console.log('✔ Injected AdSense account script + consent gate');
} else { console.log('  AdSense account script already present'); }

const contentStart = '<!-- ADSENSE-CONTENT-START -->';
const contentEnd   = '<!-- ADSENSE-CONTENT-END -->';
if (!html.includes(contentStart)) {
  html = html.replace('<div id="unity-container">', contentStart + '\n    <div id="unity-container">');

  const footerBlock = `    <header id="page-header">
      <h1>Snow World</h1>
      <p>A free physics-based sledding game. Race down the mountain, dodge obstacles, collect stars and lightning bolts, and set your best time on the global leaderboard.</p>
    </header>
    <footer id="page-footer">
      <h2>How to play</h2>
      <p>Steer your sled using the on-screen controls or arrow keys, collect stars along the track, and avoid crashing to keep your run alive. Compare your score against other players on the leaderboard after each run.</p>
      <p><a href="https://arghorithm.com/">&larr; Back to Arghorithm</a> &nbsp;&middot;&nbsp; <a href="https://arghorithm.com/privacy-policy.html">Privacy Policy</a> &nbsp;&middot;&nbsp; <a href="https://arghorithm.com/terms-of-service.html">Terms of Service</a></p>
      <ins class="adsbygoogle"
           style="display:block"
           data-ad-client="ca-pub-2272798159327207"
           data-ad-slot="5463795806"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </footer>
    ${contentEnd}`;
  html = html.replace('</div>\n    <script>', '</div>\n' + footerBlock + '\n    <script>');
  console.log('✔ Injected visible content block (header/footer)');
} else { console.log('  content block already present'); }

fs.writeFileSync(file, html, 'utf8');
console.log('\nDone — build patched.');
