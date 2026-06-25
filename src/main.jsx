import { approachImages, chapters, featuredProjects, homeContent, selectedWork, services, setHomeContent, testimonials } from "./data.js";
import { getFontBySlug, setFonts } from "./data/fonts.js";
import { getNextWork, getWorkBySlug, setWorks, works } from "./data/works.js";
import { defaultContentBundle } from "./content/defaultContent.js";
import { loadAllContent } from "./content/loaders.js";
import { animateCaseChapter, animateHeroProject, closeMenuMotion, initHomeMotion, openMenuMotion } from "./homeMotion.js";
import { renderAboutPage } from "./pages/AboutPage.tsx";
import { renderContactPage } from "./pages/ContactPage.js";
import { renderFontDetailPage } from "./pages/FontDetailPage.js";
import { renderFontsPage } from "./pages/FontsPage.js";
import { renderServicesPage } from "./pages/ServicesPage.js";
import { createSmoothScrollProvider } from "./SmoothScrollProvider.js";
import "./styles.css";

let appContent = defaultContentBundle;
let siteSettings = defaultContentBundle.site;
let seoSettings = defaultContentBundle.seo;
let DISCOVERY_CALL_LABEL = siteSettings.primaryCtaLabel;
let DISCOVERY_CALL_URL = siteSettings.primaryCtaUrl;
const SITE_ORIGIN = "https://athayadesigned.com";
const DEFAULT_OG_IMAGE = "/assets/athaya-brandmark.png";
const LOADER_VIDEO_SRC = "/assets/athaya-loader.mp4";
const loaderMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const loaderTiming = loaderMotionQuery.matches
  ? { minVisible: 450, maxVisible: 1400, fade: 260 }
  : { minVisible: 1200, maxVisible: 3500, fade: 720 };
const siteLoader = {
  node: null,
  startTime: 0,
  fallbackTimer: null,
  hideTimer: null,
  removeTimer: null,
  isComplete: false,
};
let renderedPath = window.location.pathname;

function getLoaderMarkup() {
  return `
    <div class="site-loader__frame">
      <video class="site-loader__video" src="${LOADER_VIDEO_SRC}" autoplay muted playsinline ${loaderMotionQuery.matches ? "" : "loop"} preload="auto" aria-hidden="true"></video>
      <span class="site-loader__watermark-patch" aria-hidden="true"></span>
    </div>
  `;
}

function clearSiteLoaderTimers() {
  if (siteLoader.fallbackTimer) window.clearTimeout(siteLoader.fallbackTimer);
  if (siteLoader.hideTimer) window.clearTimeout(siteLoader.hideTimer);
  if (siteLoader.removeTimer) window.clearTimeout(siteLoader.removeTimer);
  siteLoader.fallbackTimer = null;
  siteLoader.hideTimer = null;
  siteLoader.removeTimer = null;
}

function resetSiteLoader() {
  clearSiteLoaderTimers();
  siteLoader.isComplete = false;
}

function ensureSiteLoader() {
  if (siteLoader.isComplete) return null;

  let loader = siteLoader.node || document.querySelector("[data-site-loader]");
  if (!loader) {
    loader = document.createElement("div");
    loader.className = "site-loader";
    loader.dataset.siteLoader = "";
    loader.innerHTML = getLoaderMarkup();
  }

  siteLoader.node = loader;
  loader.classList.remove("is-leaving");
  loader.setAttribute("aria-hidden", "true");

  if (!loader.isConnected) {
    document.body.appendChild(loader);
  }

  const video = loader.querySelector("video");
  if (video) {
    video.muted = true;
    video.playsInline = true;
    video.loop = !loaderMotionQuery.matches;
    video.controls = false;
    video.preload = "auto";
    if (loaderMotionQuery.matches) {
      video.pause();
      try {
        video.currentTime = 0;
      } catch (error) {
        video.addEventListener("loadedmetadata", () => {
          try {
            video.currentTime = 0;
          } catch (metadataError) {
            // Keep the reduced-motion fallback quiet if the browser blocks seeking.
          }
        }, { once: true });
      }
    } else {
      video.play?.().catch(() => {});
    }
  }

  return loader;
}

function startSiteLoader({ replay = false } = {}) {
  if (replay) resetSiteLoader();
  siteLoader.startTime = performance.now();
  ensureSiteLoader();

  if (siteLoader.fallbackTimer) window.clearTimeout(siteLoader.fallbackTimer);
  siteLoader.fallbackTimer = window.setTimeout(() => {
    finishSiteLoader();
  }, loaderTiming.maxVisible);
}

function finishSiteLoader() {
  if (siteLoader.isComplete) return;

  const loader = ensureSiteLoader();
  if (!loader) return;

  if (siteLoader.fallbackTimer) {
    window.clearTimeout(siteLoader.fallbackTimer);
    siteLoader.fallbackTimer = null;
  }

  const elapsed = performance.now() - siteLoader.startTime;
  const delay = Math.max(0, loaderTiming.minVisible - elapsed);

  if (siteLoader.hideTimer) window.clearTimeout(siteLoader.hideTimer);
  siteLoader.hideTimer = window.setTimeout(() => {
    loader.classList.add("is-leaving");

    const removeLoader = () => {
      if (siteLoader.removeTimer) {
        window.clearTimeout(siteLoader.removeTimer);
        siteLoader.removeTimer = null;
      }
      loader.removeEventListener("transitionend", removeLoader);
      loader.remove();
      siteLoader.node = null;
      siteLoader.isComplete = true;
    };

    loader.addEventListener("transitionend", removeLoader, { once: true });
    siteLoader.removeTimer = window.setTimeout(removeLoader, loaderTiming.fade + 120);
  }, delay);
}

function isHomePath(path) {
  return (path || "/").split("#")[0].replace(/\/+$/, "") === "";
}

function replayHomeLoader() {
  startSiteLoader({ replay: true });
  window.requestAnimationFrame(() => finishSiteLoader());
}

function getNavHref(item) {
  if (item && typeof item === "object") return item.url || "/";
  const map = {
    Work: "/work",
    Services: "/services",
    Fonts: "/fonts",
    About: "/about",
    Contact: "/contact",
  };
  return map[item] || "/";
}

function getMenuLinks() {
  return [...(siteSettings.overlayMenuLinks || [])]
    .filter((item) => item.enabled !== false)
    .sort((a, b) => (Number(a.order || 0) || 0) - (Number(b.order || 0) || 0));
}

function getMenuLabel(item) {
  return typeof item === "string" ? item : item.label;
}

function mergeByKey(defaultItems = [], customItems = [], key = "id") {
  const customByKey = new Map(customItems.map((item) => [item?.[key], item]).filter(([value]) => value));
  const merged = defaultItems.map((item) => ({ ...item, ...(customByKey.get(item?.[key]) || {}) }));
  customItems.forEach((item) => {
    const value = item?.[key];
    if (!value || !defaultItems.some((defaultItem) => defaultItem?.[key] === value)) merged.push(item);
  });
  return merged;
}

