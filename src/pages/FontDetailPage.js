import { getFontBySlug, getRelatedFonts } from "../data/fonts.js";

const specimen = {
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "& ? ! / . , - + #",
};

function renderWordList(words) {
  return words.map((word) => `<span>${word}</span>`).join("");
}

function getFontFamily(font) {
  if (!font.fontFileUrl) return "";
  return `athaya-font-${String(font.slug || font.name || "preview").replace(/[^a-z0-9_-]/gi, "-")}`;
}

function renderFontFaces(items) {
  return items
    .filter((font) => font?.fontFileUrl)
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

export function renderFontDetailPage(slug, { arrowIcon, label }) {
  const font = getFontBySlug(slug);
  if (!font) return null;

  const related = getRelatedFonts(slug);
  const fontFaces = renderFontFaces([font, ...related]);

  return `
    <main class="fonts-page font-detail-page">
      ${fontFaces ? `<style>${fontFaces}</style>` : ""}
      <section class="font-detail-hero" data-headline-stagger>
        <a class="back-link" href="/fonts" data-router-link>${arrowIcon("inline-arrow inline-arrow--back")} Back to Fonts</a>
        ${label(font.category)}
        <h1>${font.name}</h1>
        <p>${font.description}</p>
        <div class="font-detail-cta-row">
          <a class="editorial-button editorial-button--solid font-payhip-link" href="${font.payhipUrl}" target="_blank" rel="noopener noreferrer"><span>Get Font</span>${arrowIcon()}</a>
        </div>
      </section>

      <section class="font-specimen-panel" data-reveal>
        <span>Specimen Preview</span>
        <strong${fontPreviewStyle(font)}>${font.previewText}</strong>
      </section>

      <section class="font-specimen-grid" aria-label="${font.name} specimen">
        <article data-reveal>
          <span>Alphabet</span>
          <p${fontPreviewStyle(font)}>${specimen.alphabet}</p>
        </article>
        <article data-reveal>
          <span>Numbers</span>
          <p${fontPreviewStyle(font)}>${specimen.numbers}</p>
        </article>
        <article data-reveal>
          <span>Symbols</span>
          <p${fontPreviewStyle(font)}>${specimen.symbols}</p>
        </article>
      </section>

      <section class="font-detail-blocks">
        <article data-reveal>
          <span>Featured Words</span>
          <div class="font-word-list">${renderWordList(font.featuredWords)}</div>
        </article>
        <article data-reveal>
          <span>Use Cases</span>
          <div class="font-use-list">${renderWordList(font.useCases)}</div>
        </article>
      </section>

      <section class="related-fonts" data-reveal>
        <div class="section-heading">
          <h2>Related Fonts</h2>
          <a href="/fonts" data-router-link>View All Fonts ${arrowIcon()}</a>
        </div>
        <div class="related-font-grid">
          ${related
            .map(
              (item) => `
                <a class="related-font-card work-card" href="/fonts/${item.slug}" data-router-link>
                  <span>${item.category}</span>
                  <strong${fontPreviewStyle(item)} data-fit-font>${item.name}</strong>
                  <em${fontPreviewStyle(item)}>${item.previewText}</em>
                </a>
              `,
            )
            .join("")}
        </div>
      </section>
    </main>
  `;
}
