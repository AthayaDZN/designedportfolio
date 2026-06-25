import { defaultHomeContent } from "./content/defaultContent.js";

function ordered(items) {
  return [...(items || [])].sort((a, b) => (Number(a.order || 0) || 0) - (Number(b.order || 0) || 0));
}

function mapChapter(chapter, index) {
  return {
    number: chapter.number || String(index + 1).padStart(2, "0"),
    title: chapter.title || chapter.label || `Chapter ${index + 1}`,
    heading: chapter.heading || "",
    label: chapter.label || "Featured Case Study",
    category: chapter.category || "",
    copy: chapter.copy || chapter.paragraph || "",
    stats: chapter.stats || [],
    images: chapter.images || [],
  };
}

function selectedWorkFromSlugs(slugs, works) {
  return (slugs || [])
    .map((slug) => works.find((work) => work.slug === slug))
    .filter(Boolean)
    .map((work) => ({
      slug: work.slug,
      title: work.title,
      category: work.category,
      year: work.year,
      image: work.coverImage,
    }));
}

export let homeContent = defaultHomeContent;
export let featuredProjects = ordered(defaultHomeContent.heroFeaturedProjects).filter((item) => item.enabled !== false);
export let chapters = defaultHomeContent.featuredCaseStudy.chapters.map(mapChapter);
export let selectedWork = [];
export let services = defaultHomeContent.whatWeDo.items.map((item) => item.label);
export let approachImages = defaultHomeContent.approach.images;
export let testimonials = ordered(defaultHomeContent.testimonials?.items || []).filter((item) => item.featured !== false);
export let testimonialLogos = ordered(defaultHomeContent.testimonials?.logos || []);

export function setHomeContent(nextHomeContent, works = []) {
  homeContent = nextHomeContent || defaultHomeContent;
  featuredProjects = ordered(homeContent.heroFeaturedProjects).filter((item) => item.enabled !== false);
  chapters = (homeContent.featuredCaseStudy?.chapters || []).map(mapChapter);
  selectedWork = selectedWorkFromSlugs(homeContent.selectedWork?.items || [], works);
  services = ordered(homeContent.whatWeDo?.items || [])
    .filter((item) => item.enabled !== false)
    .map((item) => item.label);
  approachImages = homeContent.approach?.images || [];
  testimonials = ordered(homeContent.testimonials?.items || []).filter((item) => item.featured !== false);
  testimonialLogos = ordered(homeContent.testimonials?.logos || []);
}

setHomeContent(defaultHomeContent, []);
