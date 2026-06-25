import { defaultServicesContent } from "../content/defaultContent.js";

function orderedEnabled(items) {
  return [...(items || [])]
    .filter((item) => item.enabled !== false)
    .sort((a, b) => (Number(a.order || 0) || 0) - (Number(b.order || 0) || 0));
}

function cssUrl(value) {
  return String(value || "").replace(/\\/g, "/").replace(/'/g, "\\'");
}

function getProcessImage(item) {
  return item?.imagePath || item?.backgroundImage || item?.image || item?.src || "";
}

export function renderServicesPage({ renderHeader, renderFooter, btn, label, setMeta, discoveryCallLabel, discoveryCallUrl, content = defaultServicesContent }) {
  const hero = content.hero || defaultServicesContent.hero;
  const serviceItems = orderedEnabled(content.items || defaultServicesContent.items);
  const processTeaser = content.processTeaser || defaultServicesContent.processTeaser;
  const processItems = orderedEnabled(processTeaser.steps || defaultServicesContent.processTeaser.steps);

  setMeta(
    "Services - Mascot Logo, Athletic Identity & School Branding",
    "Premium identity design services for teams, schools, clubs, creators, and brands, including mascot marks, athletic identity systems, school branding, lettermarks, apparel applications, and brand guidelines.",
  );

  document.body.innerHTML = `
    ${renderHeader()}
    <main class="services-page">
      <section class="services-hero" data-headline-stagger>
        ${label(hero.pageLabel)}
        <h1>${hero.headline}</h1>
        <p>${hero.supportingCopy}</p>
      </section>

      <div class="services-rule-band" aria-hidden="true" data-reveal></div>

      <section class="services-list" aria-label="ATHAYA DESIGNED services">
        ${serviceItems
          .map(
            (service, index) => `
              <details class="service-row" data-service-card data-expanded="${index === 0 ? "true" : "false"}" data-reveal${index === 0 ? " open" : ""}>
                ${service.backgroundImage ? `<span class="service-row__background" style="background-image: url('${String(service.backgroundImage).replace(/'/g, "\\'")}')" aria-hidden="true"></span>` : ""}
                <summary>
                  <span class="service-row__number">${service.number}</span>
                  <span class="service-row__title">${service.title}</span>
                  <span class="service-row__copy">${service.shortDescription}</span>
                  <span class="service-row__toggle" aria-hidden="true"></span>
                </summary>
                <div class="service-row__details"${index === 0 ? ' style="height: auto;"' : ""}>
                  <p>${service.longDescription}</p>
                </div>
              </details>
            `,
          )
          .join("")}
      </section>

      <section class="services-process" data-reveal>
        <div class="services-process__intro">
          ${label(processTeaser.sectionLabel)}
          <h2>${processTeaser.headline}</h2>
        </div>
        <ol>
          ${processItems
            .map(
              (item) => {
                const image = getProcessImage(item);
                return `
                <li class="process-card${image ? " process-card--with-image" : ""}"${image ? ` style="--process-card-image: url('${cssUrl(image)}')"` : ""}>
                  ${image ? `<span class="process-card__image" aria-hidden="true"></span>` : ""}
                  <div class="process-card__meta">
                    <span>${item.number}</span>
                    <strong>${item.title}</strong>
                  </div>
                  <span class="process-card__placeholder" aria-hidden="true">${item.imageLabel}</span>
                </li>
              `;
              },
            )
            .join("")}
        </ol>
      </section>

      <section class="services-cta" data-reveal>
        <div>
          <span>ATHAYA DESIGNED</span>
          <h2>Ready To Build A Stronger Identity?</h2>
        </div>
        <div class="services-cta__actions">
          ${btn(hero.ctaLabel || discoveryCallLabel, hero.ctaUrl || discoveryCallUrl, "solid")}
          ${btn("View Selected Work", "/work", "outline")}
        </div>
      </section>
    </main>
    ${renderFooter()}
  `;
}