function getTnbFeaturedCaseStudy() {
  return {
    selectedWorkSlug: "thenationsbest",
    title: "The Nations Best",
    category: "Gaming Clan Rebrand",
    paragraph: "A complete rebrand for TNB, reshaping the clan from its previous Bengal Tiger mark into a royal lion identity built for presence across court graphics, apparel, and community touchpoints.",
    stats: [
      { value: "1", label: "Main Mascot" },
      { value: "4+", label: "Core Assets" },
      { value: "2023", label: "Brand Launch" },
    ],
    chapters: [
      {
        number: "01",
        title: "Overview",
        label: "Featured Case Study",
        heading: "The Nations Best",
        category: "Overview / Previous TNB Identity",
        paragraph: "The project started from TNB's previous logo, a Bengal Tiger identity that already had recognition in the NBA2K community but needed a stronger, more ownable direction for the next era of the clan.",
        stats: [
          { value: "TNB", label: "Gaming Clan" },
          { value: "NBA2K", label: "Community" },
          { value: "2023", label: "Rebrand" },
        ],
        images: [{ type: "custom", label: "TNB previous logo", imagePath: "/uploads/images/3-1782412590252.png" }],
      },
      {
        number: "02",
        title: "Challenge",
        label: "Featured Case Study",
        heading: "The Nations Best",
        category: "Challenge / Finding A New Symbol",
        paragraph: "The challenge was to move beyond the old mascot without losing the competitive attitude of the brand. Early sketches explored a more royal, dominant animal direction that could better match the name The Nations Best.",
        stats: [
          { value: "1", label: "Core Direction" },
          { value: "Lion", label: "Mascot Shift" },
          { value: "Royal", label: "Visual Tone" },
        ],
        images: [{ type: "custom", label: "TNB early sketch", imagePath: "/uploads/images/skets-1782412831183.webp" }],
      },
      {
        number: "03",
        title: "Solution",
        label: "Featured Case Study",
        heading: "The Nations Best",
        category: "Solution / Lion Mascot Identity",
        paragraph: "The final main logo turns TNB into a lion-led identity with a crown and castle-inspired structure, giving the clan a mark that feels fierce, royal, and built around the idea of a nation.",
        stats: [
          { value: "1", label: "Main Logo" },
          { value: "Crown", label: "Royal Cue" },
          { value: "Lion", label: "Mascot Mark" },
        ],
        images: [{ type: "custom", label: "TNB main logo", imagePath: "/uploads/images/5-1782412881881.png" }],
      },
      {
        number: "04",
        title: "The System",
        label: "Featured Case Study",
        heading: "The Nations Best",
        category: "System / Mascot, Brandmark, Wordmark",
        paragraph: "The identity system extends the main mascot into a compact brandmark and a wordmark, giving TNB flexible assets for profile use, apparel, graphics, and branded moments beyond the full crest.",
        stats: [
          { value: "3", label: "Core Marks" },
          { value: "Mascot", label: "Brandmark" },
          { value: "Wordmark", label: "Type Asset" },
        ],
        images: [{ type: "custom", label: "TNB mascot brandmark and wordmark", imagePath: "/uploads/images/chatgpt-image-jun-26-2026-03-08-57-am-1782414576289.webp" }],
      },
      {
        number: "05",
        title: "Applications",
        label: "Featured Case Study",
        heading: "The Nations Best",
        category: "Application / Apparel With The New Logo",
        paragraph: "The new logo was tested on apparel so the identity could feel strong outside a static logo presentation, keeping the mark readable and impactful in merch-focused layouts.",
        stats: [
          { value: "1", label: "Apparel System" },
          { value: "Logo", label: "Front Focus" },
          { value: "Merch", label: "Use Case" },
        ],
        images: [{ type: "custom", label: "TNB apparel application", imagePath: "/uploads/images/19-1-1782413241896.webp" }],
      },
      {
        number: "06",
        title: "Results",
        label: "Featured Case Study",
        heading: "The Nations Best",
        category: "Result / New Branding On Court",
        paragraph: "The finished branding gives TNB a larger presence in the basketball environment, with the new identity carrying across the court and reinforcing the clan's competitive, royal visual language.",
        stats: [
          { value: "Court", label: "Brand Moment" },
          { value: "TNB", label: "Unified Look" },
          { value: "New", label: "Identity Era" },
        ],
        images: [{ type: "custom", label: "TNB branding on basketball court", imagePath: "/uploads/images/21-1782413338618.webp" }],
      },
    ],
  };
}

function migrateFeaturedCaseStudy(home) {
  const featured = home?.featuredCaseStudy;
  const isLegacyWesthaven = featured?.selectedWorkSlug === "westhaven-university" || /westhaven/i.test(featured?.title || "") || (featured?.chapters || []).some((chapter) => /westhaven/i.test(`${chapter?.heading || ""} ${chapter?.paragraph || ""}`));
  return isLegacyWesthaven ? { ...home, featuredCaseStudy: getTnbFeaturedCaseStudy() } : home;
}

function applyContent(content) {
  const customTestimonials = content?.home?.testimonials;
  appContent = { ...defaultContentBundle, ...(content || {}) };
  appContent.home = { ...defaultContentBundle.home, ...(appContent.home || {}) };
  appContent.home.testimonials = {
    ...defaultContentBundle.home.testimonials,
    ...(appContent.home.testimonials || {}),
    items: Array.isArray(customTestimonials?.items) ? customTestimonials.items : defaultContentBundle.home.testimonials?.items || [],
    logos: Array.isArray(customTestimonials?.logos) ? customTestimonials.logos : defaultContentBundle.home.testimonials?.logos || [],
  };
  appContent.home = migrateFeaturedCaseStudy(appContent.home);
  appContent.services = {
    ...defaultContentBundle.services,
    ...(appContent.services || {}),
    items: mergeByKey(defaultContentBundle.services?.items || [], appContent.services?.items || [], "slug"),
    processTeaser: {
      ...defaultContentBundle.services?.processTeaser,
      ...(appContent.services?.processTeaser || {}),
      steps: mergeByKey(
        defaultContentBundle.services?.processTeaser?.steps || [],
        appContent.services?.processTeaser?.steps || [],
        "number",
      ),
    },
  };
  siteSettings = appContent.site || defaultContentBundle.site;
  seoSettings = appContent.seo || defaultContentBundle.seo;
  DISCOVERY_CALL_LABEL = siteSettings.primaryCtaLabel || defaultContentBundle.site.primaryCtaLabel;
  DISCOVERY_CALL_URL = siteSettings.primaryCtaUrl || siteSettings.bookingUrl || defaultContentBundle.site.primaryCtaUrl;
  setWorks(appContent.works || defaultContentBundle.works);
  setFonts(appContent.fonts || defaultContentBundle.fonts);
  setHomeContent(appContent.home || defaultContentBundle.home, works);
}
let activeProject = 0;
let activeChapter = 0;
let smoothScrollProvider = null;
let cleanupMotion = null;
let cleanupNavScroll = null;
let cleanupChapterScroll = null;
let cleanupKeydown = null;
let cleanupTestimonialsScroll = null;
let cleanupFontFit = null;
let chapterChangeTimer = null;

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return escapeAttr(value);
}

function absoluteUrl(value = "/") {
  try {
    return new URL(value || "/", SITE_ORIGIN).toString();
  } catch (error) {
    return SITE_ORIGIN;
  }
}

function imageAttrs(src, alt, options = {}) {
  const attrs = [
    `src="${escapeAttr(src)}"`,
    `alt="${escapeAttr(alt)}"`,
    `decoding="${options.decoding || "async"}"`,
  ];

  if (options.loading) attrs.push(`loading="${options.loading}"`);
  if (options.fetchPriority) attrs.push(`fetchpriority="${options.fetchPriority}"`);
  if (options.width) attrs.push(`width="${options.width}"`);
  if (options.height) attrs.push(`height="${options.height}"`);
  if (options.className) attrs.push(`class="${escapeAttr(options.className)}"`);
  if (options.ariaHidden) attrs.push('aria-hidden="true"');
  return attrs.join(" ");
}

function arrowIcon(className = "inline-arrow") {
  return `<svg class="${className}" viewBox="0 0 40 24" aria-hidden="true" focusable="false"><path d="M7 12H30M23 5L30 12L23 19" /></svg>`;
}

function socialIcon(name) {
  const icons = {
    instagram: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="5" width="14" height="14" rx="4" /><circle cx="12" cy="12" r="3.2" /><circle class="social-icon-dot" cx="16.3" cy="7.7" r="0.8" /></svg>`,
    behance: `<svg class="social-icon social-icon--behance" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.8 7.5h5.1c1.9 0 3 0.9 3 2.4c0 0.9-0.4 1.6-1.2 2c1.1 0.4 1.8 1.2 1.8 2.5c0 1.8-1.4 2.9-3.5 2.9H4.8V7.5Z" /><path d="M7.1 11.4h2.3c0.8 0 1.2-0.3 1.2-1s-0.5-1-1.3-1H7.1v2Z" /><path d="M7.1 15.4h2.6c0.9 0 1.4-0.4 1.4-1.1c0-0.8-0.5-1.1-1.4-1.1H7.1v2.2Z" /><path d="M15.1 9h4.4" /><path d="M14.6 14.1c0-2 1.2-3.4 3.2-3.4c2.1 0 3.2 1.5 3 3.8h-4.3c0.1 0.8 0.6 1.2 1.4 1.2c0.6 0 1-0.2 1.3-0.6h1.5c-0.5 1.2-1.5 2-2.9 2c-2 0-3.2-1.2-3.2-3Z" /><path d="M16.5 13.3h2.5c-0.1-0.7-0.5-1.1-1.2-1.1s-1.1 0.4-1.3 1.1Z" /></svg>`,
    dribbble: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="7" /><path d="M7.2 7.3c2.9 2.6 4.8 5.9 5.8 11.4" /><path d="M5.4 13c4.1 0.1 8.2-1 12.6-4.2" /><path d="M10.8 19c1.6-3.9 4.1-6.3 8.1-6.9" /></svg>`,
    linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 10v8" /><path d="M6.5 7.2v0.1" /><path d="M10.2 18v-8" /><path d="M10.2 13.4c0-2.2 1.2-3.5 3.1-3.5c1.8 0 3 1.2 3 3.6V18" /></svg>`,
  };

  return icons[name] || "";
}

function getSocialProfileUrls() {
  return [siteSettings.instagramUrl, siteSettings.behanceUrl, siteSettings.linkedinUrl].filter((url) => url && url !== "#");
}

