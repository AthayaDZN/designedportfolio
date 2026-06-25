import Lenis from "lenis";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function createSmoothScrollProvider() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  window.__athayaSmoothScroll?.destroy();

  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  let lenis = null;
  let frameId = 0;

  const isAdminRoute = () => window.location.pathname.replace(/\/+$/, "") === "/admin";

  const stopFrame = () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };

  const raf = (time) => {
    lenis?.raf(time);
    frameId = window.requestAnimationFrame(raf);
  };

  const syncLockState = () => {
    if (!lenis) return;
    if (document.body.classList.contains("menu-lock")) {
      lenis.stop();
    } else {
      lenis.start();
    }
  };

  const destroyLenis = () => {
    stopFrame();
    lenis?.destroy();
    lenis = null;
    window.__athayaLenis = null;
  };

  const initLenis = () => {
    if (reducedMotion.matches || isAdminRoute() || lenis) return;

    try {
      lenis = new Lenis({
        smoothWheel: true,
        smoothTouch: false,
        syncTouch: false,
        wheelMultiplier: 0.82,
        touchMultiplier: 1,
        lerp: 0.14,
      });
      window.__athayaLenis = lenis;
      syncLockState();
      frameId = window.requestAnimationFrame(raf);
    } catch (error) {
      destroyLenis();
      window.__athayaLenisError = error;
    }
  };

  const handleReducedMotionChange = () => {
    if (reducedMotion.matches || isAdminRoute()) {
      destroyLenis();
    } else {
      initLenis();
    }
  };

  const handleAnchorClick = (event) => {
    const link = event.target.closest?.("a[href^='#']");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;

    const target = document.querySelector(hash);
    if (!target) return;

    event.preventDefault();
    scrollTo(target);
  };

  document.addEventListener("click", handleAnchorClick);
  reducedMotion.addEventListener?.("change", handleReducedMotionChange);
  reducedMotion.addListener?.(handleReducedMotionChange);

  const observer = new MutationObserver(syncLockState);
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  initLenis();

  const scrollTo = (target, options = {}) => {
    const top = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY;
    const useNative = options.immediate || reducedMotion.matches || !lenis;
    const behavior = useNative ? "auto" : "smooth";
    if (!useNative && lenis) {
      lenis.scrollTo(top, {
        immediate: false,
        lock: true,
        ...options,
      });
      return;
    }
    window.scrollTo({ top, behavior });
  };

  const handleNavigation = () => {
    if (isAdminRoute()) {
      destroyLenis();
      return;
    }
    initLenis();
  };

  window.addEventListener("popstate", handleNavigation);

  const provider = {
    get instance() {
      return lenis;
    },
    scrollTo,
    stop() {
      lenis?.stop();
    },
    start() {
      syncLockState();
    },
    destroy() {
      document.removeEventListener("click", handleAnchorClick);
      window.removeEventListener("popstate", handleNavigation);
      reducedMotion.removeEventListener?.("change", handleReducedMotionChange);
      reducedMotion.removeListener?.(handleReducedMotionChange);
      observer.disconnect();
      destroyLenis();
      if (window.__athayaSmoothScroll === provider) {
        window.__athayaSmoothScroll = null;
      }
    },
  };

  window.__athayaSmoothScroll = provider;
  return provider;
}
