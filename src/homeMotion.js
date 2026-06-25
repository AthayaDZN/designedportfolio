import { animate, stagger } from "framer-motion/dom";
import {
  editorialEase,
  fadeIn,
  fadeUp,
  fast,
  imageReveal,
  menuItem,
  menuOverlay,
  normal,
  prefersReducedMotion,
  revealOnEnter,
  runAnimation,
  slideSoft,
} from "./utils/motion.js";

function reducedTransition(duration = 0.01) {
  return prefersReducedMotion() ? { duration: 0.01 } : { duration, ease: editorialEase };
}

function setInitialRevealStyles(root) {
  if (prefersReducedMotion()) return;

  root.querySelectorAll("[data-reveal]").forEach((element) => {
    element.style.willChange = "opacity, transform";
  });

  root.querySelectorAll("[data-image-reveal]").forEach((element) => {
    if (element.matches(".work-gallery__item")) return;
    element.style.willChange = "opacity, transform";
  });
}

function forceVisible(root) {
  root.querySelectorAll("[data-reveal], [data-image-reveal], [data-headline-stagger] > *").forEach((element) => {
    element.style.opacity = "1";
    element.style.visibility = "visible";
  });
}

function bindButtonMotion(root, cleanups) {
  root.querySelectorAll(".editorial-button, .text-link, .section-heading a").forEach((button) => {
    const arrow = button.querySelector(".inline-arrow");
    const enter = () => {
      if (prefersReducedMotion()) return;
      animate(button, { transform: "translateY(-1px)" }, reducedTransition(fast));
      if (arrow) animate(arrow, { transform: "translateX(6px)" }, reducedTransition(fast));
    };
    const leave = () => {
      animate(button, { transform: "translateY(0px)" }, reducedTransition(fast));
      if (arrow) animate(arrow, { transform: "translateX(0px)" }, reducedTransition(fast));
    };

    button.addEventListener("mouseenter", enter);
    button.addEventListener("mouseleave", leave);
    cleanups.push(() => {
      button.removeEventListener("mouseenter", enter);
      button.removeEventListener("mouseleave", leave);
    });
  });
}

function bindCardMotion(root, cleanups) {
  root.querySelectorAll(".work-card").forEach((card) => {
    const arrow = card.querySelector(".inline-arrow");

    const enter = () => {
      if (prefersReducedMotion()) return;
      if (arrow) animate(arrow, { transform: "translateX(6px)" }, reducedTransition(fast));
    };
    const leave = () => {
      if (arrow) animate(arrow, { transform: "translateX(0px)" }, reducedTransition(fast));
    };

    card.addEventListener("mouseenter", enter);
    card.addEventListener("mouseleave", leave);
    cleanups.push(() => {
      card.removeEventListener("mouseenter", enter);
      card.removeEventListener("mouseleave", leave);
    });
  });
}

function bindHeroArrowMotion(root, cleanups) {
  root.querySelectorAll(".hero-arrow").forEach((button) => {
    const enter = () => {
      if (!prefersReducedMotion()) animate(button, { transform: "translateY(-50%) scale(1.03)" }, reducedTransition(fast));
    };
    const leave = () => animate(button, { transform: "translateY(-50%) scale(1)" }, reducedTransition(fast));

    button.addEventListener("mouseenter", enter);
    button.addEventListener("mouseleave", leave);
    cleanups.push(() => {
      button.removeEventListener("mouseenter", enter);
      button.removeEventListener("mouseleave", leave);
    });
  });
}

const heroSlideStates = {
  active: {
    opacity: 1,
    transform: "translateX(-50%) scale(1) rotateY(0deg)",
  },
  previous: {
    opacity: 0.72,
    transform: "translateX(calc(-50% - 62%)) scale(0.88) rotateY(24deg) rotateZ(-2deg)",
  },
  next: {
    opacity: 0.72,
    transform: "translateX(calc(-50% + 62%)) scale(0.88) rotateY(-24deg) rotateZ(2deg)",
  },
  hidden: {
    opacity: 0,
    transform: "translateX(-50%) scale(0.82) rotateY(0deg)",
  },
};

function getHeroSlideState(slide) {
  if (window.matchMedia("(max-width: 640px)").matches && slide.dataset.slideState !== "active") {
    return {
      opacity: 0,
      transform: "translateX(-50%) scale(0.94) rotateY(0deg)",
    };
  }

  return heroSlideStates[slide.dataset.slideState] || heroSlideStates.hidden;
}