function getOrganizationSchema() {
  const sameAs = getSocialProfileUrls();
  return {
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: siteSettings.studioName || "ATHAYA DESIGNED",
    url: SITE_ORIGIN,
    logo: absoluteUrl(siteSettings.brandmarkPath || DEFAULT_OG_IMAGE),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

function getBreadcrumbSchema(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

function parsePrice(priceLabel) {
  const match = String(priceLabel || "").match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : "";
}

function getOgType(key) {
  if (key === "home") return "website";
  if (key === "font-detail") return "product";
  if (key === "work-detail") return "article";
  return "website";
}

function getRouteJsonLd({ key, title, description, canonicalUrl, ogImage, work, font }) {
  const organization = getOrganizationSchema();
  const website = {
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    name: siteSettings.studioName || "ATHAYA DESIGNED",
    url: SITE_ORIGIN,
    publisher: { "@id": organization["@id"] },
  };

  if (key === "home") {
    return [organization, website, {
      "@type": "ProfessionalService",
      "@id": `${SITE_ORIGIN}/#professional-service`,
      name: siteSettings.studioName || "ATHAYA DESIGNED",
      url: SITE_ORIGIN,
      description: "Character-driven identity design for teams, schools, and brands.",
      founder: {
        "@type": "Person",
        name: "Ahmad Athaya Nurhani",
      },
      serviceType: [
        "Sports identity design",
        "Mascot logo design",
        "Athletic branding",
        "School branding",
        "Logo design",
        "Brand identity systems",
      ],
      areaServed: "Worldwide",
      image: ogImage,
      publisher: { "@id": organization["@id"] },
      ...(organization.sameAs ? { sameAs: organization.sameAs } : {}),
    }];
  }

  if (work) {
    return [organization, website, {
      "@type": "CreativeWork",
      name: work.title,
      headline: title,
      description,
      image: ogImage,
      creator: { "@id": organization["@id"] },
      dateCreated: work.year,
      genre: work.category,
      url: canonicalUrl,
    }, getBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Work", url: "/work" },
      { name: work.title, url: `/work/${work.slug}` },
    ])];
  }

  if (font) {
    const price = parsePrice(font.priceLabel);
    return [organization, website, {
      "@type": "Product",
      name: font.name,
      description,
      image: ogImage,
      brand: { "@id": organization["@id"] },
      category: font.category,
      url: canonicalUrl,
      ...(price && font.payhipUrl ? {
        offers: {
          "@type": "Offer",
          url: font.payhipUrl,
          price,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      } : {}),
    }, getBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Fonts", url: "/fonts" },
      { name: font.name, url: `/fonts/${font.slug}` },
    ])];
  }

  return [organization, website, {
    "@type": "WebPage",
    name: title,
    description,
    url: canonicalUrl,
    image: ogImage,
    isPartOf: { "@id": website["@id"] },
    publisher: { "@id": organization["@id"] },
  }];
}

function btn(label, href, variant, extra) {
  const target = href || "/contact";
  const routerAttr = target.startsWith("/") ? " data-router-link" : "";
  return `<a class="editorial-button editorial-button--${variant || "solid"} ${extra || ""}" href="${target}"${routerAttr}><span>${label}</span>${arrowIcon()}</a>`;
}

function label(text) {
  return `<div class="section-label"><span>${text}</span></div>`;
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function upsertLink(rel, href) {
  let link = document.head.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", rel);
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function setMeta(title, description) {
  document.title = title;
  upsertMeta('meta[name="description"]', { name: "description", content: description });
}

function cssUrl(value) {
  return `url("${String(value || "").replace(/\\/g, "/").replace(/"/g, '\\"')}")`;
}

function setPageBackground(value, useGlobal = true, useDefaultPageBackground = true) {
  const defaultPageBackground = useDefaultPageBackground ? appContent.contact?.backgroundImage : "";
  const background = value || (useGlobal ? siteSettings.globalBackgroundImagePath || defaultPageBackground : "") || "";
  document.body.classList.toggle("has-cms-background", Boolean(background));
  if (background) {
    document.body.style.setProperty("--cms-page-background", cssUrl(background));
  } else {
    document.body.style.removeProperty("--cms-page-background");
  }
}

function setPageSEO(key, fallbackTitle, fallbackDescription, detailSlug) {
  const work = key === "work-detail" && detailSlug ? getWorkBySlug(detailSlug) : null;
  const font = key === "font-detail" && detailSlug ? getFontBySlug(detailSlug) : null;
  const detailFallback =
    work
      ? {
          title: `${work.title} - ${work.category} Case Study | ATHAYA DESIGNED`,
          description: work.summary || work.description || fallbackDescription,
          canonicalUrl: `/work/${work.slug}`,
          ogImage: work.coverImage || work.heroImage || DEFAULT_OG_IMAGE,
          twitterImage: work.coverImage || work.heroImage || DEFAULT_OG_IMAGE,
          jsonLdType: "CreativeWork",
        }
      : font
        ? {
            title: `${font.name} - Display Typeface for Sports Graphics | ATHAYA DESIGNED`,
            description: font.description || font.shortDescription || fallbackDescription,
            canonicalUrl: `/fonts/${font.slug}`,
            ogImage: font.previewImage || DEFAULT_OG_IMAGE,
            twitterImage: font.previewImage || DEFAULT_OG_IMAGE,
            jsonLdType: "Product",
          }
        : null;
  const entry =
    (detailSlug && key === "work-detail" ? seoSettings.workDetails?.[detailSlug] : null) ||
    (detailSlug && key === "font-detail" ? seoSettings.fontDetails?.[detailSlug] : null) ||
    seoSettings.pages?.[key] ||
    detailFallback ||
    null;

  const title = entry?.title || fallbackTitle;
  const description = entry?.description || fallbackDescription;
  const canonicalUrl = absoluteUrl(entry?.canonicalUrl || detailFallback?.canonicalUrl || window.location.pathname || "/");
  const ogImage = absoluteUrl(entry?.ogImage || entry?.twitterImage || detailFallback?.ogImage || siteSettings.defaultOgImagePath || DEFAULT_OG_IMAGE);
  const twitterImage = absoluteUrl(entry?.twitterImage || entry?.ogImage || detailFallback?.twitterImage || siteSettings.defaultOgImagePath || DEFAULT_OG_IMAGE);
  const imageAlt = `${title} preview by ATHAYA DESIGNED`;

  setMeta(title, description);
  upsertLink("canonical", canonicalUrl);

  upsertMeta('meta[name="robots"]', { name: "robots", content: entry?.noIndex ? "noindex,nofollow" : "index,follow" });
  upsertMeta('meta[property="og:type"]', { property: "og:type", content: entry?.ogType || getOgType(key) });
  upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: siteSettings.studioName || "ATHAYA DESIGNED" });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
  upsertMeta('meta[property="og:image"]', { property: "og:image", content: ogImage });
  upsertMeta('meta[property="og:image:alt"]', { property: "og:image:alt", content: imageAlt });
  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: twitterImage });
  upsertMeta('meta[name="twitter:image:alt"]', { name: "twitter:image:alt", content: imageAlt });

  let jsonLd = document.getElementById("athaya-route-jsonld");
  if (!jsonLd) {
    jsonLd = document.createElement("script");
    jsonLd.id = "athaya-route-jsonld";
    jsonLd.type = "application/ld+json";
    document.head.appendChild(jsonLd);
  }
  jsonLd.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": getRouteJsonLd({ key, title, description, canonicalUrl, ogImage, work, font }),
  });
}

function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/admin") return { name: "admin" };
  if (path === "/about") return { name: "about" };
  if (path === "/contact") return { name: "contact" };
  if (path === "/fonts") return { name: "fonts" };
  if (path.startsWith("/fonts/")) return { name: "font-detail", slug: decodeURIComponent(path.split("/")[2] || "") };
  if (path === "/work") return { name: "work" };
  if (path === "/services") return { name: "services" };
  if (path.startsWith("/work/")) return { name: "work-detail", slug: decodeURIComponent(path.split("/")[2] || "") };
  return { name: "home" };
}

function navigateTo(path) {
  if (window.location.pathname === path) return;
  const shouldReplayHomeLoader = isHomePath(path) && !isHomePath(window.location.pathname);
  window.history.pushState({}, "", path);
  render();
  renderedPath = window.location.pathname;
  window.scrollTo({ top: 0, behavior: "auto" });
  if (shouldReplayHomeLoader) replayHomeLoader();
}

function renderCaseStats(stats) {
  return stats.map((stat) => `<span><strong>${stat.value}</strong><em>${stat.label}</em></span>`).join("");
}

function getCaseImagePath(image) {
  return image?.imagePath || image?.path || image?.image || image?.src || "";
}

