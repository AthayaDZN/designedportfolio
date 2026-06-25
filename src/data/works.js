import { defaultWorks } from "../content/defaultContent.js";

export let works = defaultWorks;

function sortWorks(items) {
  return [...(items || [])]
    .filter((work) => work && work.published !== false)
    .sort((a, b) => (Number(a.order || 0) || 0) - (Number(b.order || 0) || 0));
}

export function setWorks(nextWorks) {
  works = sortWorks(nextWorks);
}

export function getWorkBySlug(slug) {
  return works.find((work) => work.slug === slug);
}

export function getNextWork(slug) {
  const index = works.findIndex((work) => work.slug === slug);
  if (index < 0) return works[0];
  return works[(index + 1) % works.length] || works[0];
}
