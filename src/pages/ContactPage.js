import { defaultContactContent } from "../content/defaultContent.js";

function options(items) {
  return (items || []).map((item) => `<option value="${item}">${item}</option>`).join("");
}

function renderField(field) {
  const required = field.required ? " required" : "";
  if (field.type === "textarea") {
    return `
      <label class="form-message">
        <span>${field.label}</span>
        <textarea name="${field.name}" rows="7" placeholder="Tell me about the identity, audience, deliverables, and what you need this project to achieve."${required}></textarea>
      </label>
    `;
  }

  if (field.type === "select") {
    return `
      <label>
        <span>${field.label}</span>
        <select name="${field.name}"${required}>
          <option value="">Select an option</option>
          ${options(field.options)}
        </select>
      </label>
    `;
  }

  return `
    <label>
      <span>${field.label}</span>
      <input name="${field.name}" type="${field.type || "text"}"${field.name === "email" ? ' autocomplete="email"' : ""}${required} />
    </label>
  `;
}

export function renderContactPage({ renderHeader, renderFooter, btn, label, discoveryCallLabel, discoveryCallUrl, content = defaultContactContent }) {
  const fields = [...(content.formFields || [])]
    .filter((field) => field.enabled !== false)
    .sort((a, b) => (Number(a.order || 0) || 0) - (Number(b.order || 0) || 0));
  const gridFields = fields.filter((field) => field.type !== "textarea");
  const messageFields = fields.filter((field) => field.type === "textarea");

  return `
    ${renderHeader()}
    <main class="contact-page">
      <section class="contact-hero" data-headline-stagger>
        ${label(content.pageLabel)}
        <div class="contact-hero__grid">
          <h1>${content.headline}</h1>
          <div class="contact-hero__copy">
            <p>${content.supportingCopy}</p>
            <div class="contact-actions">
              ${btn(discoveryCallLabel, discoveryCallUrl || content.bookingUrl, "solid")}
              ${btn("Email Studio", `mailto:${content.email}`, "outline")}
            </div>
          </div>
        </div>
      </section>

      <section class="contact-panel" data-reveal>
        <aside class="contact-sidebar">
          <span>Project Inquiry</span>
          <h2>Mascot logo design, athletic branding, and visual systems for serious identity projects.</h2>
          <p>Typical projects include identity marks, mascot and character identities, school branding, lettermarks, apparel applications, and brand guidelines.</p>
          <div class="contact-focus-list">
            ${(content.typicalProjects || []).map((item) => `<em>${item}</em>`).join("")}
          </div>
          <div class="contact-response">
            <strong>Response Time</strong>
            <span>${content.responseTime}</span>
          </div>
        </aside>

        ${content.formEnabled === false ? "" : `
          <form class="contact-form" data-contact-form data-form-mode="${content.formSubmissionMode}" data-form-endpoint="${content.formEndpointUrl || ""}" data-contact-email="${content.email}">
            <div class="form-grid">
              ${gridFields.map(renderField).join("")}
            </div>
            ${messageFields.map(renderField).join("")}
            <div class="contact-form__footer">
              <button class="editorial-button editorial-button--solid" type="submit"><span>Send Inquiry</span><svg class="inline-arrow" viewBox="0 0 40 24" aria-hidden="true" focusable="false"><path d="M7 12H30M23 5L30 12L23 19" /></svg></button>
            </div>
          </form>
        `}
      </section>
    </main>
    ${renderFooter()}
  `;
}