function renderCaseCollage(images = [], heading) {
  const image = images.find((item) => getCaseImagePath(item)) || images[0];
  if (!image) return "";

  const imagePath = getCaseImagePath(image);
  const type = image.type || "custom";
  const labelText = image.label || heading || "Featured case study image";

  return `
    <figure class="case-collage-item case-collage-item--single case-collage-item--${type}" data-visual="${type}" data-image-reveal>
      ${imagePath
        ? `<img ${imageAttrs(imagePath, `${heading} brand application by ATHAYA DESIGNED`, { loading: "lazy" })} />`
        : `<div class="identity-visual identity-visual--${type}">
            <span class="visual-mark">${labelText}</span>
            ${image.detail ? `<span class="visual-detail">${image.detail}</span>` : ""}
          </div>`}
      <figcaption>${labelText}</figcaption>
    </figure>
  `;
}

function renderCasePanel(chapter) {
  const caseStudySlug = homeContent.featuredCaseStudy?.selectedWorkSlug || "thenationsbest";
  return `
    <div class="case-text-inner" data-case-text-inner>
      ${label(chapter.label)}
      <h2>${chapter.heading}</h2>
      <span class="case-subtitle">${chapter.category}</span>
      <p>${chapter.copy}</p>
      <div class="case-stats">${renderCaseStats(chapter.stats)}</div>
      ${btn("View Case Study", `/work/${caseStudySlug}`)}
    </div>
  `;
}

function renderHeader() {
  const links = getMenuLinks();
  return `
    <header class="navbar" data-navbar>
      <a class="brand" href="/" aria-label="ATHAYA DESIGNED home" data-router-link>
        <img ${imageAttrs(siteSettings.logoHorizontalPath || "/assets/athaya-horizontal.png", siteSettings.studioName || "ATHAYA DESIGNED", { className: "brand-logo brand-logo--horizontal", loading: "eager", width: 640, height: 129 })} />
      </a>
      <div class="navbar-actions">
        ${btn(DISCOVERY_CALL_LABEL, DISCOVERY_CALL_URL, "solid", "nav-cta")}
        <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="athaya-overlay-menu" data-menu-toggle>
          <span class="menu-lines" aria-hidden="true"><span></span><span></span><span></span></span>
          <img ${imageAttrs(siteSettings.brandmarkPath || "/assets/athaya-brandmark.png", "", { className: "settings-icon settings-icon--brandmark", loading: "eager", width: 512, height: 512, ariaHidden: true })} />
        </button>
      </div>
    </header>

    <div class="overlay-menu" id="athaya-overlay-menu" hidden data-overlay>
      <div class="overlay-panel">
        <div class="overlay-top">
          ${label("Menu / ATHAYA DESIGNED")}
          <button class="close-button" type="button" aria-label="Close menu" data-menu-close>Close</button>
        </div>
        <nav class="overlay-links">
          ${links.map((item, index) => `<a href="${getNavHref(item)}" data-menu-link data-router-link><span>${String(index + 1).padStart(2, "0")}</span>${getMenuLabel(item)}</a>`).join("")}
        </nav>
        <div class="overlay-footer">
          ${btn(DISCOVERY_CALL_LABEL, DISCOVERY_CALL_URL)}
        </div>
      </div>
    </div>
  `;
}

function renderFooter() {
  const year = new Date().getFullYear();
  const links = getMenuLinks();
  const copyright = (siteSettings.footerCopyright || "(c) {year} ATHAYA DESIGNED. All rights reserved.").replace("{year}", year);
  return `
    <footer class="footer" id="contact">
      <div class="footer-brand">
        <img ${imageAttrs(siteSettings.brandmarkPath || "/assets/athaya-brandmark.png", `${siteSettings.studioName || "ATHAYA DESIGNED"} brandmark`, { className: "brand-logo brand-logo--mark", loading: "lazy", width: 512, height: 512 })} />
      </div>
      <nav>${links.map((item) => `<a href="${getNavHref(item)}" data-router-link>${getMenuLabel(item)}</a>`).join("")}</nav>
      <div class="social-links" aria-label="Social links">
        <a href="${siteSettings.instagramUrl || "#"}" aria-label="Instagram">${socialIcon("instagram")}</a>
        <a href="${siteSettings.behanceUrl || "#"}" aria-label="Behance" class="social-link--text">Be</a>
        <a href="#" aria-label="Dribbble">${socialIcon("dribbble")}</a>
        <a href="${siteSettings.linkedinUrl || "#"}" aria-label="LinkedIn">${socialIcon("linkedin")}</a>
      </div>
      <small>${copyright}</small>
    </footer>
  `;
}

function getProjectHeroImage(project) {
  return project.image || project.coverPath || project.heroImages?.center || "";
}

function getHeroSlideState(index) {
  const total = featuredProjects.length;
  const previous = (activeProject + total - 1) % total;
  const next = (activeProject + 1) % total;

  if (index === activeProject) return "active";
  if (index === previous) return "previous";
  if (index === next) return "next";
  return "hidden";
}

function renderHeroSlides() {
  return featuredProjects
    .map((item, index) => {
      const state = getHeroSlideState(index);
      const image = getProjectHeroImage(item);
      const isActive = state === "active";
      return `
        <div class="hero-slide hero-slide--${state}" data-hero-slide data-slide-index="${index}" data-slide-state="${state}" aria-hidden="${state === "active" ? "false" : "true"}">
          <img ${imageAttrs(image, `${item.title} ${item.category} identity application by ATHAYA DESIGNED`, { loading: isActive ? "eager" : "lazy", fetchPriority: isActive ? "high" : "low" })} />
        </div>
      `;
    })
    .join("");
}

function renderCapabilityTrack() {
  const group = services
    .map((service) => `<span class="capability-item">${service}</span><span class="capability-separator">/</span>`)
    .join("");
  return `<div class="capability-group">${group}</div><div class="capability-group" aria-hidden="true">${group}</div>`;
}

function renderTestimonialLogo(item, className = "testimonial-logo") {
  const name = item?.name || item?.organization || "Testimonial";
  if (item?.logo) {
    return `<img ${imageAttrs(item.logo, item.alt || `${name} logo`, { className, loading: "lazy" })} />`;
  }

  return `<span class="${className} testimonial-logo--text" aria-label="${escapeAttr(name)}">${escapeHtml(name)}</span>`;
}

