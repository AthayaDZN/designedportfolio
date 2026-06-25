import { fonts } from "../data/fonts.js";

function renderFeaturedWords(words) {
  return words.map((word) => `<span>${word}</span>`).join("");
}

function getFontFamily(font) {
  if (!font.fontFileUrl) return "";
  return `athaya-font-${String(font.slug || font.name || "preview").replace(/[^a-z0-9_-]/gi, "-")}`;
}

function renderFontFaces(items) {
  return items
    .filter((font) => font.fontFileUrl)
    .map((font) => {
      const family = getFontFamily(font);
      const url = JSON.stringify(font.fontFileUrl);
      return `@font-face{font-family:${JSON.stringify(family)};src:url(${url});font-display:swap;}`;
    })
    .join("");
}

function fontPreviewStyle(font) {
  const family = getFontFamily(font);
  return family ? ` style="font-family: ${family}, var(--font-display)"` : "";
}

export function renderFontsPage({ arrowIcon, label, imageAttrs }) {
  return `
    <main class="fonts-page">
      ${renderFontFaces(fonts) ? `<style>${renderFontFaces(fonts)}</style>` : ""}
      <section class="fonts-hero" data-headline-stagger>
        ${label("ATHAYA DESIGNED FONTS")}
        <h1>ATHAYA DESIGNED Fonts.</h1>
        <p>A growing collection of display fonts, sports-inspired typefaces, and lettering systems created for bold identities, apparel graphics, team branding, and visual systems.</p>
      </section>

      <section class="fonts-grid" aria-label="ATHAYA DESIGNED font collection">
        ${fonts
          .map(
            (font, index) => `
              <article class="font-card work-card" data-reveal>
                <a class="font-card__main" href="/fonts/${font.slug}" data-router-link aria-label="View ${font.name} details">
                  <figure class="font-card__media">
                    <img ${imageAttrs(font.previewImage, `${font.name} display typeface preview for sports branding`, { loading: index < 2 ? "eager" : "lazy", fetchPriority: index === 0 ? "high" : undefined })} />
                  </figure>
                  <div class="font-card__topline">
                    <span>${String(index + 1).padStart(2, "0")}</span>
                    <em>${font.category}</em>
                  </div>
                  <div class="font-card__content">
                    <h2>${font.name}</h2>
                    <p>${font.shortDescription}</p>
                  </div>
                  <div class="font-card__preview" aria-label="Font preview text"${fontPreviewStyle(font)}>${font.previewText}</div>
                  <div class="font-word-row">${renderFeaturedWords(font.featuredWords)}</div>
                </a>
                <div class="font-card__actions">
                  <a class="font-detail-link" href="/fonts/${font.slug}" data-router-link>View Details ${arrowIcon()}</a>
                  <a class="editorial-button editorial-button--outline font-payhip-link" href="${font.payhipUrl}" target="_blank" rel="noopener noreferrer"><span>Get Font</span>${arrowIcon()}</a>
                </div>
              </article>
            `,
          )
          .join("")}
      </section>
    </main>
  `;
}