function setHeroSlideLayers(heroFrame) {
  heroFrame?.querySelectorAll("[data-hero-slide]").forEach((slide) => {
    const state = slide.dataset.slideState;
    slide.style.zIndex = state === "active" ? "3" : state === "previous" || state === "next" ? "2" : "0";
  });
}

export function initHomeMotion(root = document) {
  const cleanups = [];
  setInitialRevealStyles(root);

  runAnimation(root.querySelector(".navbar"), {
    initial: { opacity: 0, transform: "translateY(-12px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: 0.75, ease: editorialEase },
  });
  setHeroSlideLayers(root.querySelector(".hero-frame"));
  root.querySelectorAll("[data-hero-slide]").forEach((slide) => runAnimation(slide, { initial: getHeroSlideState(slide), animate: getHeroSlideState(slide), transition: { duration: 0.01 } }));
  runAnimation(root.querySelector("[data-hero-meta]"), {
    initial: { opacity: 0, transform: "translateY(12px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: 0.72, ease: editorialEase },
  });

  cleanups.push(revealOnEnter(root.querySelectorAll("[data-reveal]"), fadeUp, { amount: 0.2 }));
  cleanups.push(revealOnEnter(root.querySelectorAll("[data-image-reveal]:not(.work-gallery__item)"), imageReveal));

  const headlineItems = root.querySelectorAll("[data-headline-stagger] > *");
  if (headlineItems.length && !prefersReducedMotion()) {
    headlineItems.forEach((item) => {
      item.style.willChange = "opacity, transform";
    });
    cleanups.push(
      revealOnEnter(headlineItems, {
        initial: { opacity: 0, transform: "translateY(16px)" },
        animate: { opacity: 1, transform: "translateY(0px)" },
        transition: { duration: 0.92, ease: editorialEase, delay: stagger(0.07) },
      }),
    );
  }

  bindButtonMotion(root, cleanups);
  bindCardMotion(root, cleanups);
  bindHeroArrowMotion(root, cleanups);

  const fallbackTimer = window.setTimeout(() => forceVisible(root), 1400);
  cleanups.push(() => window.clearTimeout(fallbackTimer));

  return () => cleanups.forEach((cleanup) => cleanup?.());
}

export function openMenuMotion(overlay) {
  if (!overlay) return;

  overlay.hidden = false;
  runAnimation(overlay, menuOverlay);
  runAnimation(overlay.querySelector(".overlay-panel"), {
    initial: { opacity: 0, transform: "translateY(-14px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: 0.65, ease: editorialEase },
  });

  const items = overlay.querySelectorAll(".overlay-links a");
  if (prefersReducedMotion()) {
    animate(items, { opacity: 1 }, { duration: 0.01 });
    return;
  }

  items.forEach((item) => {
    item.style.opacity = "0";
    item.style.transform = "translateY(14px)";
  });
  animate(items, menuItem.animate, { ...menuItem.transition, delay: stagger(0.06, { startDelay: 0.1 }) });
}

export async function closeMenuMotion(overlay) {
  if (!overlay) return;

  const controls = animate(overlay, menuOverlay.exit, reducedTransition(0.28));
  await controls.finished;
  overlay.hidden = true;
}

export function animateHeroProject(heroFrame) {
  if (!heroFrame) return;

  setHeroSlideLayers(heroFrame);
  heroFrame.querySelectorAll("[data-hero-slide]").forEach((slide) => {
    animate(slide, getHeroSlideState(slide), prefersReducedMotion() ? { duration: 0.01 } : { duration: 0.85, ease: editorialEase });
  });
  runAnimation(heroFrame.querySelector("[data-hero-meta]"), slideSoft);
  animate(heroFrame.querySelectorAll(".project-dashes button"), { opacity: 1 }, reducedTransition(0.25));
}

export function animateCaseChapter(text, collage) {
  runAnimation(text?.querySelector("[data-case-text-inner]"), slideSoft);
  const stats = text?.querySelectorAll(".case-stats span");
  if (stats?.length && !prefersReducedMotion()) {
    stats.forEach((stat) => {
      stat.style.opacity = "0";
      stat.style.transform = "translateY(10px)";
    });
    animate(stats, { opacity: 1, transform: "translateY(0px)" }, { duration: 0.75, ease: editorialEase, delay: stagger(0.06) });
  }

  const images = collage?.querySelectorAll(".case-collage-item");
  if (images?.length) {
    images.forEach((image) => runAnimation(image, imageReveal, { duration: 0.9 }));
  }
}