function renderTestimonialCardLogo(item, name) {
  if (!item?.logo) return `<span class="testimonial-card__logo-placeholder" aria-hidden="true"></span>`;

  const logoId = String(item.id || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `<img ${imageAttrs(item.logo, item.alt || `${name} logo`, { className: `testimonial-logo testimonial-logo--${logoId}`, loading: "lazy" })} />`;
}

function renderTestimonialCard(item, index) {
  const name = item.name || `Testimonial ${String(index + 1).padStart(2, "0")}`;
  const category = item.category || "Identity Work";
  const meta = [item.role, item.organization].filter(Boolean).join(" / ");

  return `
    <article class="testimonial-card">
      <div class="testimonial-card__quote" aria-hidden="true">“</div>
      <p>${escapeHtml(item.quote || "")}</p>
      <footer class="testimonial-card__footer">
        <div class="testimonial-card__logo">
          ${renderTestimonialCardLogo(item, name)}
        </div>
        <div>
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(meta || category)}</span>
        </div>
      </footer>
    </article>
  `;
}

function renderTestimonialsSection() {
  const content = homeContent.testimonials || {};
  const cards = testimonials.length ? testimonials : content.items || [];
  if (!cards.length) return "";

  return `
    <section class="testimonials" aria-labelledby="testimonials-title">
      <div class="testimonials-intro" data-reveal>
        <div>
          ${label(content.label || "TESTIMONIALS")}
          <h2 id="testimonials-title">${escapeHtml(content.headline || "TRUSTED BY TEAMS, BRANDS, AND CREATORS")}</h2>
        </div>
        <p>${escapeHtml(content.supportingCopy || "Words from clients, collaborators, and organizations I’ve worked with across identity, mascot, typography, and brand systems.")}</p>
      </div>
      <div class="testimonial-controls" data-reveal>
        <button class="testimonial-arrow" type="button" aria-label="Previous testimonial" data-testimonial-prev>
          <svg viewBox="0 0 40 24" aria-hidden="true" focusable="false"><path d="M33 12H10M17 5L10 12L17 19" /></svg>
        </button>
        <button class="testimonial-arrow" type="button" aria-label="Next testimonial" data-testimonial-next>
          <svg viewBox="0 0 40 24" aria-hidden="true" focusable="false"><path d="M7 12H30M23 5L30 12L23 19" /></svg>
        </button>
      </div>
      <div class="testimonial-rail" data-testimonial-rail>
        ${cards.map(renderTestimonialCard).join("")}
      </div>
    </section>
  `;
}

function render() {
  cleanupMotion?.();
  cleanupChapterScroll?.();
  cleanupTestimonialsScroll?.();
  cleanupFontFit?.();
  cleanupChapterScroll = null;
  cleanupTestimonialsScroll = null;
  cleanupFontFit = null;
  if (chapterChangeTimer) {
    window.clearTimeout(chapterChangeTimer);
    chapterChangeTimer = null;
  }
  document.body.classList.remove("menu-lock");
  const route = getRoute();

  if (route.name === "admin") {
    setPageBackground("", false);
    document.body.innerHTML = `<div id="admin-root"></div>`;
    import("./admin/AdminApp.jsx").then(({ mountAdmin }) => {
      mountAdmin(document.getElementById("admin-root"), {
        initialContent: appContent,
        reloadContent: async () => {
          const next = await loadAllContent({ force: true });
          applyContent(next);
          return next;
        },
      });
    });
    return;
  }

  if (route.name === "work") {
    renderWorkArchive();
    return;
  }

  if (route.name === "work-detail") {
    renderWorkDetail(route.slug);
    return;
  }

  if (route.name === "fonts") {
    renderFontsArchive();
    return;
  }

  if (route.name === "font-detail") {
    renderFontDetail(route.slug);
    return;
  }

  if (route.name === "about") {
    setPageBackground("");
    setPageSEO(
      "about",
      "About ATHAYA DESIGNED - Independent Sports Identity Designer",
      "Learn about Athaya Designed, the personal identity design practice of Ahmad Athaya Nurhani.",
    );
    document.body.innerHTML = renderAboutPage({ renderHeader, renderFooter, btn, label, imageAttrs, discoveryCallLabel: DISCOVERY_CALL_LABEL, discoveryCallUrl: DISCOVERY_CALL_URL, content: appContent.about });
    bind();
    cleanupMotion = initHomeMotion(document);
    return;
  }

  if (route.name === "contact") {
    setPageBackground(appContent.contact?.backgroundImage);
    setPageSEO(
      "contact",
      "Start a Project - ATHAYA DESIGNED",
      "Start an identity mark, mascot identity, athletic branding, school branding, or visual identity system with Athaya Designed.",
    );
    document.body.innerHTML = renderContactPage({ renderHeader, renderFooter, btn, label, discoveryCallLabel: DISCOVERY_CALL_LABEL, discoveryCallUrl: DISCOVERY_CALL_URL, content: appContent.contact });
    bind();
    cleanupMotion = initHomeMotion(document);
    return;
  }

  if (route.name === "services") {
    setPageBackground(appContent.services?.hero?.backgroundImage);
    setPageSEO(
      "services",
      "Services - Mascot Logo, Athletic Identity & School Branding",
      "Premium identity design services for teams, schools, clubs, creators, and brands, including mascot marks, athletic identity systems, school branding, lettermarks, apparel applications, and brand guidelines.",
    );
    renderServicesPage({ renderHeader, renderFooter, btn, label, setMeta, discoveryCallLabel: DISCOVERY_CALL_LABEL, discoveryCallUrl: DISCOVERY_CALL_URL, content: appContent.services });
    bind();
    cleanupMotion = initHomeMotion(document);
    return;
  }

  setPageBackground("", false);
  setPageSEO(
    "home",
    "ATHAYA DESIGNED - Sports Identity & Mascot Logo Design Studio",
    "ATHAYA DESIGNED creates mascot logos, athletic identity systems, school branding, apparel applications, and complete visual identity systems for teams, schools, communities, and sports brands.",
  );
  if (activeProject >= featuredProjects.length) activeProject = 0;
  if (activeChapter >= chapters.length) activeChapter = 0;
  const project = featuredProjects[activeProject] || featuredProjects[0];
  const chapter = chapters[activeChapter] || chapters[0];

  document.body.innerHTML = `
    ${renderHeader()}

    <main>
      <section class="featured-hero" id="work">
        <div class="hero-frame">
          <div class="hero-stage" data-hero-stage>
            ${renderHeroSlides()}
            <div class="hero-side-mask hero-side-mask--left"></div>
            <div class="hero-side-mask hero-side-mask--right"></div>
          </div>
          <div class="hero-vignette"></div>
          <button class="hero-arrow hero-arrow--left" type="button" aria-label="Previous featured project" data-prev>
            <svg viewBox="0 0 40 32" aria-hidden="true" focusable="false"><path d="M32 16H9.5M18 8L9.5 16L18 24" /></svg>
          </button>
          <button class="hero-arrow hero-arrow--right" type="button" aria-label="Next featured project" data-next>
            <svg viewBox="0 0 40 32" aria-hidden="true" focusable="false"><path d="M8 16H30.5M22 8L30.5 16L22 24" /></svg>
          </button>
          <div class="hero-meta-bar" data-hero-meta>
            <div class="project-count"><span>${project.number}</span><span>/ ${String(featuredProjects.length).padStart(2, "0")}</span></div>
            <div class="project-kicker"><strong>${project.title}</strong></div>
            <div class="project-dashes">${featuredProjects.map((item, index) => `<button type="button" class="${index === activeProject ? "is-active" : ""}" aria-label="Show featured project ${index + 1}: ${escapeAttr(item.title)}" aria-pressed="${index === activeProject ? "true" : "false"}" data-dot="${index}"></button>`).join("")}</div>
          </div>
        </div>
      </section>

      <section class="headline-section">
        <div data-headline-stagger>
          <h1>${homeContent.headline.line1}<br />${homeContent.headline.line2}</h1>
          <div class="headline-rule"></div>
          <div class="button-row">${btn(homeContent.headline.primaryCtaLabel, homeContent.headline.primaryCtaUrl)}${btn(homeContent.headline.secondaryCtaLabel, homeContent.headline.secondaryCtaUrl, "outline")}</div>
        </div>
        <div class="headline-copy" data-reveal>
          <p>${homeContent.headline.supportingParagraph}</p>
        </div>
      </section>

      <section class="what-row" data-reveal>
        <span>What We Do</span>
        <div class="capability-marquee" aria-label="${services.join(", ")}">
          <div class="capability-track">${renderCapabilityTrack()}</div>
        </div>
      </section>

      <section class="case-study" id="about" data-case-study>
        <div class="case-sticky">
          <aside class="chapter-list" aria-label="Featured case study chapters">
            ${chapters.map((item, index) => `<button type="button" class="${index === activeChapter ? "is-active" : ""}" aria-label="Show case study chapter ${item.number}: ${escapeAttr(item.title)}" aria-pressed="${index === activeChapter ? "true" : "false"}" data-chapter="${index}"><span>${item.number}</span>${item.title}</button>`).join("")}
          </aside>
          <div class="case-content">
            <div class="case-text" data-case-text>
              ${renderCasePanel(chapter)}
            </div>
            <div class="case-collage" data-case-collage>
              ${renderCaseCollage(chapter.images, chapter.heading)}
            </div>
          </div>
        </div>
      </section>

      <section class="selected-work" id="selected-work">
        <div class="section-heading" data-reveal><h2>${homeContent.selectedWork.sectionTitle}</h2><a href="${homeContent.selectedWork.viewAllUrl}" data-router-link>${homeContent.selectedWork.viewAllLabel} ${arrowIcon()}</a></div>
        <div class="work-grid">
          ${selectedWork.map((item, index) => `
            <a href="/work/${item.slug}" class="work-card" data-reveal data-router-link>
              <img ${imageAttrs(item.image, `${item.title} ${item.category} project preview by ATHAYA DESIGNED`, { loading: "lazy" })} />
              <div class="work-card-content"><span>${item.category} / ${item.year}</span><strong>${item.title}</strong><em>${arrowIcon()}</em></div>
            </a>
          `).join("")}
        </div>
      </section>

      ${renderTestimonialsSection()}

      <section class="approach" id="services">
        <div class="approach-intro" data-reveal>
          ${label("Process")}
          <h2>${homeContent.approach.headline.replace(/\n/g, "<br />")}</h2>
          <p>${homeContent.approach.paragraph}</p>
          <a class="text-link" href="${homeContent.approach.ctaUrl}" data-router-link>${homeContent.approach.ctaLabel} ${arrowIcon()}</a>
        </div>
        <div class="approach-strip" data-image-reveal>
          ${approachImages
            .map(
              (image, index) => `
                <figure class="approach-image approach-image--${index + 1}">
                  <img ${imageAttrs(image, `ATHAYA DESIGNED character-driven identity process detail ${index + 1}`, { loading: "lazy" })} />
                </figure>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="prefooter-cta" data-reveal>
        <h2>${homeContent.footerCta.headline.replace(/\n/g, "<br />")}</h2>
        <p>${homeContent.footerCta.paragraph}</p>
        <div class="prefooter-meta">
          <span>${siteSettings.email}</span>
          <span>${siteSettings.studioSublabel}</span>
        </div>
        ${btn(homeContent.footerCta.ctaLabel, homeContent.footerCta.ctaUrl, "outline")}
      </section>
    </main>

    ${renderFooter()}
  `;

  bind();
  cleanupMotion = initHomeMotion(document);

  const syncInitialHash = () => {
    const target = window.location.hash ? document.querySelector(window.location.hash) : null;
    if (target) {
      smoothScrollProvider?.scrollTo(target, { immediate: true });
    }
  };
  window.requestAnimationFrame(syncInitialHash);
  window.setTimeout(syncInitialHash, 80);
  window.setTimeout(syncInitialHash, 320);
}

function renderFontsArchive() {
  setPageBackground("");
  setPageSEO(
    "fonts",
    "Fonts - ATHAYA DESIGNED",
    "Explore ATHAYA DESIGNED display fonts, sports-inspired typefaces, and lettering systems for bold identities, apparel graphics, and team branding.",
  );

  document.body.innerHTML = `
    ${renderHeader()}
    ${renderFontsPage({ arrowIcon, label, imageAttrs })}
    ${renderFooter()}
  `;

  bind();
  cleanupMotion = initHomeMotion(document);
}

function renderFontDetail(slug) {
  const font = getFontBySlug(slug);
  if (!font) {
    renderMissingFont();
    return;
  }

  setPageBackground(font.backgroundImage);
  setPageSEO("font-detail", `${font.name} - Display Typeface for Sports Graphics | ATHAYA DESIGNED`, font.description, slug);

  document.body.innerHTML = `
    ${renderHeader()}
    ${renderFontDetailPage(slug, { arrowIcon, label })}
    ${renderFooter()}
  `;

  bind();
  cleanupMotion = initHomeMotion(document);
}

function renderMissingFont() {
  setPageBackground("");
  setMeta("Font Not Found \u2014 ATHAYA DESIGNED Fonts", "The requested ATHAYA DESIGNED font could not be found.");
  document.body.innerHTML = `
    ${renderHeader()}
    <main class="fonts-page">
      <section class="not-found-work" data-headline-stagger>
        ${label("Font Not Found")}
        <h1>That Font Is Not In The Collection.</h1>
        <p>The font may have moved, or the link may be using an older slug.</p>
        ${btn("Back to Fonts", "/fonts", "outline")}
      </section>
    </main>
    ${renderFooter()}
  `;
  bind();
  cleanupMotion = initHomeMotion(document);
}

function renderWorkArchive() {
  setPageBackground("");
  setPageSEO(
    "work",
    "Selected Work - Sports Identity, Mascot Logos & Athletic Branding | ATHAYA DESIGNED",
    "Explore selected identity marks, mascot identities, lettermarks, typography, athletic branding, school branding, and visual identity systems by Athaya Designed.",
  );

  const filters = ["All", "Brand Identity", "Mascot Logo", "Typography", "Lettermark", "Apparel"];

  document.body.innerHTML = `
    ${renderHeader()}
    <main class="work-page">
      <section class="work-archive-hero" data-headline-stagger>
        ${label("Selected Work")}
        <h1>Selected Identity Work.</h1>
        <p>A collection of mascot marks, athletic identities, school branding, apparel systems, and visual identities built to perform across every touchpoint.</p>
      </section>
      <section class="work-filter-row" aria-label="Work filters" data-reveal>
        ${filters.map((filter, index) => `<button type="button" class="${index === 0 ? "is-active" : ""}" data-work-filter="${filter}">${filter}</button>`).join("")}
      </section>
      <section class="work-archive-grid" aria-label="ATHAYA DESIGNED selected projects">
        ${works.map((work, index) => renderArchiveCard(work, index)).join("")}
      </section>
    </main>
    ${renderFooter()}
  `;

  bind();
  bindWorkFilters();
  cleanupMotion = initHomeMotion(document);
}

function renderArchiveCard(work, index) {
  return `
    <a class="work-card work-archive-card ${index === 0 || index === works.length - 1 ? "work-archive-card--wide" : ""}" href="/work/${work.slug}" data-category="${work.category} ${work.services.join(" ")}" data-reveal data-router-link>
      <img ${imageAttrs(work.coverImage, `${work.title} ${work.category} case study preview by ATHAYA DESIGNED`, { loading: index < 2 ? "eager" : "lazy", fetchPriority: index === 0 ? "high" : undefined })} />
      <div class="work-card-content">
        <span>${work.category} / ${work.year}</span>
        <strong>${work.title}</strong>
        <p>${work.summary}</p>
        <em>${arrowIcon()}</em>
      </div>
    </a>
  `;
}

function bindWorkFilters() {
  const buttons = document.querySelectorAll("[data-work-filter]");
  const cards = document.querySelectorAll("[data-category]");
  const map = {
    All: "",
    "Brand Identity": "Brand Identity",
    "Mascot Logo": "Mascot Logo",
    Typography: "Typography",
    Lettermark: "Lettermark",
    Apparel: "Apparel",
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const query = map[button.dataset.workFilter] || "";
      buttons.forEach((item) => item.classList.toggle("is-active", item === button));
      cards.forEach((card) => {
        const visible = !query || card.dataset.category.includes(query);
        card.hidden = !visible;
      });
    });
  });
}

function bindServiceCards() {
  const cards = document.querySelectorAll("[data-service-card]");
  if (!cards.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  cards.forEach((card) => {
    const summary = card.querySelector("summary");
    const panel = card.querySelector(".service-row__details");
    if (!summary || !panel) return;

    if (card.open) {
      card.dataset.expanded = "true";
      panel.style.height = "auto";
    }

    summary.addEventListener("click", (event) => {
      event.preventDefault();

      if (card.dataset.animating === "true") return;

      const isOpen = card.open;
      card.dataset.animating = "true";

      if (reducedMotion) {
        card.open = !isOpen;
        card.dataset.expanded = String(!isOpen);
        panel.style.height = card.open ? "auto" : "0px";
        card.dataset.animating = "false";
        return;
      }

      if (!isOpen) {
        card.open = true;
        card.dataset.expanded = "false";
        panel.style.height = "0px";
        panel.offsetHeight;

        const finishOpen = () => {
          panel.style.height = "auto";
          card.dataset.animating = "false";
        };
        const fallback = window.setTimeout(finishOpen, 620);

        window.requestAnimationFrame(() => {
          card.dataset.expanded = "true";
          panel.style.height = `${panel.scrollHeight}px`;
        });

        panel.addEventListener(
          "transitionend",
          (transitionEvent) => {
            if (transitionEvent.propertyName !== "height") return;
            window.clearTimeout(fallback);
            finishOpen();
          },
          { once: true },
        );
        return;
      }

      panel.style.height = `${panel.scrollHeight}px`;
      panel.offsetHeight;
      card.dataset.expanded = "false";

      window.requestAnimationFrame(() => {
        panel.style.height = "0px";
      });

      const finishClose = () => {
        card.open = false;
        card.dataset.expanded = "false";
        panel.style.height = "0px";
        card.dataset.animating = "false";
      };
      const fallback = window.setTimeout(finishClose, 620);

      panel.addEventListener(
        "transitionend",
        (transitionEvent) => {
          if (transitionEvent.propertyName !== "height") return;
          window.clearTimeout(fallback);
          finishClose();
        },
        { once: true },
      );
    });
  });
}

function renderWorkStory(work, sections) {
  if (work.slug === "quick-showcase") {
    return `
      <section class="quick-showcase-summary" data-reveal>
        <div class="quick-showcase-summary__intro">
          <span>Showcase Notes</span>
          <h2>A visual archive of mascot marks, gaming identities, and fast-moving brand explorations.</h2>
        </div>
        <div class="quick-showcase-summary__copy">
          <p>${work.sections.overview}</p>
          <p>${work.sections.challenge}</p>
        </div>
        <div class="quick-showcase-summary__meta" aria-label="${work.title} showcase details">
          <span><strong>23+</strong><em>Design pieces</em></span>
          <span><strong>${work.year}</strong><em>Selected range</em></span>
          <span><strong>Archive</strong><em>Visual-first format</em></span>
        </div>
      </section>
    `;
  }

  return `
    <section class="case-study-sections">
      ${sections.map(([number, heading, copy]) => `
        <article class="case-study-section" data-reveal>
          <span>${number}</span>
          <h2>${heading}</h2>
          <p>${copy}</p>
        </article>
      `).join("")}
    </section>
  `;
}

function renderWorkDetail(slug) {
  const work = getWorkBySlug(slug);
  if (!work) {
    renderMissingWork();
    return;
  }

  setPageBackground(work.backgroundImage);
  const next = getNextWork(slug);
  const sections = [
    ["01", "Overview", work.sections.overview],
    ["02", "Challenge", work.sections.challenge],
    ["03", "Solution", work.sections.solution],
    ["04", "The System", work.sections.system],
    ["05", "Applications", work.sections.applications],
    ["06", "Results", work.sections.results],
  ];

  setPageSEO("work-detail", `${work.title} - ATHAYA DESIGNED`, work.summary || work.description, slug);

  document.body.innerHTML = `
    ${renderHeader()}
    <main class="work-page work-detail-page">
      <section class="work-detail-hero" data-image-reveal>
        <img ${imageAttrs(work.heroImage, `${work.title} ${work.category} hero image by ATHAYA DESIGNED`, { loading: "eager", fetchPriority: "high" })} />
        <div class="work-detail-hero__overlay">
          <a class="back-link" href="/work" data-router-link>${arrowIcon("inline-arrow inline-arrow--back")} Back to Work</a>
        </div>
      </section>

      <section class="work-detail-intro" data-headline-stagger>
        <span>${work.category} / ${work.year}</span>
        <h1>${work.title}</h1>
        <p>${work.description}</p>
      </section>

      <section class="work-detail-meta" data-reveal>
        <div>
          <span>Category</span>
          <strong>${work.category}</strong>
        </div>
        <div>
          <span>Year</span>
          <strong>${work.year}</strong>
        </div>
        <div>
          <span>Services</span>
          <strong>${work.services.join(" / ")}</strong>
        </div>
      </section>

      ${work.stats?.length ? `
        <section class="work-detail-stats" aria-label="${work.title} project stats" data-reveal>
          ${work.stats.map((stat) => `<span><strong>${stat.value}</strong><em>${stat.label}</em></span>`).join("")}
        </section>
      ` : ""}

      ${renderWorkStory(work, sections)}

      <section class="work-gallery" aria-label="${work.title} gallery">
        ${work.gallery.map((image, index) => `
          <figure class="${index === 0 ? "work-gallery__item work-gallery__item--wide" : "work-gallery__item"}" data-image-reveal>
            <img ${imageAttrs(image, `${work.title} identity application ${index + 1} by ATHAYA DESIGNED`, { loading: "lazy" })} />
          </figure>
        `).join("")}
      </section>

      <section class="next-project" data-reveal>
        <a href="/work/${next.slug}" data-router-link>
          <span>Next Project</span>
          <strong>${next.title}</strong>
          <em>${next.category}</em>
          ${arrowIcon()}
        </a>
      </section>

      <section class="prefooter-cta work-detail-cta" data-reveal>
        <h2>Ready To Build Your Identity?</h2>
        <p>Tell me about your team, school, community, or brand and let's create an identity that feels established, recognizable, and built to last.</p>
        <div class="prefooter-meta">
          <span>ATHAYA DESIGNED</span>
          <span>Independent Sports Identity Practice</span>
        </div>
        ${btn("Start a Project", "/contact", "outline")}
      </section>
    </main>
    ${renderFooter()}
  `;

  bind();
  cleanupMotion = initHomeMotion(document);
}

function renderMissingWork() {
  setMeta("Work Not Found - ATHAYA DESIGNED", "The requested ATHAYA DESIGNED work project could not be found.");
  document.body.innerHTML = `
    ${renderHeader()}
    <main class="work-page">
      <section class="not-found-work" data-headline-stagger>
        ${label("Work Not Found")}
        <h1>That Project Is Not In The Archive.</h1>
        <p>The work may have moved, or the link may be using an older project slug.</p>
        ${btn("Back to Work", "/work", "outline")}
      </section>
    </main>
    ${renderFooter()}
  `;
  bind();
  cleanupMotion = initHomeMotion(document);
}

function bind() {
  cleanupNavScroll?.();
  cleanupKeydown?.();
  const navbar = document.querySelector("[data-navbar]");
  const syncNavbar = () => {
    navbar?.classList.toggle("is-condensed", window.scrollY > 18);
  };
  let navFrame = null;
  const onNavScroll = () => {
    if (navFrame) return;
    navFrame = window.requestAnimationFrame(() => {
      navFrame = null;
      syncNavbar();
    });
  };
  syncNavbar();
  window.addEventListener("scroll", onNavScroll, { passive: true });
  cleanupNavScroll = () => {
    if (navFrame) window.cancelAnimationFrame(navFrame);
    window.removeEventListener("scroll", onNavScroll);
  };

  const fitFontPreviews = () => {
    document.querySelectorAll("[data-fit-font]").forEach((item) => {
      item.style.fontSize = "";
      item.style.transform = "";
      const computed = window.getComputedStyle(item);
      const startSize = Number.parseFloat(computed.fontSize) || 64;
      const minSize = Number(item.dataset.minFontSize || 18);
      const parent = item.parentElement;
      const parentStyle = parent ? window.getComputedStyle(parent) : null;
      const parentPadding =
        (Number.parseFloat(parentStyle?.paddingLeft || "0") || 0) +
        (Number.parseFloat(parentStyle?.paddingRight || "0") || 0);
      const maxWidth = parent ? Math.max(1, parent.clientWidth - parentPadding) : item.clientWidth;
      const maxHeight = parent ? Math.max(1, parent.clientHeight * 0.52) : Number.POSITIVE_INFINITY;
      let low = minSize;
      let high = startSize;
      let fitted = minSize;

      for (let index = 0; index < 12; index += 1) {
        const size = (low + high) / 2;
        item.style.fontSize = `${size}px`;
        if (item.scrollWidth <= maxWidth && item.scrollHeight <= maxHeight) {
          fitted = size;
          low = size;
        } else {
          high = size;
        }
      }

      item.style.fontSize = `${Math.floor(fitted)}px`;
      if (item.scrollWidth > maxWidth) {
        const scale = Math.max(0.68, Math.min(1, maxWidth / item.scrollWidth));
        item.style.transform = `scaleX(${scale})`;
      }
    });
  };

  let fontFitFrame = null;
  const scheduleFontFit = () => {
    if (fontFitFrame) window.cancelAnimationFrame(fontFitFrame);
    fontFitFrame = window.requestAnimationFrame(() => {
      fontFitFrame = null;
      fitFontPreviews();
    });
  };
  scheduleFontFit();
  document.fonts?.ready?.then(scheduleFontFit);
  window.addEventListener("resize", scheduleFontFit);
  cleanupFontFit = () => {
    if (fontFitFrame) window.cancelAnimationFrame(fontFitFrame);
    window.removeEventListener("resize", scheduleFontFit);
  };

  const overlay = document.querySelector("[data-overlay]");
  const toggle = document.querySelector("[data-menu-toggle]");
  let lastMenuTrigger = null;
  const setMenu = async (open) => {
    if (!overlay || !toggle) return;
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("menu-lock", open);
    if (open) {
      lastMenuTrigger = document.activeElement;
      openMenuMotion(overlay);
      window.requestAnimationFrame(() => {
        overlay.querySelector("[data-menu-close]")?.focus();
      });
    } else {
      await closeMenuMotion(overlay);
      if (lastMenuTrigger && typeof lastMenuTrigger.focus === "function") {
        lastMenuTrigger.focus();
      }
    }
  };

  toggle?.addEventListener("click", () => setMenu(overlay.hidden));
  document.querySelector("[data-menu-close]")?.addEventListener("click", () => setMenu(false));
  document.querySelectorAll("[data-menu-link]").forEach((item) => item.addEventListener("click", () => setMenu(false)));
  const onKeydown = (event) => {
    if (event.key === "Escape") setMenu(false);
    if (event.key === "ArrowLeft") {
      activeProject = (activeProject + featuredProjects.length - 1) % featuredProjects.length;
      updateHeroProject();
    }
    if (event.key === "ArrowRight") {
      activeProject = (activeProject + 1) % featuredProjects.length;
      updateHeroProject();
    }
  };
  window.addEventListener("keydown", onKeydown);
  cleanupKeydown = () => window.removeEventListener("keydown", onKeydown);

  document.querySelector("[data-prev]")?.addEventListener("click", () => {
    activeProject = (activeProject + featuredProjects.length - 1) % featuredProjects.length;
    updateHeroProject();
  });
  document.querySelector("[data-next]")?.addEventListener("click", () => {
    activeProject = (activeProject + 1) % featuredProjects.length;
    updateHeroProject();
  });
  document.querySelectorAll("[data-dot]").forEach((item) => {
    item.addEventListener("click", () => {
      activeProject = Number(item.dataset.dot);
      updateHeroProject();
    });
  });

  const updateHeroProject = () => {
    const project = featuredProjects[activeProject];
    const heroFrame = document.querySelector(".hero-frame");
    if (!heroFrame) return;

    document.querySelectorAll("[data-hero-slide]").forEach((slide, index) => {
      const state = getHeroSlideState(index);
      slide.dataset.slideState = state;
      slide.setAttribute("aria-hidden", state === "active" ? "false" : "true");
      slide.classList.toggle("hero-slide--active", state === "active");
      slide.classList.toggle("hero-slide--previous", state === "previous");
      slide.classList.toggle("hero-slide--next", state === "next");
      slide.classList.toggle("hero-slide--hidden", state === "hidden");
    });
    document.querySelector(".project-count").innerHTML = `<span>${project.number}</span><span>/ ${String(featuredProjects.length).padStart(2, "0")}</span>`;
    document.querySelector(".project-kicker strong").textContent = project.title;
    document.querySelectorAll("[data-dot]").forEach((dot, index) => {
      dot.classList.toggle("is-active", index === activeProject);
      dot.setAttribute("aria-pressed", index === activeProject ? "true" : "false");
    });
    animateHeroProject(heroFrame);
  };

  const updateChapter = (index, options = {}) => {
    if (index === activeChapter && !options.force) return;
    activeChapter = Math.max(0, Math.min(chapters.length - 1, index));
    const nextChapter = chapters[activeChapter];
    const text = document.querySelector("[data-case-text]");
    const collage = document.querySelector("[data-case-collage]");
    if (!text || !collage) return;

    document.querySelectorAll("[data-chapter]").forEach((button, buttonIndex) => {
      button.classList.toggle("is-active", buttonIndex === activeChapter);
      button.setAttribute("aria-pressed", buttonIndex === activeChapter ? "true" : "false");
    });

    if (chapterChangeTimer) {
      window.clearTimeout(chapterChangeTimer);
      chapterChangeTimer = null;
    }

    text.classList.add("is-changing");
    collage.classList.add("is-changing");
    chapterChangeTimer = window.setTimeout(() => {
      chapterChangeTimer = null;
      text.innerHTML = renderCasePanel(nextChapter);
      collage.innerHTML = renderCaseCollage(nextChapter.images, nextChapter.heading);
      text.classList.remove("is-changing");
      collage.classList.remove("is-changing");
      animateCaseChapter(text, collage);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
  };

  const syncChapterFromScroll = () => {
    const section = document.querySelector("[data-case-study]");
    if (!section || window.innerWidth < 981) return;
    const rect = section.getBoundingClientRect();
    const maxTravel = Math.max(1, section.offsetHeight - window.innerHeight);
    const progress = Math.min(0.999, Math.max(0, -rect.top / maxTravel));
    const chapterStep = 1 / chapters.length;
    const stableProgress = Math.min(0.999, Math.max(0, progress + chapterStep * 0.08));
    updateChapter(Math.floor(stableProgress * chapters.length));
  };

  const caseStudySection = document.querySelector("[data-case-study]");
  if (caseStudySection) {
    let scrollFrame;
    const onChapterScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = null;
        syncChapterFromScroll();
      });
    };

    window.addEventListener("scroll", onChapterScroll, { passive: true });
    window.addEventListener("resize", syncChapterFromScroll);
    syncChapterFromScroll();
    cleanupChapterScroll = () => {
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", onChapterScroll);
      window.removeEventListener("resize", syncChapterFromScroll);
    };
  }

  document.querySelectorAll("[data-chapter]").forEach((item) => {
    item.addEventListener("click", () => {
      const index = Number(item.dataset.chapter);
      const section = document.querySelector("[data-case-study]");
      if (section && window.innerWidth >= 981) {
        const maxTravel = Math.max(1, section.offsetHeight - window.innerHeight);
        const target = section.offsetTop + (maxTravel * index) / chapters.length + 4;
        smoothScrollProvider?.scrollTo(target);
      } else {
        updateChapter(index);
      }
    });
  });

  bindServiceCards();

  const testimonialRail = document.querySelector("[data-testimonial-rail]");
  const testimonialPrev = document.querySelector("[data-testimonial-prev]");
  const testimonialNext = document.querySelector("[data-testimonial-next]");
  if (testimonialRail && testimonialPrev && testimonialNext) {
    const getCarouselMetrics = () => {
      const card = testimonialRail.querySelector(".testimonial-card");
      const styles = window.getComputedStyle(testimonialRail);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      const cardWidth = card ? card.getBoundingClientRect().width : testimonialRail.clientWidth;
      const step = Math.max(1, cardWidth + gap);
      const maxScrollLeft = Math.max(0, testimonialRail.scrollWidth - testimonialRail.clientWidth);
      return { step, maxScrollLeft };
    };
    const clampTestimonialScroll = (value, maxScrollLeft = getCarouselMetrics().maxScrollLeft) => {
      return Math.max(0, Math.min(value, maxScrollLeft));
    };
    const syncTestimonialControls = () => {
      const { maxScrollLeft } = getCarouselMetrics();
      const canScroll = maxScrollLeft > 2;
      const scrollLeft = clampTestimonialScroll(testimonialRail.scrollLeft, maxScrollLeft);
      testimonialPrev.hidden = !canScroll;
      testimonialNext.hidden = !canScroll;
      testimonialPrev.setAttribute("aria-hidden", canScroll ? "false" : "true");
      testimonialNext.setAttribute("aria-hidden", canScroll ? "false" : "true");
      if (!canScroll) return;
      if (Math.abs(testimonialRail.scrollLeft - scrollLeft) > 0.5) testimonialRail.scrollLeft = scrollLeft;
      const isAtStart = scrollLeft <= 2;
      const isAtEnd = scrollLeft >= maxScrollLeft - 2;
      testimonialPrev.disabled = isAtStart;
      testimonialNext.disabled = isAtEnd;
      testimonialPrev.setAttribute("aria-disabled", String(isAtStart));
      testimonialNext.setAttribute("aria-disabled", String(isAtEnd));
    };
    const scrollTestimonials = (direction) => {
      const { step, maxScrollLeft } = getCarouselMetrics();
      const nextScrollLeft = clampTestimonialScroll(testimonialRail.scrollLeft + step * direction, maxScrollLeft);
      testimonialRail.scrollTo({
        left: nextScrollLeft,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
      window.setTimeout(syncTestimonialControls, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 620);
    };
    testimonialPrev.addEventListener("click", () => scrollTestimonials(-1));
    testimonialNext.addEventListener("click", () => scrollTestimonials(1));
    testimonialRail.addEventListener("scroll", syncTestimonialControls, { passive: true });
    window.addEventListener("resize", syncTestimonialControls);
    window.requestAnimationFrame(syncTestimonialControls);
    cleanupTestimonialsScroll = () => {
      testimonialRail.removeEventListener("scroll", syncTestimonialControls);
      window.removeEventListener("resize", syncTestimonialControls);
    };
  }

  document.querySelector("[data-contact-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = data.get("name") || "";
    const mode = form.dataset.formMode || "mailto";
    const endpoint = form.dataset.formEndpoint || "";
    const email = form.dataset.contactEmail || siteSettings.email || "hello@athayadesigned.com";
    const subject = encodeURIComponent(`Project inquiry from ${name || "ATHAYA DESIGNED site"}`);
    const lines = Array.from(data.entries()).map(([key, value]) => `${key}: ${value}`);
    const body = encodeURIComponent(lines.join("\n"));

    if (mode !== "mailto" && endpoint) {
      fetch(endpoint, { method: "POST", body: data }).catch(() => {
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      });
      form.reset();
      return;
    }

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  });

  document.querySelectorAll("[data-router-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (url.pathname === window.location.pathname && url.hash) return;
      event.preventDefault();
      navigateTo(`${url.pathname}${url.hash}`);
    });
  });
}

async function boot() {
  startSiteLoader();

  try {
    applyContent(await loadAllContent());
    smoothScrollProvider = createSmoothScrollProvider();
    render();
    renderedPath = window.location.pathname;
    window.addEventListener("popstate", () => {
      const shouldReplayHomeLoader = isHomePath(window.location.pathname) && !isHomePath(renderedPath);
      render();
      renderedPath = window.location.pathname;
      if (shouldReplayHomeLoader) replayHomeLoader();
    });
    document.getElementById("root")?.setAttribute("data-app-ready", "true");
    finishSiteLoader();
  } catch (error) {
    document.body.innerHTML = `<main style="min-height:100vh;background:#050505;color:#f3eee7;font-family:Arial,sans-serif;display:grid;place-items:center;padding:32px;text-align:center"><div><p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#d8d8d8;margin:0 0 16px">ATHAYA DESIGNED</p><h1>Homepage Error</h1><p>${String(error && error.message ? error.message : error)}</p></div></main>`;
    finishSiteLoader();
  }
}

boot();
