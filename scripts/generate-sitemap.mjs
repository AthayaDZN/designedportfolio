import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITE_ORIGIN = "https://athayadesigned.com";
const rootDir = process.cwd();
const publicDir = resolve(rootDir, "public");
const contentDir = resolve(publicDir, "content");

function readJson(name, fallback) {
  const file = resolve(contentDir, name);
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function routeUrl(path) {
  return new URL(path, SITE_ORIGIN).toString();
}

const works = readJson("works.json", []);
const fonts = readJson("fonts.json", []);

const routes = [
  "/",
  "/work",
  "/services",
  "/fonts",
  "/about",
  "/contact",
  ...works.filter((work) => work?.published !== false && work?.slug).map((work) => `/work/${encodeURIComponent(work.slug)}`),
  ...fonts.filter((font) => font?.published !== false && font?.slug).map((font) => `/fonts/${encodeURIComponent(font.slug)}`),
];

const uniqueRoutes = [...new Set(routes)];
const now = new Date().toISOString();
const urls = uniqueRoutes
  .map((route) => {
    const priority = route === "/" ? "1.0" : route === "/work" || route === "/fonts" ? "0.8" : "0.7";
    return `  <url>
    <loc>${escapeXml(routeUrl(route))}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

writeFileSync(resolve(publicDir, "sitemap.xml"), sitemap, "utf8");
