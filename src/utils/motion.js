import { animate, stagger } from "framer-motion/dom";

export const editorialEase = [0.16, 1, 0.3, 1];
export const fast = 0.35;
export const normal = 0.9;
export const slow = 1;

export const fadeUp = {
  initial: { opacity: 0, transform: "translateY(20px)" },
  animate: { opacity: 1, transform: "translateY(0px)" },
  transition: { duration: normal, ease: editorialEase },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.85, ease: editorialEase },
};

export const revealMask = {
  initial: { opacity: 0, clipPath: "inset(0 0 18% 0)" },
  animate: { opacity: 1, clipPath: "inset(0 0 0% 0)" },
  transition: { duration: slow, ease: editorialEase },
};

export const staggerContainer = {
  delay: stagger(0.07),
};

export const staggerItem = {
  initial: { opacity: 0, transform: "translateY(16px)" },
  animate: { opacity: 1, transform: "translateY(0px)" },
  transition: { duration: normal, ease: editorialEase },
};

export const imageReveal = {
  initial: { opacity: 0, transform: "translateY(18px) scale(0.985)" },
  animate: { opacity: 1, transform: "translateY(0px) scale(1)" },
  transition: { duration: 0.95, ease: editorialEase },
};

export const slideSoft = {
  initial: { opacity: 0, transform: "translateY(12px)" },
  animate: { opacity: 1, transform: "translateY(0px)" },
  transition: { duration: 0.7, ease: editorialEase },
};

export const menuOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: fast, ease: editorialEase },
};

export const menuItem = {
  initial: { opacity: 0, transform: "translateY(14px)" },
  animate: { opacity: 1, transform: "translateY(0px)" },
  transition: { duration: 0.65, ease: editorialEase },
};

export const cardHover = {
  rest: { transform: "translateY(0px)" },
  hover: { transform: "translateY(-1px)" },
  transition: { duration: fast, ease: editorialEase },
};

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function runAnimation(element, variant, options = {}) {
  if (!element) return null;

  if (prefersReducedMotion()) {
    return animate(element, { opacity: variant.animate.opacity ?? 1 }, { duration: 0.01 });
  }

  Object.assign(element.style, variant.initial);
  return animate(element, variant.animate, { ...variant.transition, ...options });
}

export function revealOnEnter(elements, variant = fadeUp, options = {}) {
  const targets = Array.from(elements).filter(Boolean);
  if (!targets.length) return () => {};

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    targets.forEach((element) => {
      element.style.opacity = "1";
      element.style.transform = "";
      element.style.clipPath = "";
    });
    return () => {};
  }

  const animated = new WeakSet();
  targets.forEach((element) => {
    element.style.opacity = String(variant.initial.opacity ?? 0);
    if (variant.initial.transform) element.style.transform = variant.initial.transform;
    if (variant.initial.clipPath) element.style.clipPath = variant.initial.clipPath;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || animated.has(entry.target)) return;
        animated.add(entry.target);
        observer.unobserve(entry.target);
        const controls = animate(entry.target, { opacity: 1, transform: variant.animate.transform ?? "none" }, { ...variant.transition, ...options });
        controls.finished.then(() => {
          entry.target.style.willChange = "";
        });
      });
    },
    { threshold: options.amount ?? 0.2 },
  );

  targets.forEach((element) => {
    observer.observe(element);
    if (element.getBoundingClientRect().top < window.innerHeight * 0.9) {
      animated.add(element);
      observer.unobserve(element);
      const controls = animate(element, { opacity: 1, transform: variant.animate.transform ?? "none" }, { ...variant.transition, ...options });
      controls.finished.then(() => {
        element.style.willChange = "";
      });
    }
  });

  return () => observer.disconnect();
}
