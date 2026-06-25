import { defaultAboutContent } from "../content/defaultContent.js";

type AboutPageHelpers = {
  renderHeader: () => string;
  renderFooter: () => string;
  btn: (label: string, href?: string, variant?: string, extra?: string) => string;
  label: (text: string) => string;
  imageAttrs: (src: string, alt: string, options?: Record<string, unknown>) => string;
  discoveryCallLabel: string;
  discoveryCallUrl: string;
  content?: typeof defaultAboutContent;
};

function listItems(items: string[]) {
  return items.map((item) => `<li>${item}</li>`).join("");
}

function withRequiredItems(items: string[] = [], additions: string[]) {
  const next = [...items];
  additions.forEach((item) => {
    if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
      next.push(item);
    }
  });
  return next;
}

export function renderAboutPage({ renderHeader, renderFooter, btn, label, imageAttrs, discoveryCallLabel, discoveryCallUrl, content = defaultAboutContent }: AboutPageHelpers) {
  const storyLabel = content.storyLabel || content.founderNoteLabel || defaultAboutContent.storyLabel;
  const storyHeadline = content.storyHeadline || content.founderNoteHeadline || defaultAboutContent.storyHeadline;
  const storyParagraphs = Array.isArray(content.storyParagraphs) && content.storyParagraphs.length
    ? content.storyParagraphs
    : Array.isArray(content.founderNoteParagraphs) && content.founderNoteParagraphs.length
      ? content.founderNoteParagraphs
      : defaultAboutContent.storyParagraphs;
  const heroImage = content.heroImage || defaultAboutContent.heroImage;
  const whoWeHelp = withRequiredItems(content.whoWeHelp || [], ["Online Creators"]);
  const studioFocus = withRequiredItems(
    (content.studioFocus || []).map((item) => (item === "Lettermarks" ? "Lettermarks & Brandmarks" : item)),
    ["Brand Strategies", "Typography"],
  );

  return `
    ${renderHeader()}
    <main class="about-page">
      <section class="about-hero" data-headline-stagger>
        <div class="about-hero__media" data-image-reveal>
          <img ${imageAttrs(heroImage, "Ahmad Athaya Nurhani portrait for ATHAYA DESIGNED", { loading: "eager", width: 2048, height: 1138 })} />
        </div>
        <div class="about-hero__overlay">
          ${label(content.pageLabel)}
          <div class="about-hero__content">
            <h1>${content.headline}</h1>
            <p>${content.supportingCopy}</p>
          </div>
        </div>
      </section>

      <section class="about-story" data-reveal>
        <div class="about-story__heading">
          <span>${storyLabel}</span>
          <h2>${storyHeadline}</h2>
        </div>
        <div class="about-story__body">
          ${storyParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
        </div>
      </section>

      <section class="about-intro" data-reveal>
        <div class="about-intro__heading">
          <span>Studio Positioning</span>
          <h2>Identity work shaped by character, systems, and real-world presence.</h2>
        </div>
        <article class="about-section-copy">
          <p>${content.studioPositioningCopy}</p>
        </article>
      </section>

      <section class="about-principles" aria-labelledby="about-beliefs">
        <div class="about-section-heading" data-reveal>
          <span>What We Believe</span>
          <h2 id="about-beliefs">Principles Built Into The Work.</h2>
        </div>
        <div class="about-principle-list">
          ${content.beliefPrinciples
            .map(
              (principle) => `
                <article class="about-principle" data-reveal>
                  <span>${principle.number}</span>
                  <h3>${principle.title}</h3>
                  <p>${principle.description}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="about-lists">
        <article data-reveal>
          <span>Who We Help</span>
          <ul>${listItems(whoWeHelp)}</ul>
        </article>
        <article data-reveal>
          <span>Studio Focus</span>
          <ul>${listItems(studioFocus)}</ul>
        </article>
      </section>

      <section class="about-cta" data-reveal>
        <div>
          <span>Next Project</span>
          <h2>${content.ctaHeadline}</h2>
        </div>
        <div class="button-row">
          ${btn(content.primaryCtaLabel, content.primaryCtaUrl)}
          ${btn(content.secondaryCtaLabel || discoveryCallLabel, content.secondaryCtaUrl || discoveryCallUrl, "outline")}
        </div>
      </section>
    </main>
    ${renderFooter()}
  `;
}
