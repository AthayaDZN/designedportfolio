import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const rootDir = process.cwd();
const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:5180";
const outFile = resolve(rootDir, "qa-screenshots", "localhost-asset-check-report.json");
const contentDir = resolve(rootDir, "public", "content");

function walkStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(walkStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(walkStrings);
  return [];
}

function collectRefsFromText(text) {
  const refs = new Set();
  const quoted = /["'`]((?:\/(?:assets|uploads|projects|fonts|content)\/)[^"'`]*?\.(?:png|jpe?g|webp|gif|svg|mp4|avif|otf|ttf|woff2?))["'`]/gi;
  const cssUrl = /url\(\s*["']?((?:\/(?:assets|uploads|projects|fonts|content)\/)[^"')]*?\.(?:png|jpe?g|webp|gif|svg|mp4|avif))["']?\s*\)/gi;
  for (const regex of [quoted, cssUrl]) {
    for (const match of text.matchAll(regex)) refs.add(match[1]);
  }
  return [...refs];
}

function expectedType(path) {
  const ext = extname(path).toLowerCase();
  if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".otf") return "font/otf";
  if (ext === ".ttf") return "font/ttf";
  if (ext === ".woff") return "font/woff";
  if (ext === ".woff2") return "font/woff2";
  return "";
}

const contentFiles = readdirSync(contentDir).filter((file) => file.endsWith(".json"));
const content = Object.fromEntries(
  contentFiles.map((file) => [file, JSON.parse(readFileSync(resolve(contentDir, file), "utf8"))]),
);

const sourceFiles = [
  ...contentFiles.map((file) => resolve(contentDir, file)),
  resolve(rootDir, "src", "content", "defaultContent.js"),
  resolve(rootDir, "src", "main.jsx"),
  resolve(rootDir, "src", "styles.css"),
  resolve(rootDir, "index.html"),
];

const refs = [...new Set(sourceFiles.flatMap((file) => collectRefsFromText(readFileSync(file, "utf8"))))].sort();
const routes = ["/", "/work", "/work/thenationsbest", "/work/dfdc-logofolio", "/work/quick-showcase", "/fonts", "/fonts/azn-knuckles", "/about", "/services", "/contact", "/admin"];

const routeResults = [];
for (const route of routes) {
  try {
    const response = await fetch(`${baseUrl}${route}`);
    routeResults.push({
      route,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type") || "",
    });
  } catch (error) {
    routeResults.push({ route, status: 0, ok: false, error: error.message });
  }
}

const assetResults = [];
for (const ref of refs) {
  const expected = expectedType(ref);
  try {
    const response = await fetch(`${baseUrl}${encodeURI(ref)}`);
    const contentType = response.headers.get("content-type") || "";
    const ok = response.ok && (!expected || contentType.toLowerCase().includes(expected.toLowerCase()));
    assetResults.push({ ref, status: response.status, contentType, expected, ok });
  } catch (error) {
    assetResults.push({ ref, status: 0, expected, ok: false, error: error.message });
  }
}

function existsInRefs(path) {
  return refs.includes(path);
}

const seoImages = [];
for (const [page, entry] of Object.entries(content["seo.json"]?.pages || {})) {
  for (const key of ["ogImage", "twitterImage"]) {
    if (entry?.[key]) seoImages.push({ page, key, path: entry[key], existsInRefs: existsInRefs(entry[key]) });
  }
}

const jsonLdImages = [
  ...(content["works.json"] || []).flatMap((work) => [work.coverImage, work.heroImage].filter(Boolean).map((path) => ({ type: "work", slug: work.slug, path, existsInRefs: existsInRefs(path) }))),
  ...(content["fonts.json"] || []).flatMap((font) => [font.previewImage, font.specimenImage, font.backgroundImage].filter(Boolean).map((path) => ({ type: "font", slug: font.slug, path, existsInRefs: existsInRefs(path) }))),
];

const brokenAssets = assetResults.filter((item) => !item.ok);
const failedRoutes = routeResults.filter((item) => !item.ok);
const report = {
  baseUrl,
  routeCount: routeResults.length,
  failedRouteCount: failedRoutes.length,
  assetReferenceCount: refs.length,
  failedAssetCount: brokenAssets.length,
  routeResults,
  brokenAssets,
  seoImages,
  jsonLdImages,
  generatedAt: new Date().toISOString(),
};

writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
