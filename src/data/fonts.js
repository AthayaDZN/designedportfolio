import { defaultFonts } from "../content/defaultContent.js";

export let fonts = sortFonts(defaultFonts);

function sortFonts(items) {
  return [...(items || [])]
    .filter((font) => font && font.published !== false)
    .sort((a, b) => (Number(a.order || 0) || 0) - (Number(b.order || 0) || 0));
}

export function setFonts(nextFonts) {
  fonts = sortFonts(nextFonts);
}

export function getFontBySlug(slug) {
  return fonts.find((font) => font.slug === slug);
}

export function getRelatedFonts(slug, limit = 3) {
  return fonts.filter((font) => font.slug !== slug).slice(0, limit);
}
