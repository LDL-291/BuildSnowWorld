(function () {

  // ── Config ────────────────────────────────────────────────────────────────
  var CONFIG = {
    unityGameObject : 'ResponsiveManager',
    unityMethod     : 'OnBrowserResize',
    referenceAspect : 16 / 9,
    maxPixelRatio   : 2,
    mobileScale     : 0.8,
    resizeDebounce  : 10,
  };

  var unityInstance = null;

  // ── DOM injection ─────────────────────────────────────────────────────────
  var barEmpty = document.getElementById('unity-progress-bar-empty');
  var flash    = document.createElement('div');
  flash.id     = 'bar-flash';
  barEmpty.appendChild(flash);

  var loadingBar = document.getElementById('unity-loading-bar');
  var wrap       = document.createElement('div');
  wrap.id        = 'load-star-wrap';
  var star       = document.createElement('span');
  star.id        = 'load-star';
  star.textContent = '⭐';
  wrap.appendChild(star);
  loadingBar.appendChild(wrap);

  // ── Responsive canvas (absorbs inline resizeCanvas + unity-responsive.js) ─
  var canvas    = document.getElementById('unity-canvas');
  var container = document.getElementById('unity-container');

  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function resizeCanvas() {
    if (!canvas) return;

    var mobile = isMobile();
    var w, h;

    if (mobile) {
      // Let .unity-mobile CSS and Unity itself handle everything on mobile
      return;
    }

    var fs = !!document.fullscreenElement;
    w = fs ? window.innerWidth  : window.innerWidth  - 200;
    h = fs ? window.innerHeight : window.innerHeight - 100;

    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';

    if (container) {
      container.style.width = w + 'px';
    }

    // sendResizeToUnity disabled — ResponsiveManager not wired for external calls
    // sendResizeToUnity(w, h);
  }

  function sendResizeToUnity(w, h) {
    if (!unityInstance) return;
    var aspect = w / h;
    try {
      unityInstance.SendMessage(
        CONFIG.unityGameObject,
        CONFIG.unityMethod,
        JSON.stringify({
          width       : w,
          height      : h,
          aspect      : aspect,
          aspectDelta : aspect - CONFIG.referenceAspect,
          isPortrait  : h > w,
          dpr         : window.devicePixelRatio || 1,
        })
      );
    } catch (e) {
      console.warn('[custom.js] SendMessage failed', e);
    }
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  var onResize = debounce(resizeCanvas, CONFIG.resizeDebounce);
  window.addEventListener('resize',            onResize);
  window.addEventListener('orientationchange', onResize);
  window.addEventListener('fullscreenchange',  onResize);
  window.addEventListener('load', resizeCanvas);
  resizeCanvas();

  // ── Unity instance hook (called by index.html after createUnityInstance) ──
  window.__onUnityLoaded = function (instance) {
    unityInstance = instance;
    // Delay resize so the parent modal animation has finished
    setTimeout(resizeCanvas, 100);
    setTimeout(resizeCanvas, 500);
  };

  // ── Star interaction ──────────────────────────────────────────────────────
  var logo    = document.getElementById('unity-logo');
  var barFull = document.getElementById('unity-progress-bar-full');

  star.addEventListener('click', function () {
    star.style.animation = 'none';
    void star.offsetWidth;
    star.style.animation = 'star-squish 0.55s cubic-bezier(.36,.07,.19,.97) forwards';
    star.addEventListener('animationend', function resume() {
      star.style.animation = 'star-pulse 1.8s ease-in-out infinite';
      star.removeEventListener('animationend', resume);
    });

    logo.style.animation = 'none';
    void logo.offsetWidth;
    logo.style.animation = 'logo-punch 0.35s ease-out forwards';
    logo.addEventListener('animationend', function onEnd() {
      logo.style.animation = '';
      logo.removeEventListener('animationend', onEnd);
    });

    flash.style.width     = barFull.offsetWidth + 'px';
    flash.style.animation = 'none';
    void flash.offsetWidth;
    flash.style.animation = 'bar-sweep 0.6s ease-out forwards';
  });

})();
