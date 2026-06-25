import {
  defaultAboutContent,
  defaultAssetsContent,
  defaultContactContent,
  defaultContentBundle,
  defaultFonts,
  defaultHomeContent,
  defaultSEOContent,
  defaultServicesContent,
  defaultSiteContent,
  defaultWorks,
} from "./defaultContent.js";

const contentPaths = {
  site: "/content/site.json",
  home: "/content/home.json",
  works: "/content/works.json",
  fonts: "/content/fonts.json",
  services: "/content/services.json",
  about: "/content/about.json",
  contact: "/content/contact.json",
  seo: "/content/seo.json",
  assets: "/content/assets.json",
};

const adminDraftKey = "athaya-admin-draft";

const fallbacks = {
  site: defaultSiteContent,
  home: defaultHomeContent,
  works: defaultWorks,
  fonts: defaultFonts,
  services: defaultServicesContent,
  about: defaultAboutContent,
  contact: defaultContactContent,
  seo: defaultSEOContent,
  assets: defaultAssetsContent,
};

const contentCache = new Map();
let bundlePromise = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getContentTime(content, key) {
  const time =
    content?.site?.[key] ||
    content?.[key] ||
    "";
  const timestamp = Date.parse(time);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeAboutContent(about) {
  if (!about || typeof about !== "object") return about;

  const withUnique = (items, additions) => {
    const next = Array.isArray(items) ? [...items] : [];
    additions.forEach((item) => {
      if (!next.some((existing) => String(existing).toLowerCase() === item.toLowerCase())) {
        next.push(item);
      }
    });
    return next;
  };

  const studioFocus = Array.isArray(about.studioFocus)
    ? about.studioFocus.map((item) => (item === "Lettermarks" ? "Lettermarks & Brandmarks" : item))
    : [];

  return {
    ...about,
    heroImage: about.heroImage || defaultAboutContent.heroImage,
    storyLabel: about.storyLabel || defaultAboutContent.storyLabel,
    storyHeadline: about.storyHeadline || defaultAboutContent.storyHeadline,
    storyParagraphs: Array.isArray(about.storyParagraphs) && about.storyParagraphs.length ? about.storyParagraphs : defaultAboutContent.storyParagraphs,
    founderNoteLabel: about.founderNoteLabel || defaultAboutContent.founderNoteLabel,
    founderNoteHeadline: about.founderNoteHeadline || defaultAboutContent.founderNoteHeadline,
    founderNoteParagraphs: Array.isArray(about.founderNoteParagraphs) && about.founderNoteParagraphs.length ? about.founderNoteParagraphs : defaultAboutContent.founderNoteParagraphs,
    whoWeHelp: withUnique(about.whoWeHelp, ["Online Creators"]),
    studioFocus: withUnique(studioFocus, ["Brand Strategies", "Typography"]),
  };
}

function normalizeContentBundle(bundle) {
  return {
    ...bundle,
    about: normalizeAboutContent(bundle.about),
  };
}

export function getDefaultContentBundle() {
  return normalizeContentBundle(clone(defaultContentBundle));
}

export async function loadContentFile(key, options = {}) {
  const fallback = clone(fallbacks[key]);
  const path = contentPaths[key];
  if (!path || typeof fetch !== "function") return fallback;
  const force = Boolean(options.force);

  if (!force && contentCache.has(key)) {
    return clone(contentCache.get(key));
  }

  try {
    const response = await fetch(path, { cache: force ? "no-store" : "default" });
    if (!response.ok) return fallback;
    const data = await response.json();
    const next = key === "about" ? normalizeAboutContent(data || fallback) : data || fallback;
    contentCache.set(key, clone(next));
    return next;
  } catch (error) {
    return fallback;
  }
}

export function loadSiteContent() {
  return loadContentFile("site");
}

export function loadHomeContent() {
  return loadContentFile("home");
}

export function loadWorks() {
  return loadContentFile("works");
}

export function loadFonts() {
  return loadContentFile("fonts");
}

export function loadServices() {
  return loadContentFile("services");
}

export function loadAbout() {
  return loadContentFile("about");
}

export function loadContact() {
  return loadContentFile("contact");
}

export function loadSEO() {
  return loadContentFile("seo");
}

export async function loadAllContent(options = {}) {
  if (!options.force && bundlePromise) return bundlePromise;

  bundlePromise = (async () => {
  const keys = Object.keys(contentPaths);
  const entries = await Promise.all(keys.map(async (key) => [key, await loadContentFile(key, options)]));
  const loaded = Object.fromEntries(entries);

  try {
    const canUseDraft =
      Boolean(options.includeDraft) ||
      (typeof window !== "undefined" && window.location?.pathname.replace(/\/+$/, "") === "/admin");
    const draft = canUseDraft && typeof window !== "undefined" ? window.localStorage.getItem(adminDraftKey) : null;
    if (!draft) return normalizeContentBundle(loaded);
    const parsed = JSON.parse(draft);
    if (!parsed || typeof parsed !== "object") return normalizeContentBundle(loaded);
    const draftTime = getContentTime(parsed, "draftUpdatedAt") || getContentTime(parsed, "lastSavedAt");
    const loadedTime = getContentTime(loaded, "lastSavedAt");
    if (loadedTime && draftTime && draftTime < loadedTime) return normalizeContentBundle(loaded);
    if (loadedTime && !draftTime) return normalizeContentBundle(loaded);
    return normalizeContentBundle({ ...loaded, ...parsed });
  } catch (error) {
    return normalizeContentBundle(loaded);
  }
  })();

  return bundlePromise;
}

export { contentPaths };
