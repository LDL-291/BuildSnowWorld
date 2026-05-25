// unity-responsive.js

(function () {

    const CONFIG = {

        canvasId: "unity-canvas",

        maxPixelRatio: 2,

        sendToUnity: true,

        unityGameObject: "ResponsiveManager",

        unityMethod: "OnBrowserResize",

        referenceAspect: 16 / 9,

        dynamicResolution: true,

        mobileScale: 0.8,
    };

    let unityInstance = null;

    function getCanvas() {
        return document.getElementById(CONFIG.canvasId);
    }

    function getRenderScale() {

        const mobile =
            /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (!CONFIG.dynamicResolution)
            return 1;

        return mobile
            ? CONFIG.mobileScale
            : 1;
    }

    function resizeCanvas() {

        const canvas = getCanvas();

        if (!canvas) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        const dpr = Math.min(
            window.devicePixelRatio || 1,
            CONFIG.maxPixelRatio
        );

        const renderScale = getRenderScale();

        const renderWidth =
            Math.floor(width * dpr * renderScale);

        const renderHeight =
            Math.floor(height * dpr * renderScale);

        // INTERNAL RENDER SIZE
        canvas.width = renderWidth;
        canvas.height = renderHeight;

        // DISPLAY SIZE
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";

        sendResizeToUnity(width, height);

        console.log(
            `[Responsive] ${width}x${height} DPR:${dpr}`
        );
    }

    function sendResizeToUnity(width, height) {

        if (!CONFIG.sendToUnity) return;

        if (!unityInstance) return;

        const aspect =
            width / height;

        const payload = JSON.stringify({

            width,
            height,

            aspect,

            aspectDelta:
                aspect - CONFIG.referenceAspect,

            isPortrait:
                height > width,

            dpr:
                window.devicePixelRatio || 1
        });

        try {

            unityInstance.SendMessage(
                CONFIG.unityGameObject,
                CONFIG.unityMethod,
                payload
            );

        } catch (e) {

            console.warn(
                "[Responsive] Unity SendMessage failed",
                e
            );
        }
    }

    function debounce(fn, ms) {

        let timeout;

        return () => {

            clearTimeout(timeout);

            timeout = setTimeout(fn, ms);
        };
    }

    const onResize =
        debounce(resizeCanvas, 10);

    window.addEventListener(
        "resize",
        onResize
    );

    window.addEventListener(
        "orientationchange",
        onResize
    );

    window.addEventListener(
        "fullscreenchange",
        onResize
    );

    // expose globally
    window.UnityResponsive = {

        setUnityInstance(instance) {

            unityInstance = instance;

            resizeCanvas();
        },

        resize: resizeCanvas
    };

    // first resize
    window.addEventListener("load", () => {

        resizeCanvas();
    });

})();