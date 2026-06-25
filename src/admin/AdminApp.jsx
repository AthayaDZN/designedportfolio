import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { defaultContentBundle } from "../content/defaultContent.js";

const draftKey = "athaya-admin-draft";
const authKey = "athaya-admin-authenticated";
const sectionKeys = ["overview", "challenge", "solution", "system", "applications", "results"];
const sectionLabels = {
  overview: "Overview",
  challenge: "Challenge",
  solution: "Solution",
  system: "The System",
  applications: "Applications",
  results: "Results",
};
const imageTypes = ["jersey", "flag", "wall", "book", "patch", "signage", "apparel", "custom"];
const tabs = [
  ["dashboard", "Dashboard"],
  ["site", "Site Settings"],
  ["home", "Home"],
  ["works", "Works"],
  ["fonts", "Fonts"],
  ["services", "Services"],
  ["about", "About"],
  ["contact", "Contact"],
  ["seo", "SEO"],
  ["assets", "Assets / Uploads"],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortByOrder(items) {
  return [...(items || [])].sort((a, b) => (Number(a.order || 0) || 0) - (Number(b.order || 0) || 0));
}

function setPath(source, path, value) {
  const next = clone(source);
  let cursor = next;
  path.slice(0, -1).forEach((key) => {
    cursor[key] = cursor[key] ?? (typeof key === "number" ? [] : {});
    cursor = cursor[key];
  });
  cursor[path[path.length - 1]] = value;
  return next;
}

function moveItem(items, index, delta) {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next.map((item, itemIndex) => (item && typeof item === "object" ? { ...item, order: item.order ? itemIndex + 1 : item.order } : item));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateContent(content) {
  const warnings = [];
  const errors = [];

  const duplicateSlugs = (items, label) => {
    const seen = new Set();
    (items || []).forEach((item) => {
      if (!item.slug) errors.push(`${label} "${item.title || item.name || "Untitled"}" is missing a slug.`);
      if (item.slug && seen.has(item.slug)) errors.push(`${label} has a duplicate slug: "${item.slug}".`);
      seen.add(item.slug);
    });
  };

  if (!content.site?.studioName) errors.push("Site Settings is missing the studio name.");
  if (!content.site?.email) warnings.push("Site Settings is missing the public email address.");

  duplicateSlugs(content.works, "Works");
  (content.works || []).forEach((work) => {
    if (!work.title) errors.push("A work project is missing a title.");
    if (!work.category) errors.push(`Work "${work.title || "Untitled"}" is missing a category.`);
    if (!work.coverImage) warnings.push(`Work "${work.title || "Untitled"}" is missing a cover image.`);
    if (!work.heroImage) warnings.push(`Work "${work.title || "Untitled"}" is missing a hero image.`);
    if (!work.sections?.overview) warnings.push(`Work "${work.title || "Untitled"}" is missing overview copy.`);
  });

  duplicateSlugs(content.fonts, "Fonts");
  (content.fonts || []).forEach((font) => {
    if (!font.name) errors.push("A font product is missing a name.");
    if (!font.slug) errors.push(`Font "${font.name || "Untitled"}" is missing a slug.`);
    if (!font.payhipUrl) errors.push(`Font "${font.name || "Untitled"}" is missing a Payhip URL.`);
    if (font.payhipUrl === "#") warnings.push(`Font "${font.name || "Untitled"}" uses # as a Payhip placeholder.`);
    if (!font.fontFileUrl) warnings.push(`Font "${font.name || "Untitled"}" has no font file uploaded yet.`);
  });

  duplicateSlugs(content.services?.items, "Services");
  (content.services?.items || []).forEach((service) => {
    if (!service.title) errors.push("A service is missing a title.");
    if (!service.shortDescription) errors.push(`Service "${service.title || "Untitled"}" is missing a short description.`);
  });

  (content.home?.featuredCaseStudy?.chapters || []).forEach((chapter) => {
    const name = chapter.title || chapter.heading || `Chapter ${chapter.number || ""}`.trim();
    if (!chapter.paragraph && !chapter.copy) warnings.push(`${name} chapter is missing a paragraph.`);
  });

  if (!content.contact?.email) errors.push("Contact is missing the email address.");
  if (!content.contact?.bookingUrl) warnings.push("Contact is missing a booking URL.");
  if (content.contact?.formSubmissionMode !== "mailto" && !content.contact?.formEndpointUrl) {
    warnings.push("Contact form endpoint is missing for the selected submission mode.");
  }
  const names = new Set();
  (content.contact?.formFields || []).forEach((field) => {
    if (field.name && names.has(field.name)) errors.push(`Contact form has duplicate field name "${field.name}".`);
    names.add(field.name);
  });

  Object.entries(content.seo?.pages || {}).forEach(([key, entry]) => {
    if ((entry.title || "").length > 62) warnings.push(`${key} SEO title may be too long.`);
    if ((entry.description || "").length < 80) warnings.push(`${key} SEO description may be short.`);
    if ((entry.description || "").length > 160) warnings.push(`${key} SEO description may be too long.`);
  });

  return { errors, warnings };
}

function Button({ children, variant = "ghost", ...props }) {
  return (
    <button className={`admin-button admin-button--${variant}`} type="button" {...props}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", note }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {note ? <em>{note}</em> : null}
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 4, note }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <textarea rows={rows} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
      {note ? <em>{note}</em> : null}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="admin-toggle">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Panel({ title, description, children, aside }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel__intro">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SubPanel({ title, children, actions }) {
  return (
    <section className="admin-subpanel">
      <div className="admin-subpanel__head">
        <h3>{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

function ReorderTools({ onMoveUp, onMoveDown, onDuplicate, onDelete }) {
  return (
    <div className="admin-card-tools">
      {onMoveUp ? <Button onClick={onMoveUp}>Move Up</Button> : null}
      {onMoveDown ? <Button onClick={onMoveDown}>Move Down</Button> : null}
      {onDuplicate ? <Button onClick={onDuplicate}>Duplicate</Button> : null}
      {onDelete ? <Button onClick={onDelete}>Delete</Button> : null}
    </div>
  );
}

function AdvancedJson({ title, value, onApply }) {
  const [draft, setDraft] = useState(JSON.stringify(value ?? {}, null, 2));
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDraft(JSON.stringify(value ?? {}, null, 2));
  }, [value]);

  const parseDraft = () => {
    try {
      const parsed = JSON.parse(draft);
      setMessage("JSON is valid.");
      return parsed;
    } catch (error) {
      setMessage(`JSON error: ${error.message}`);
      return null;
    }
  };

  return (
    <details className="admin-advanced">
      <summary>{title || "Advanced JSON"}</summary>
      <p>Only edit this if you know the data structure.</p>
      <textarea rows={10} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <div className="admin-card-tools">
        <Button onClick={parseDraft}>Validate JSON</Button>
        <Button
          variant="solid"
          onClick={() => {
            const parsed = parseDraft();
            if (parsed) onApply(parsed);
          }}
        >
          Apply JSON
        </Button>
      </div>
      {message ? <small>{message}</small> : null}
    </details>
  );
}

function UploadControl({ label, type, value, onChange }) {
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState(value || "");
  const inputRef = useRef(null);

  useEffect(() => setPreview(value || ""), [value]);

  const upload = async (file) => {
    if (!file) return;
    if (type !== "font" && type !== "document") setPreview(URL.createObjectURL(file));
    setStatus("Uploading...");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`/api/admin/upload-asset?type=${type}`, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Upload failed.");
      onChange(result.path);
      setPreview(result.path);
      setStatus(`Uploaded to ${result.path}`);
    } catch (error) {
      setStatus(`${error.message} You can still use a manual public path.`);
    }
  };

  return (
    <div
      className="admin-upload"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        upload(event.dataTransfer.files?.[0]);
      }}
    >
      <div>
        <span>{label}</span>
        <p>{value || "Drag a file here, choose one, or paste a public path."}</p>
      </div>
      {preview && type !== "font" && type !== "document" ? <img src={preview} alt="" /> : null}
      {preview && (type === "font" || type === "document") ? <code>{preview}</code> : null}
      <div className="admin-upload__actions">
        <input ref={inputRef} type="file" onChange={(event) => upload(event.target.files?.[0])} />
        <Button onClick={() => inputRef.current?.click()}>Upload / Select File</Button>
        <Button onClick={() => onChange("")}>Clear</Button>
      </div>
      <Field label="Public path" value={value || ""} onChange={onChange} placeholder="Paste a public image path" />
      {status ? <small>{status}</small> : null}
    </div>
  );
}

function TextListEditor({ title, items, onChange, itemLabel = "Item" }) {
  const update = (index, value) => onChange(items.map((item, itemIndex) => (itemIndex === index ? value : item)));
  return (
    <SubPanel title={title} actions={<Button variant="solid" onClick={() => onChange([...(items || []), ""])}>Add {itemLabel}</Button>}>
      <div className="admin-repeat-list">
        {(items || []).map((item, index) => (
          <div className="admin-chip-row" key={`${item}-${index}`}>
            <Field label={`${itemLabel} ${index + 1}`} value={item} onChange={(value) => update(index, value)} />
            <ReorderTools
              onMoveUp={() => onChange(moveItem(items, index, -1))}
              onMoveDown={() => onChange(moveItem(items, index, 1))}
              onDelete={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            />
          </div>
        ))}
      </div>
    </SubPanel>
  );
}

function ParagraphListEditor({ title, items, onChange, itemLabel = "Paragraph" }) {
  const update = (index, value) => onChange(items.map((item, itemIndex) => (itemIndex === index ? value : item)));
  return (
    <SubPanel title={title} actions={<Button variant="solid" onClick={() => onChange([...(items || []), ""])}>Add {itemLabel}</Button>}>
      <div className="admin-repeat-list">
        {(items || []).map((item, index) => (
          <div className="admin-chip-row" key={`${itemLabel}-${index}`}>
            <TextArea label={`${itemLabel} ${index + 1}`} value={item} onChange={(value) => update(index, value)} rows={4} />
            <ReorderTools
              onMoveUp={() => onChange(moveItem(items, index, -1))}
              onMoveDown={() => onChange(moveItem(items, index, 1))}
              onDelete={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            />
          </div>
        ))}
      </div>
    </SubPanel>
  );
}

function StatsEditor({ stats = [], onChange }) {
  const update = (index, key, value) => onChange(stats.map((stat, statIndex) => (statIndex === index ? { ...stat, [key]: value } : stat)));
  return (
    <SubPanel title="Stats" actions={<Button variant="solid" onClick={() => onChange([...stats, { value: "", label: "" }])}>Add Stat</Button>}>
      <div className="admin-repeat-list">
        {stats.map((stat, index) => (
          <div className="admin-row-grid admin-row-grid--compact" key={index}>
            <Field label="Value" value={stat.value} onChange={(value) => update(index, "value", value)} />
            <Field label="Label" value={stat.label} onChange={(value) => update(index, "label", value)} />
            <ReorderTools
              onMoveUp={() => onChange(moveItem(stats, index, -1))}
              onMoveDown={() => onChange(moveItem(stats, index, 1))}
              onDelete={() => onChange(stats.filter((_, statIndex) => statIndex !== index))}
            />
          </div>
        ))}
      </div>
    </SubPanel>
  );
}

function ImageSlotsEditor({ images = [], onChange, title = "Images" }) {
  const update = (index, key, value) => onChange(images.map((image, imageIndex) => (imageIndex === index ? { ...image, [key]: value } : image)));
  return (
    <SubPanel title={title} actions={<Button variant="solid" onClick={() => onChange([...images, { type: "custom", label: "", detail: "", imagePath: "" }])}>Add Image Slot</Button>}>
      <div className="admin-image-slot-grid">
        {images.map((image, index) => (
          <article className="admin-edit-card" key={index}>
            <div className="admin-edit-card__head">
              <strong>{image.label || `Image Slot ${index + 1}`}</strong>
              <ReorderTools
                onMoveUp={() => onChange(moveItem(images, index, -1))}
                onMoveDown={() => onChange(moveItem(images, index, 1))}
                onDelete={() => onChange(images.filter((_, imageIndex) => imageIndex !== index))}
              />
            </div>
            <div className="admin-form-grid">
              <SelectField label="Placeholder type" value={image.type || "custom"} onChange={(value) => update(index, "type", value)} options={imageTypes} />
              <Field label="Label" value={image.label} onChange={(value) => update(index, "label", value)} />
              <Field label="Detail (optional)" value={image.detail} onChange={(value) => update(index, "detail", value)} />
              <UploadControl label="Real image path" type="image" value={image.imagePath || image.path || ""} onChange={(value) => update(index, "imagePath", value)} />
            </div>
          </article>
        ))}
      </div>
    </SubPanel>
  );
}

function SingleCaseStudyImageEditor({ images = [], onChange }) {
  const primaryIndex = Math.max(0, images.findIndex((image) => image.imagePath || image.path || image.image || image.src));
  const primaryImage = images[primaryIndex] || { type: "custom", label: "", detail: "", imagePath: "" };
  const replacePrimary = (nextImage) => {
    const nextImages = images.length ? [...images] : [];
    nextImages[primaryIndex] = nextImage;
    onChange(nextImages);
  };
  const update = (key, value) => replacePrimary({ ...primaryImage, [key]: value });

  return (
    <SubPanel title="Main Case Study Image">
      <article className="admin-edit-card">
        <div className="admin-edit-card__head">
          <strong>{primaryImage.label || "Featured chapter image"}</strong>
          <span>Homepage uses one image per chapter</span>
        </div>
        <div className="admin-form-grid">
          <SelectField label="Placeholder type" value={primaryImage.type || "custom"} onChange={(value) => update("type", value)} options={imageTypes} />
          <Field label="Image Label" value={primaryImage.label} onChange={(value) => update("label", value)} />
          <Field label="Detail (optional)" value={primaryImage.detail} onChange={(value) => update("detail", value)} />
          <UploadControl label="Real image path" type="image" value={primaryImage.imagePath || primaryImage.path || primaryImage.image || primaryImage.src || ""} onChange={(value) => update("imagePath", value)} />
        </div>
      </article>
    </SubPanel>
  );
}

function GalleryEditor({ images = [], onChange, title = "Gallery Images" }) {
  const update = (index, value) => onChange(images.map((image, imageIndex) => (imageIndex === index ? value : image)));
  return (
    <SubPanel title={title} actions={<Button variant="solid" onClick={() => onChange([...images, ""])}>Add Image</Button>}>
      <div className="admin-image-slot-grid">
        {images.map((image, index) => (
          <article className="admin-edit-card" key={index}>
            <div className="admin-edit-card__head">
              <strong>Image {index + 1}</strong>
              <ReorderTools
                onMoveUp={() => onChange(moveItem(images, index, -1))}
                onMoveDown={() => onChange(moveItem(images, index, 1))}
                onDelete={() => onChange(images.filter((_, imageIndex) => imageIndex !== index))}
              />
            </div>
            <UploadControl label="Image path" type="image" value={image} onChange={(value) => update(index, value)} />
          </article>
        ))}
      </div>
    </SubPanel>
  );
}

function ItemList({ title, items, selectedIndex, onSelect, onAdd, onDuplicate, onDelete, onMove }) {
  return (
    <aside className="admin-item-list">
      <div className="admin-item-list__head">
        <span>{title}</span>
        <Button variant="solid" onClick={onAdd}>Add</Button>
      </div>
      <div className="admin-item-list__body">
        {(items || []).map((item, index) => (
          <button className={index === selectedIndex ? "is-active" : ""} type="button" key={`${item.slug || item.name || item.title || item.label}-${index}`} onClick={() => onSelect(index)}>
            <strong>{item.title || item.name || item.label || `Item ${index + 1}`}</strong>
            <span>{item.slug || item.category || item.url || "Draft"}</span>
          </button>
        ))}
      </div>
      <div className="admin-item-list__tools">
        <Button onClick={() => onMove(-1)}>Move Up</Button>
        <Button onClick={() => onMove(1)}>Move Down</Button>
        <Button onClick={onDuplicate}>Duplicate</Button>
        <Button onClick={onDelete}>Delete</Button>
      </div>
    </aside>
  );
}

function ValidationPanel({ validation }) {
  const isClean = !validation.errors.length && !validation.warnings.length;
  return (
    <div className="admin-validation">
      <h3>Validation</h3>
      {isClean ? <p>Everything looks ready to update.</p> : null}
      {validation.errors.length ? <strong>Errors</strong> : null}
      {validation.errors.map((item) => <p className="is-error" key={item}>{item}</p>)}
      {validation.warnings.length ? <strong>Warnings</strong> : null}
      {validation.warnings.map((item) => <p className="is-warning" key={item}>{item}</p>)}
    </div>
  );
}

function Dashboard({ content, validation, setActiveTab, exportAll }) {
  return (
    <Panel title="Dashboard" description="A quick read on the content system and site health.">
      <div className="admin-stat-grid">
        {[
          ["Works", content.works?.length || 0],
          ["Fonts", content.fonts?.length || 0],
          ["Services", content.services?.items?.length || 0],
          ["Warnings", validation.warnings.length],
        ].map(([label, value]) => (
          <article className="admin-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="admin-quick-grid">
        {["home", "works", "fonts", "services", "seo"].map((tab) => (
          <Button key={tab} onClick={() => setActiveTab(tab)}>Edit {tab}</Button>
        ))}
        <Button variant="solid" onClick={exportAll}>Export All Content</Button>
      </div>
      <ValidationPanel validation={validation} />
    </Panel>
  );
}

function SiteEditor({ content, setContent }) {
  const site = content.site;
  const update = (key, value) => setContent(setPath(content, ["site", key], value));
  const updateLink = (index, key, value) => setContent(setPath(content, ["site", "overlayMenuLinks", index, key], value));
  const links = site.overlayMenuLinks || [];

  return (
    <Panel title="Site Settings" description="Global studio identity, CTA links, footer, logo paths, and overlay menu links.">
      <SubPanel title="Studio Identity">
        <div className="admin-form-grid">
          <Field label="Studio Name" value={site.studioName} onChange={(value) => update("studioName", value)} />
          <Field label="Studio Sublabel" value={site.studioSublabel} onChange={(value) => update("studioSublabel", value)} />
          <Field label="Email Address" value={site.email} onChange={(value) => update("email", value)} />
          <Field label="Booking URL" value={site.bookingUrl} onChange={(value) => update("bookingUrl", value)} />
          <Field label="Primary CTA Label" value={site.primaryCtaLabel} onChange={(value) => update("primaryCtaLabel", value)} />
          <Field label="Primary CTA URL" value={site.primaryCtaUrl} onChange={(value) => update("primaryCtaUrl", value)} />
          <Field label="Instagram URL" value={site.instagramUrl} onChange={(value) => update("instagramUrl", value)} />
          <Field label="LinkedIn URL" value={site.linkedinUrl} onChange={(value) => update("linkedinUrl", value)} />
          <Field label="Behance URL" value={site.behanceUrl} onChange={(value) => update("behanceUrl", value)} />
          <Field label="Footer Copyright" value={site.footerCopyright} onChange={(value) => update("footerCopyright", value)} />
        </div>
      </SubPanel>
      <SubPanel title="Brand Assets">
        <div className="admin-form-grid">
          <UploadControl label="Logo Horizontal Path" type="image" value={site.logoHorizontalPath} onChange={(value) => update("logoHorizontalPath", value)} />
          <UploadControl label="Brandmark Path" type="image" value={site.brandmarkPath} onChange={(value) => update("brandmarkPath", value)} />
          <UploadControl label="Default OG Image" type="image" value={site.defaultOgImagePath} onChange={(value) => update("defaultOgImagePath", value)} />
          <UploadControl label="Global Background Image" type="background" value={site.globalBackgroundImagePath} onChange={(value) => update("globalBackgroundImagePath", value)} />
        </div>
      </SubPanel>
      <SubPanel title="Overlay Menu Links" actions={<Button variant="solid" onClick={() => update("overlayMenuLinks", [...links, { label: "New Link", url: "/", order: links.length + 1, enabled: true }])}>Add Link</Button>}>
        {links.map((link, index) => (
          <article className="admin-edit-card" key={index}>
            <div className="admin-edit-card__head">
              <strong>{link.label || "Menu Link"}</strong>
              <ReorderTools
                onMoveUp={() => update("overlayMenuLinks", moveItem(links, index, -1))}
                onMoveDown={() => update("overlayMenuLinks", moveItem(links, index, 1))}
                onDelete={() => update("overlayMenuLinks", links.filter((_, itemIndex) => itemIndex !== index))}
              />
            </div>
            <div className="admin-form-grid">
              <Field label="Menu Label" value={link.label} onChange={(value) => updateLink(index, "label", value)} />
              <Field label="URL" value={link.url} onChange={(value) => updateLink(index, "url", value)} />
              <Field label="Order" type="number" value={link.order} onChange={(value) => updateLink(index, "order", Number(value))} />
              <Toggle label="Enabled" checked={link.enabled} onChange={(value) => updateLink(index, "enabled", value)} />
            </div>
          </article>
        ))}
      </SubPanel>
      <AdvancedJson title="Advanced JSON for Site Settings" value={site} onApply={(value) => setContent(setPath(content, ["site"], value))} />
    </Panel>
  );
}

function ChapterEditor({ chapters, onChange }) {
  const [active, setActive] = useState(0);
  const updateChapter = (index, key, value) => onChange(chapters.map((chapter, itemIndex) => (itemIndex === index ? { ...chapter, [key]: value } : chapter)));
  const chapter = chapters[active] || chapters[0];

  return (
    <SubPanel title="Featured Case Study Chapters">
      <div className="admin-chapter-layout">
        <div className="admin-chapter-list">
          {chapters.map((item, index) => (
            <button className={active === index ? "is-active" : ""} type="button" key={index} onClick={() => setActive(index)}>
              <span>{item.number || String(index + 1).padStart(2, "0")}</span>
              <strong>{item.title || "Chapter"}</strong>
            </button>
          ))}
        </div>
        {chapter ? (
          <div className="admin-chapter-editor">
            <div className="admin-form-grid">
              <Field label="Chapter Number" value={chapter.number} onChange={(value) => updateChapter(active, "number", value)} />
              <Field label="Chapter Title" value={chapter.title} onChange={(value) => updateChapter(active, "title", value)} />
              <Field label="Section Label" value={chapter.label} onChange={(value) => updateChapter(active, "label", value)} />
              <Field label="Project Heading" value={chapter.heading} onChange={(value) => updateChapter(active, "heading", value)} />
              <Field label="Category / Subheading" value={chapter.category} onChange={(value) => updateChapter(active, "category", value)} />
            </div>
            <TextArea label="Paragraph" value={chapter.paragraph || chapter.copy} onChange={(value) => updateChapter(active, "paragraph", value)} />
            <StatsEditor stats={chapter.stats || []} onChange={(value) => updateChapter(active, "stats", value)} />
            <SingleCaseStudyImageEditor images={chapter.images || []} onChange={(value) => updateChapter(active, "images", value)} />
            <article className="admin-preview-card">
              <span>{chapter.label}</span>
              <strong>{chapter.heading || chapter.title}</strong>
              <p>{chapter.paragraph || chapter.copy}</p>
              <div className="admin-preview-stat-row">{(chapter.stats || []).map((stat, index) => <em key={index}>{stat.value} {stat.label}</em>)}</div>
            </article>
          </div>
        ) : null}
      </div>
    </SubPanel>
  );
}

function HeroProjectsEditor({ projects, onChange }) {
  const update = (index, key, value) => onChange(projects.map((project, itemIndex) => (itemIndex === index ? { ...project, [key]: value } : project)));
  const updateImage = (index, value) => {
    onChange(projects.map((project, itemIndex) => (
      itemIndex === index
        ? { ...project, image: value, coverPath: value, heroImages: { ...(project.heroImages || {}), center: value } }
        : project
    )));
  };
  return (
    <SubPanel title="Hero Slides" actions={<Button variant="solid" onClick={() => onChange([...projects, { number: String(projects.length + 1).padStart(2, "0"), title: "Hero Slide", category: "", year: "", slug: "", description: "", image: "", coverPath: "", heroImages: { center: "" }, enabled: true, order: projects.length + 1 }])}>Add Slide</Button>}>
      {projects.map((project, index) => (
        <details className="admin-edit-card" key={index}>
          <summary>{project.number} {project.title || "Hero Slide"}</summary>
          <div className="admin-form-grid">
            <Field label="Slide Number" value={project.number} onChange={(value) => update(index, "number", value)} />
            <Field label="Slide Title" value={project.title} onChange={(value) => update(index, "title", value)} />
            <Field label="Category / Small Label" value={project.category} onChange={(value) => update(index, "category", value)} />
            <Field label="Year" value={project.year} onChange={(value) => update(index, "year", value)} />
            <Field label="Reference Slug (Optional)" value={project.slug} onChange={(value) => update(index, "slug", slugify(value))} />
            <Field label="Accent Color" value={project.accentColor} onChange={(value) => update(index, "accentColor", value)} />
            <Toggle label="Enabled" checked={project.enabled} onChange={(value) => update(index, "enabled", value)} />
          </div>
          <TextArea label="Description" value={project.description} onChange={(value) => update(index, "description", value)} rows={2} />
          <UploadControl label="Hero Slide Image" type="image" value={project.image || project.coverPath || project.heroImages?.center} onChange={(value) => updateImage(index, value)} />
          <ReorderTools
            onMoveUp={() => onChange(moveItem(projects, index, -1))}
            onMoveDown={() => onChange(moveItem(projects, index, 1))}
            onDuplicate={() => onChange([...projects, { ...clone(project), title: `${project.title || "Hero Slide"} Copy`, slug: project.slug ? `${project.slug}-copy-${Date.now()}` : "" }])}
            onDelete={() => onChange(projects.filter((_, itemIndex) => itemIndex !== index))}
          />
        </details>
      ))}
    </SubPanel>
  );
}

function HomeEditor({ content, setContent }) {
  const home = content.home;
  const update = (path, value) => setContent(setPath(content, ["home", ...path], value));
  const marquee = sortByOrder(home.whatWeDo.items || []);
  const testimonials = home.testimonials || { label: "", headline: "", supportingCopy: "", items: [], logos: [] };
  const testimonialItems = sortByOrder(testimonials.items || []);
  const testimonialLogos = sortByOrder(testimonials.logos || []);
  const updateTestimonials = (key, value) => update(["testimonials", key], value);
  const updateTestimonialItem = (index, key, value) => {
    updateTestimonials(
      "items",
      testimonialItems.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  };
  const updateTestimonialLogo = (index, key, value) => {
    updateTestimonials(
      "logos",
      testimonialLogos.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  };

  return (
    <Panel title="Home" description="Manage homepage content without touching the locked visual direction.">
      <SubPanel title="Headline / Positioning">
        <div className="admin-form-grid">
          <Field label="Main Headline Line 1" value={home.headline.line1} onChange={(value) => update(["headline", "line1"], value)} />
          <Field label="Main Headline Line 2" value={home.headline.line2} onChange={(value) => update(["headline", "line2"], value)} />
          <Field label="Primary CTA Label" value={home.headline.primaryCtaLabel} onChange={(value) => update(["headline", "primaryCtaLabel"], value)} />
          <Field label="Primary CTA URL" value={home.headline.primaryCtaUrl} onChange={(value) => update(["headline", "primaryCtaUrl"], value)} />
          <Field label="Secondary CTA Label" value={home.headline.secondaryCtaLabel} onChange={(value) => update(["headline", "secondaryCtaLabel"], value)} />
          <Field label="Secondary CTA URL" value={home.headline.secondaryCtaUrl} onChange={(value) => update(["headline", "secondaryCtaUrl"], value)} />
        </div>
        <TextArea label="Supporting Paragraph" value={home.headline.supportingParagraph} onChange={(value) => update(["headline", "supportingParagraph"], value)} />
      </SubPanel>
      <HeroProjectsEditor projects={home.heroFeaturedProjects || []} onChange={(value) => update(["heroFeaturedProjects"], value)} />
      <SubPanel title="What We Do Marquee" actions={<Button variant="solid" onClick={() => update(["whatWeDo", "items"], [...marquee, { label: "", enabled: true, order: marquee.length + 1 }])}>Add Capability</Button>}>
        {marquee.map((item, index) => (
          <div className="admin-row-grid admin-row-grid--compact" key={index}>
            <Field label="Capability Label" value={item.label} onChange={(value) => update(["whatWeDo", "items", index, "label"], value)} />
            <Toggle label="Enabled" checked={item.enabled} onChange={(value) => update(["whatWeDo", "items", index, "enabled"], value)} />
            <ReorderTools
              onMoveUp={() => update(["whatWeDo", "items"], moveItem(marquee, index, -1))}
              onMoveDown={() => update(["whatWeDo", "items"], moveItem(marquee, index, 1))}
              onDelete={() => update(["whatWeDo", "items"], marquee.filter((_, itemIndex) => itemIndex !== index))}
            />
          </div>
        ))}
      </SubPanel>
      <ChapterEditor chapters={home.featuredCaseStudy.chapters || []} onChange={(value) => update(["featuredCaseStudy", "chapters"], value)} />
      <SubPanel title="Selected Work">
        <div className="admin-form-grid">
          <Field label="Section Title" value={home.selectedWork.sectionTitle} onChange={(value) => update(["selectedWork", "sectionTitle"], value)} />
          <Field label="View All Label" value={home.selectedWork.viewAllLabel} onChange={(value) => update(["selectedWork", "viewAllLabel"], value)} />
          <Field label="View All URL" value={home.selectedWork.viewAllUrl} onChange={(value) => update(["selectedWork", "viewAllUrl"], value)} />
        </div>
        <TextListEditor title="Homepage Work Slugs" itemLabel="Work Slug" items={home.selectedWork.items || []} onChange={(value) => update(["selectedWork", "items"], value)} />
      </SubPanel>
      <SubPanel
        title="Testimonials"
        actions={
          <Button
            variant="solid"
            onClick={() =>
              updateTestimonials("items", [
                ...testimonialItems,
                {
                  id: `testimonial-${Date.now()}`,
                  quote: "",
                  name: "",
                  role: "",
                  organization: "",
                  category: "Identity Work",
                  logo: "",
                  featured: true,
                  order: testimonialItems.length + 1,
                },
              ])
            }
          >
            Add Testimonial
          </Button>
        }
      >
        <div className="admin-form-grid">
          <Field label="Section Label" value={testimonials.label} onChange={(value) => updateTestimonials("label", value)} />
          <Field label="Headline" value={testimonials.headline} onChange={(value) => updateTestimonials("headline", value)} />
        </div>
        <TextArea label="Supporting Copy" value={testimonials.supportingCopy} onChange={(value) => updateTestimonials("supportingCopy", value)} rows={3} />
        {testimonialItems.map((item, index) => (
          <details className="admin-edit-card" key={item.id || index}>
            <summary>{item.name || `Testimonial ${index + 1}`}</summary>
            <div className="admin-form-grid">
              <Field label="ID" value={item.id} onChange={(value) => updateTestimonialItem(index, "id", slugify(value))} />
              <Field label="Name" value={item.name} onChange={(value) => updateTestimonialItem(index, "name", value)} />
              <Field label="Role" value={item.role} onChange={(value) => updateTestimonialItem(index, "role", value)} />
              <Field label="Organization" value={item.organization} onChange={(value) => updateTestimonialItem(index, "organization", value)} />
              <Field label="Category" value={item.category} onChange={(value) => updateTestimonialItem(index, "category", value)} />
              <Field label="Order" type="number" value={item.order} onChange={(value) => updateTestimonialItem(index, "order", Number(value) || 0)} />
              <Toggle label="Featured" checked={item.featured !== false} onChange={(value) => updateTestimonialItem(index, "featured", value)} />
            </div>
            <TextArea label="Quote" value={item.quote} onChange={(value) => updateTestimonialItem(index, "quote", value)} rows={3} />
            <UploadControl label="Logo Image" type="image" value={item.logo} onChange={(value) => updateTestimonialItem(index, "logo", value)} />
            <ReorderTools
              onMoveUp={() => updateTestimonials("items", moveItem(testimonialItems, index, -1))}
              onMoveDown={() => updateTestimonials("items", moveItem(testimonialItems, index, 1))}
              onDuplicate={() => updateTestimonials("items", [...testimonialItems, { ...clone(item), id: `${item.id || "testimonial"}-copy-${Date.now()}`, name: `${item.name || "Testimonial"} Copy`, order: testimonialItems.length + 1 }])}
              onDelete={() => updateTestimonials("items", testimonialItems.filter((_, itemIndex) => itemIndex !== index))}
            />
          </details>
        ))}
        <SubPanel
          title="Client Logo Strip"
          actions={
            <Button
              onClick={() =>
                updateTestimonials("logos", [
                  ...testimonialLogos,
                  {
                    id: `logo-${Date.now()}`,
                    name: "",
                    logo: "",
                    alt: "",
                    order: testimonialLogos.length + 1,
                  },
                ])
              }
            >
              Add Logo
            </Button>
          }
        >
          {testimonialLogos.map((item, index) => (
            <details className="admin-edit-card" key={item.id || index}>
              <summary>{item.name || `Logo ${index + 1}`}</summary>
              <div className="admin-form-grid">
                <Field label="ID" value={item.id} onChange={(value) => updateTestimonialLogo(index, "id", slugify(value))} />
                <Field label="Name" value={item.name} onChange={(value) => updateTestimonialLogo(index, "name", value)} />
                <Field label="Alt Text" value={item.alt} onChange={(value) => updateTestimonialLogo(index, "alt", value)} />
                <Field label="Order" type="number" value={item.order} onChange={(value) => updateTestimonialLogo(index, "order", Number(value) || 0)} />
              </div>
              <UploadControl label="Logo Image" type="image" value={item.logo} onChange={(value) => updateTestimonialLogo(index, "logo", value)} />
              <ReorderTools
                onMoveUp={() => updateTestimonials("logos", moveItem(testimonialLogos, index, -1))}
                onMoveDown={() => updateTestimonials("logos", moveItem(testimonialLogos, index, 1))}
                onDuplicate={() => updateTestimonials("logos", [...testimonialLogos, { ...clone(item), id: `${item.id || "logo"}-copy-${Date.now()}`, name: `${item.name || "Logo"} Copy`, order: testimonialLogos.length + 1 }])}
                onDelete={() => updateTestimonials("logos", testimonialLogos.filter((_, itemIndex) => itemIndex !== index))}
              />
            </details>
          ))}
        </SubPanel>
      </SubPanel>
      <SubPanel title="Approach">
        <div className="admin-form-grid">
          <Field label="Section Label" value={home.approach.label} onChange={(value) => update(["approach", "label"], value)} />
          <Field label="CTA Label" value={home.approach.ctaLabel} onChange={(value) => update(["approach", "ctaLabel"], value)} />
          <Field label="CTA URL" value={home.approach.ctaUrl} onChange={(value) => update(["approach", "ctaUrl"], value)} />
        </div>
        <TextArea label="Headline" value={home.approach.headline} onChange={(value) => update(["approach", "headline"], value)} />
        <TextArea label="Paragraph" value={home.approach.paragraph} onChange={(value) => update(["approach", "paragraph"], value)} />
        <GalleryEditor title="Approach Image Strip" images={home.approach.images || []} onChange={(value) => update(["approach", "images"], value)} />
      </SubPanel>
      <SubPanel title="Footer CTA">
        <TextArea label="Headline" value={home.footerCta.headline} onChange={(value) => update(["footerCta", "headline"], value)} />
        <TextArea label="Paragraph" value={home.footerCta.paragraph} onChange={(value) => update(["footerCta", "paragraph"], value)} />
        <div className="admin-form-grid">
          <Field label="CTA Label" value={home.footerCta.ctaLabel} onChange={(value) => update(["footerCta", "ctaLabel"], value)} />
          <Field label="CTA URL" value={home.footerCta.ctaUrl} onChange={(value) => update(["footerCta", "ctaUrl"], value)} />
        </div>
      </SubPanel>
      <AdvancedJson title="Advanced JSON for Home Content" value={home} onApply={(value) => setContent(setPath(content, ["home"], value))} />
    </Panel>
  );
}

function WorksEditor({ content, setContent }) {
  const [selected, setSelected] = useState(0);
  const works = sortByOrder(content.works || []);
  const work = works[selected] || works[0];
  const updateWork = (key, value) => {
    const originalIndex = content.works.findIndex((item) => item.slug === work.slug);
    if (key === "__replace") setContent(setPath(content, ["works", originalIndex < 0 ? selected : originalIndex], value));
    else setContent(setPath(content, ["works", originalIndex < 0 ? selected : originalIndex, key], value));
  };
  const replaceWorks = (items) => setContent(setPath(content, ["works"], items.map((item, index) => ({ ...item, order: index + 1 }))));
  const add = () => replaceWorks([...works, { ...clone(defaultContentBundle.works[0]), title: "New Work", slug: `new-work-${Date.now()}`, published: false, order: works.length + 1 }]);
  const duplicate = () => work && replaceWorks([...works, { ...clone(work), title: `${work.title} Copy`, slug: `${work.slug}-copy-${Date.now()}`, published: false }]);
  const remove = () => work && replaceWorks(works.filter((_, index) => index !== selected));
  const move = (delta) => {
    const nextIndex = selected + delta;
    if (nextIndex < 0 || nextIndex >= works.length) return;
    setSelected(nextIndex);
    replaceWorks(moveItem(works, selected, delta));
  };

  if (!work) return <Panel title="Works" description="No work items yet."><Button onClick={add}>Add Work</Button></Panel>;

  return (
    <div className="admin-editor-split">
      <ItemList title="Works" items={works} selectedIndex={selected} onSelect={setSelected} onAdd={add} onDuplicate={duplicate} onDelete={remove} onMove={move} />
      <Panel title="Works" description="Project archive and case study content.">
        <SubPanel title="Project Basics">
          <div className="admin-form-grid">
            <Field label="Title" value={work.title} onChange={(value) => updateWork("title", value)} />
            <Field label="Slug" value={work.slug} onChange={(value) => updateWork("slug", slugify(value))} />
            <Field label="Category" value={work.category} onChange={(value) => updateWork("category", value)} />
            <Field label="Year" value={work.year} onChange={(value) => updateWork("year", value)} />
            <Field label="Order" type="number" value={work.order} onChange={(value) => updateWork("order", Number(value))} />
            <Toggle label="Published" checked={work.published} onChange={(value) => updateWork("published", value)} />
            <Toggle label="Featured" checked={work.featured} onChange={(value) => updateWork("featured", value)} />
          </div>
          <TextArea label="Summary" value={work.summary} onChange={(value) => updateWork("summary", value)} />
          <TextArea label="Description" value={work.description} onChange={(value) => updateWork("description", value)} />
        </SubPanel>
        <SubPanel title="Images">
          <div className="admin-form-grid">
            <UploadControl label="Cover Image" type="image" value={work.coverImage} onChange={(value) => updateWork("coverImage", value)} />
            <UploadControl label="Hero Image" type="image" value={work.heroImage} onChange={(value) => updateWork("heroImage", value)} />
            <UploadControl label="Background Image" type="background" value={work.backgroundImage} onChange={(value) => updateWork("backgroundImage", value)} />
          </div>
          <GalleryEditor images={work.gallery || []} onChange={(value) => updateWork("gallery", value)} />
        </SubPanel>
        <TextListEditor title="Services" itemLabel="Service" items={work.services || []} onChange={(value) => updateWork("services", value)} />
        <TextListEditor title="Tags / Categories" itemLabel="Tag" items={work.tags || []} onChange={(value) => updateWork("tags", value)} />
        <SubPanel title="Case Study Sections">
          {sectionKeys.map((key) => (
            <details className="admin-edit-card" key={key}>
              <summary>{sectionLabels[key]}</summary>
              <TextArea label={`${sectionLabels[key]} Body Copy`} value={work.sections?.[key] || ""} onChange={(value) => updateWork("sections", { ...(work.sections || {}), [key]: value })} />
            </details>
          ))}
        </SubPanel>
        <StatsEditor stats={work.stats || []} onChange={(value) => updateWork("stats", value)} />
        <SubPanel title="Preview">
          <div className="admin-preview-grid">
            <article className="admin-preview-card">
              <img src={work.coverImage} alt="" />
              <span>{work.category} / {work.year}</span>
              <strong>{work.title}</strong>
              <p>{work.summary}</p>
            </article>
            <article className="admin-preview-card">
              <img src={work.heroImage} alt="" />
              <span>Detail Hero</span>
              <strong>{work.title}</strong>
              <p>{work.description}</p>
            </article>
          </div>
        </SubPanel>
        <AdvancedJson title="Advanced JSON for This Work" value={work} onApply={(value) => updateWork("__replace", value)} />
      </Panel>
    </div>
  );
}

function FontsEditor({ content, setContent }) {
  const [selected, setSelected] = useState(0);
  const fonts = sortByOrder(content.fonts || []);
  const font = fonts[selected] || fonts[0];
  const styleId = font?.fontFileUrl ? `admin-font-${font.slug}` : "";
  const updateFont = (key, value) => {
    const originalIndex = content.fonts.findIndex((item) => item.slug === font.slug);
    if (key === "__replace") setContent(setPath(content, ["fonts", originalIndex < 0 ? selected : originalIndex], value));
    else setContent(setPath(content, ["fonts", originalIndex < 0 ? selected : originalIndex, key], value));
  };
  const replaceFonts = (items) => setContent(setPath(content, ["fonts"], items.map((item, index) => ({ ...item, order: index + 1 }))));
  const add = () => replaceFonts([...fonts, { ...clone(defaultContentBundle.fonts[0]), name: "New Font", slug: `new-font-${Date.now()}`, published: false }]);
  const duplicate = () => font && replaceFonts([...fonts, { ...clone(font), name: `${font.name} Copy`, slug: `${font.slug}-copy-${Date.now()}`, published: false }]);
  const remove = () => font && replaceFonts(fonts.filter((_, index) => index !== selected));
  const move = (delta) => {
    const nextIndex = selected + delta;
    if (nextIndex < 0 || nextIndex >= fonts.length) return;
    setSelected(nextIndex);
    replaceFonts(moveItem(fonts, selected, delta));
  };

  if (!font) return <Panel title="Fonts" description="No fonts yet."><Button onClick={add}>Add Font</Button></Panel>;

  return (
    <div className="admin-editor-split">
      {font.fontFileUrl ? <style>{`@font-face{font-family:${styleId};src:url("${font.fontFileUrl}")}`}</style> : null}
      <ItemList title="Fonts" items={fonts} selectedIndex={selected} onSelect={setSelected} onAdd={add} onDuplicate={duplicate} onDelete={remove} onMove={move} />
      <Panel title="Fonts" description="Product-style editor for font listings, previews, files, and Payhip URLs.">
        <SubPanel title="Product Basics">
          <div className="admin-form-grid">
            <Field label="Font Name" value={font.name} onChange={(value) => updateFont("name", value)} />
            <Field label="Slug" value={font.slug} onChange={(value) => updateFont("slug", slugify(value))} />
            <Field label="Category" value={font.category} onChange={(value) => updateFont("category", value)} />
            <Field label="Price Label" value={font.priceLabel} onChange={(value) => updateFont("priceLabel", value)} />
            <Field label="Payhip URL" value={font.payhipUrl} onChange={(value) => updateFont("payhipUrl", value)} />
            <Field label="Preview Text" value={font.previewText} onChange={(value) => updateFont("previewText", value)} />
            <Field label="Order" type="number" value={font.order} onChange={(value) => updateFont("order", Number(value))} />
            <Toggle label="Published" checked={font.published} onChange={(value) => updateFont("published", value)} />
          </div>
          <TextArea label="Short Description" value={font.shortDescription} onChange={(value) => updateFont("shortDescription", value)} />
          <TextArea label="Long Description" value={font.longDescription || font.description} onChange={(value) => updateFont("longDescription", value)} />
        </SubPanel>
        <SubPanel title="Files and Images">
          <div className="admin-form-grid">
            <UploadControl label="Font File URL" type="font" value={font.fontFileUrl} onChange={(value) => updateFont("fontFileUrl", value)} />
            <UploadControl label="Preview Image" type="image" value={font.previewImage} onChange={(value) => updateFont("previewImage", value)} />
            <UploadControl label="Specimen Image" type="image" value={font.specimenImage} onChange={(value) => updateFont("specimenImage", value)} />
            <UploadControl label="Background Image" type="background" value={font.backgroundImage} onChange={(value) => updateFont("backgroundImage", value)} />
          </div>
        </SubPanel>
        <TextListEditor title="Featured Words" itemLabel="Word" items={font.featuredWords || []} onChange={(value) => updateFont("featuredWords", value)} />
        <TextListEditor title="Use Cases" itemLabel="Use Case" items={font.useCases || []} onChange={(value) => updateFont("useCases", value)} />
        <SubPanel title="Font Preview">
          {!font.fontFileUrl ? <p className="admin-warning-note">No font file uploaded yet. Preview uses fallback display font.</p> : null}
          <div className="admin-font-preview" style={font.fontFileUrl ? { fontFamily: styleId } : undefined}>{font.previewText}</div>
          <article className="admin-preview-card">
            <span>GET FONT URL</span>
            <strong>{font.name}</strong>
            <p>{font.payhipUrl}</p>
            <a className="admin-button admin-button--solid" href={font.payhipUrl || "#"} target="_blank" rel="noreferrer">Get Font</a>
          </article>
        </SubPanel>
        <AdvancedJson title="Advanced JSON for This Font" value={font} onApply={(value) => updateFont("__replace", value)} />
      </Panel>
    </div>
  );
}

function ServicesEditor({ content, setContent }) {
  const [selected, setSelected] = useState(0);
  const services = sortByOrder(content.services.items || []);
  const service = services[selected] || services[0];
  const updateHero = (key, value) => setContent(setPath(content, ["services", "hero", key], value));
  const updateService = (key, value) => {
    const originalIndex = content.services.items.findIndex((item) => item.slug === service.slug);
    if (key === "__replace") setContent(setPath(content, ["services", "items", originalIndex < 0 ? selected : originalIndex], value));
    else setContent(setPath(content, ["services", "items", originalIndex < 0 ? selected : originalIndex, key], value));
  };
  const replaceServices = (items) => setContent(setPath(content, ["services", "items"], items.map((item, index) => ({ ...item, order: index + 1 }))));
  const add = () => replaceServices([...services, { ...clone(defaultContentBundle.services.items[0]), title: "New Service", slug: `new-service-${Date.now()}`, enabled: true }]);
  const duplicate = () => service && replaceServices([...services, { ...clone(service), title: `${service.title} Copy`, slug: `${service.slug}-copy-${Date.now()}` }]);
  const remove = () => service && replaceServices(services.filter((_, index) => index !== selected));
  const move = (delta) => {
    const nextIndex = selected + delta;
    if (nextIndex < 0 || nextIndex >= services.length) return;
    setSelected(nextIndex);
    replaceServices(moveItem(services, selected, delta));
  };

  return (
    <div className="admin-editor-split">
      <ItemList title="Services" items={services} selectedIndex={selected} onSelect={setSelected} onAdd={add} onDuplicate={duplicate} onDelete={remove} onMove={move} />
      <Panel title="Services" description="Services page hero, service cards, and process teaser steps.">
        <SubPanel title="Page Hero">
          <div className="admin-form-grid">
            <Field label="Page Label" value={content.services.hero.pageLabel} onChange={(value) => updateHero("pageLabel", value)} />
            <Field label="CTA Label" value={content.services.hero.ctaLabel} onChange={(value) => updateHero("ctaLabel", value)} />
            <Field label="CTA URL" value={content.services.hero.ctaUrl} onChange={(value) => updateHero("ctaUrl", value)} />
          </div>
          <TextArea label="Headline" value={content.services.hero.headline} onChange={(value) => updateHero("headline", value)} />
          <TextArea label="Supporting Copy" value={content.services.hero.supportingCopy} onChange={(value) => updateHero("supportingCopy", value)} />
          <UploadControl label="Background Image" type="background" value={content.services.hero.backgroundImage} onChange={(value) => updateHero("backgroundImage", value)} />
        </SubPanel>
        {service ? (
          <SubPanel title="Service Card">
            <div className="admin-form-grid">
              <Field label="Number" value={service.number} onChange={(value) => updateService("number", value)} />
              <Field label="Title" value={service.title} onChange={(value) => updateService("title", value)} />
              <Field label="Slug" value={service.slug} onChange={(value) => updateService("slug", slugify(value))} />
              <Field label="Order" type="number" value={service.order} onChange={(value) => updateService("order", Number(value))} />
              <Toggle label="Enabled" checked={service.enabled} onChange={(value) => updateService("enabled", value)} />
              <Toggle label="Featured" checked={service.featured} onChange={(value) => updateService("featured", value)} />
            </div>
            <TextArea label="Short Description" value={service.shortDescription} onChange={(value) => updateService("shortDescription", value)} />
            <TextArea label="Long Description" value={service.longDescription} onChange={(value) => updateService("longDescription", value)} />
            <TextListEditor title="Included Items" itemLabel="Included Item" items={service.includedItems || []} onChange={(value) => updateService("includedItems", value)} />
            <UploadControl label="Background Image" type="background" value={service.backgroundImage} onChange={(value) => updateService("backgroundImage", value)} />
            <AdvancedJson title="Advanced JSON for This Service" value={service} onApply={(value) => updateService("__replace", value)} />
          </SubPanel>
        ) : null}
        <ProcessEditor content={content} setContent={setContent} />
      </Panel>
    </div>
  );
}

function ProcessEditor({ content, setContent }) {
  const process = content.services.processTeaser;
  const steps = sortByOrder(process.steps || []);
  const updateProcess = (key, value) => setContent(setPath(content, ["services", "processTeaser", key], value));
  const updateStep = (index, key, value) => setContent(setPath(content, ["services", "processTeaser", "steps", index, key], value));
  return (
    <SubPanel title="Process Teaser">
      <div className="admin-form-grid">
        <Field label="Section Label" value={process.sectionLabel} onChange={(value) => updateProcess("sectionLabel", value)} />
        <Field label="Headline" value={process.headline} onChange={(value) => updateProcess("headline", value)} />
      </div>
      {steps.map((step, index) => (
        <article className="admin-edit-card" key={index}>
          <div className="admin-edit-card__head">
            <strong>{step.number} {step.title}</strong>
            <ReorderTools
              onMoveUp={() => updateProcess("steps", moveItem(steps, index, -1))}
              onMoveDown={() => updateProcess("steps", moveItem(steps, index, 1))}
              onDelete={() => updateProcess("steps", steps.filter((_, itemIndex) => itemIndex !== index))}
            />
          </div>
          <div className="admin-form-grid">
            <Field label="Step Number" value={step.number} onChange={(value) => updateStep(index, "number", value)} />
            <Field label="Step Title" value={step.title} onChange={(value) => updateStep(index, "title", value)} />
            <Field label="Image Label" value={step.imageLabel} onChange={(value) => updateStep(index, "imageLabel", value)} />
          </div>
          <UploadControl label="Box Background Image" type="image" value={step.imagePath || step.backgroundImage || ""} onChange={(value) => updateStep(index, "imagePath", value)} />
          <TextArea label="Step Description" value={step.description} onChange={(value) => updateStep(index, "description", value)} rows={2} />
        </article>
      ))}
    </SubPanel>
  );
}

function AboutEditor({ content, setContent }) {
  const about = content.about;
  const update = (key, value) => setContent(setPath(content, ["about", key], value));
  return (
    <Panel title="About" description="Studio story, principles, audience lists, focus areas, and CTA content.">
      <SubPanel title="Page Hero">
        <Field label="Page Label" value={about.pageLabel} onChange={(value) => update("pageLabel", value)} />
        <TextArea label="Headline" value={about.headline} onChange={(value) => update("headline", value)} />
        <TextArea label="Supporting Copy" value={about.supportingCopy} onChange={(value) => update("supportingCopy", value)} />
        <UploadControl label="Hero Image" type="background" value={about.heroImage} onChange={(value) => update("heroImage", value)} />
      </SubPanel>
      <SubPanel title="Studio Positioning">
        <TextArea label="Positioning Copy" value={about.studioPositioningCopy} onChange={(value) => update("studioPositioningCopy", value)} />
      </SubPanel>
      <SubPanel title="Personal Story">
        <Field label="Story Label" value={about.storyLabel} onChange={(value) => update("storyLabel", value)} />
        <TextArea label="Story Headline" value={about.storyHeadline} onChange={(value) => update("storyHeadline", value)} rows={3} />
      </SubPanel>
      <ParagraphListEditor title="Story Paragraphs" itemLabel="Paragraph" items={about.storyParagraphs || []} onChange={(value) => update("storyParagraphs", value)} />
      <PrinciplesEditor principles={about.beliefPrinciples || []} onChange={(value) => update("beliefPrinciples", value)} />
      <TextListEditor title="Who We Help" itemLabel="Audience" items={about.whoWeHelp || []} onChange={(value) => update("whoWeHelp", value)} />
      <TextListEditor title="Studio Focus" itemLabel="Focus Area" items={about.studioFocus || []} onChange={(value) => update("studioFocus", value)} />
      <SubPanel title="CTA">
        <TextArea label="CTA Headline" value={about.ctaHeadline} onChange={(value) => update("ctaHeadline", value)} />
        <div className="admin-form-grid">
          <Field label="Primary CTA Label" value={about.primaryCtaLabel} onChange={(value) => update("primaryCtaLabel", value)} />
          <Field label="Primary CTA URL" value={about.primaryCtaUrl} onChange={(value) => update("primaryCtaUrl", value)} />
          <Field label="Secondary CTA Label" value={about.secondaryCtaLabel} onChange={(value) => update("secondaryCtaLabel", value)} />
          <Field label="Secondary CTA URL" value={about.secondaryCtaUrl} onChange={(value) => update("secondaryCtaUrl", value)} />
        </div>
      </SubPanel>
      <AdvancedJson title="Advanced JSON for About" value={about} onApply={(value) => setContent(setPath(content, ["about"], value))} />
    </Panel>
  );
}

function PrinciplesEditor({ principles, onChange }) {
  const update = (index, key, value) => onChange(principles.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  return (
    <SubPanel title="Belief Principles" actions={<Button variant="solid" onClick={() => onChange([...principles, { number: "", title: "", description: "" }])}>Add Principle</Button>}>
      {principles.map((principle, index) => (
        <article className="admin-edit-card" key={index}>
          <div className="admin-edit-card__head">
            <strong>{principle.number} {principle.title}</strong>
            <ReorderTools
              onMoveUp={() => onChange(moveItem(principles, index, -1))}
              onMoveDown={() => onChange(moveItem(principles, index, 1))}
              onDelete={() => onChange(principles.filter((_, itemIndex) => itemIndex !== index))}
            />
          </div>
          <div className="admin-form-grid">
            <Field label="Number" value={principle.number} onChange={(value) => update(index, "number", value)} />
            <Field label="Title" value={principle.title} onChange={(value) => update(index, "title", value)} />
          </div>
          <TextArea label="Description" value={principle.description} onChange={(value) => update(index, "description", value)} />
        </article>
      ))}
    </SubPanel>
  );
}

function ContactEditor({ content, setContent }) {
  const contact = content.contact;
  const update = (key, value) => setContent(setPath(content, ["contact", key], value));
  return (
    <Panel title="Contact" description="Inquiry page copy, contact details, project lists, and form fields.">
      <SubPanel title="Page Hero">
        <Field label="Page Label" value={contact.pageLabel} onChange={(value) => update("pageLabel", value)} />
        <TextArea label="Headline" value={contact.headline} onChange={(value) => update("headline", value)} />
        <TextArea label="Supporting Copy" value={contact.supportingCopy} onChange={(value) => update("supportingCopy", value)} />
        <UploadControl label="Background Image" type="background" value={contact.backgroundImage} onChange={(value) => update("backgroundImage", value)} />
      </SubPanel>
      <SubPanel title="Contact Details">
        <div className="admin-form-grid">
          <Field label="Email Address" value={contact.email} onChange={(value) => update("email", value)} />
          <Field label="Booking URL" value={contact.bookingUrl} onChange={(value) => update("bookingUrl", value)} />
          <Field label="Response Time" value={contact.responseTime} onChange={(value) => update("responseTime", value)} />
        </div>
      </SubPanel>
      <ContactOptionsEditor options={contact.contactOptions || []} onChange={(value) => update("contactOptions", value)} />
      <TextListEditor title="Typical Projects" itemLabel="Project Type" items={contact.typicalProjects || []} onChange={(value) => update("typicalProjects", value)} />
      <SubPanel title="Form Settings">
        <div className="admin-form-grid">
          <Toggle label="Form Enabled" checked={contact.formEnabled} onChange={(value) => update("formEnabled", value)} />
          <SelectField label="Submission Mode" value={contact.formSubmissionMode} onChange={(value) => update("formSubmissionMode", value)} options={["mailto", "formspree", "custom"]} />
          <Field label="Endpoint URL" value={contact.formEndpointUrl} onChange={(value) => update("formEndpointUrl", value)} />
        </div>
      </SubPanel>
      <FormFieldsEditor fields={contact.formFields || []} onChange={(value) => update("formFields", value)} />
      <AdvancedJson title="Advanced JSON for Contact" value={contact} onApply={(value) => setContent(setPath(content, ["contact"], value))} />
    </Panel>
  );
}

function ContactOptionsEditor({ options, onChange }) {
  const update = (index, key, value) => onChange(options.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  return (
    <SubPanel title="Contact Options" actions={<Button variant="solid" onClick={() => onChange([...options, { label: "", description: "", ctaLabel: "", url: "" }])}>Add Option</Button>}>
      {options.map((option, index) => (
        <article className="admin-edit-card" key={index}>
          <div className="admin-edit-card__head">
            <strong>{option.label || "Contact Option"}</strong>
            <ReorderTools
              onMoveUp={() => onChange(moveItem(options, index, -1))}
              onMoveDown={() => onChange(moveItem(options, index, 1))}
              onDelete={() => onChange(options.filter((_, itemIndex) => itemIndex !== index))}
            />
          </div>
          <div className="admin-form-grid">
            <Field label="Title" value={option.label || option.title} onChange={(value) => update(index, "label", value)} />
            <Field label="CTA Label" value={option.ctaLabel} onChange={(value) => update(index, "ctaLabel", value)} />
            <Field label="CTA URL" value={option.url || option.ctaUrl} onChange={(value) => update(index, "url", value)} />
          </div>
          <TextArea label="Description" value={option.description} onChange={(value) => update(index, "description", value)} />
        </article>
      ))}
    </SubPanel>
  );
}

function FormFieldsEditor({ fields, onChange }) {
  const update = (index, key, value) => onChange(fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, [key]: value } : field)));
  return (
    <SubPanel title="Form Fields" actions={<Button variant="solid" onClick={() => onChange([...fields, { label: "", name: "", type: "text", required: false, options: [], enabled: true, order: fields.length + 1 }])}>Add Field</Button>}>
      {fields.map((field, index) => (
        <details className="admin-edit-card" key={index}>
          <summary>{field.label || `Field ${index + 1}`}</summary>
          <div className="admin-form-grid">
            <Field label="Label" value={field.label} onChange={(value) => update(index, "label", value)} />
            <Field label="Name" value={field.name} onChange={(value) => update(index, "name", slugify(value))} />
            <SelectField label="Type" value={field.type} onChange={(value) => update(index, "type", value)} options={["text", "email", "textarea", "select", "tel", "url"]} />
            <Field label="Order" type="number" value={field.order} onChange={(value) => update(index, "order", Number(value))} />
            <Toggle label="Required" checked={field.required} onChange={(value) => update(index, "required", value)} />
            <Toggle label="Enabled" checked={field.enabled} onChange={(value) => update(index, "enabled", value)} />
          </div>
          {field.type === "select" ? <TextListEditor title="Select Options" itemLabel="Option" items={field.options || []} onChange={(value) => update(index, "options", value)} /> : null}
          <ReorderTools
            onMoveUp={() => onChange(moveItem(fields, index, -1))}
            onMoveDown={() => onChange(moveItem(fields, index, 1))}
            onDelete={() => onChange(fields.filter((_, fieldIndex) => fieldIndex !== index))}
          />
        </details>
      ))}
    </SubPanel>
  );
}

function SEOEditor({ content, setContent }) {
  const pages = content.seo.pages || {};
  const pageKeys = Object.keys(pages);
  const [selectedPage, setSelectedPage] = useState(pageKeys[0] || "home");
  const entry = pages[selectedPage] || {};
  const updatePage = (field, value) => setContent(setPath(content, ["seo", "pages", selectedPage, field], value));
  const titleLength = (entry.title || "").length;
  const descriptionLength = (entry.description || "").length;

  return (
    <Panel title="SEO" description="Page metadata, social previews, indexing, and structured data type.">
      <div className="admin-editor-split admin-editor-split--seo">
        <ItemList title="Pages" items={pageKeys.map((key) => ({ title: key, slug: pages[key]?.title }))} selectedIndex={pageKeys.indexOf(selectedPage)} onSelect={(index) => setSelectedPage(pageKeys[index])} onAdd={() => {}} onDuplicate={() => {}} onDelete={() => {}} onMove={() => {}} />
        <div>
          <SubPanel title={`${selectedPage} SEO`}>
            <div className="admin-form-grid">
              <Field label={`SEO Title (${titleLength}/62)`} value={entry.title} onChange={(value) => updatePage("title", value)} />
              <Field label="Canonical URL" value={entry.canonicalUrl} onChange={(value) => updatePage("canonicalUrl", value)} />
              <Field label="Keywords" value={entry.keywords} onChange={(value) => updatePage("keywords", value)} />
              <SelectField label="JSON-LD Type" value={entry.jsonLdType} onChange={(value) => updatePage("jsonLdType", value)} options={["Organization", "ProfessionalService", "CreativeWork", "Product"]} />
              <Toggle label="Allow Indexing" checked={!entry.noIndex} onChange={(value) => updatePage("noIndex", !value)} />
            </div>
            <TextArea label={`Meta Description (${descriptionLength}/160)`} value={entry.description} onChange={(value) => updatePage("description", value)} rows={3} />
            <div className="admin-form-grid">
              <UploadControl label="OG Image" type="image" value={entry.ogImage} onChange={(value) => updatePage("ogImage", value)} />
              <UploadControl label="Twitter Image" type="image" value={entry.twitterImage} onChange={(value) => updatePage("twitterImage", value)} />
            </div>
            {titleLength > 62 ? <p className="admin-warning-note">Title may be too long for search results.</p> : null}
            {descriptionLength < 80 || descriptionLength > 160 ? <p className="admin-warning-note">Description works best between 80 and 160 characters.</p> : null}
            <article className="admin-seo-preview">
              <span>Search Preview</span>
              <strong>{entry.title}</strong>
              <em>{entry.canonicalUrl || "/"}</em>
              <p>{entry.description}</p>
            </article>
          </SubPanel>
          <AdvancedJson title="Advanced JSON for SEO" value={content.seo} onApply={(value) => setContent(setPath(content, ["seo"], value))} />
        </div>
      </div>
    </Panel>
  );
}

function AssetsEditor({ content, setContent }) {
  const [category, setCategory] = useState("image");
  const assets = content.assets?.assets || [];
  const addAsset = (asset) => {
    const next = [...assets, { id: `${Date.now()}`, createdAt: new Date().toISOString(), ...asset }];
    setContent(setPath(content, ["assets", "assets"], next));
  };
  const types = [
    ["image", "Images"],
    ["background", "Backgrounds"],
    ["font", "Fonts"],
    ["document", "Documents"],
  ];

  return (
    <Panel title="Assets / Uploads" description="Upload reusable files and copy their public paths for content fields.">
      <div className="admin-segmented">
        {types.map(([key, label]) => (
          <button className={category === key ? "is-active" : ""} type="button" key={key} onClick={() => setCategory(key)}>{label}</button>
        ))}
      </div>
      <UploadControl label={`Upload ${types.find(([key]) => key === category)?.[1] || "Asset"}`} type={category} value="" onChange={(path) => path && addAsset({ type: category, name: path.split("/").pop(), path })} />
      <div className="admin-asset-grid">
        {assets.filter((asset) => asset.type === category).map((asset) => (
          <article className="admin-asset-card" key={asset.id}>
            {asset.type === "image" || asset.type === "background" ? <img src={asset.path} alt="" /> : <code>{asset.type}</code>}
            <strong>{asset.name}</strong>
            <p>{asset.path}</p>
            <div className="admin-card-tools">
              <Button onClick={() => navigator.clipboard?.writeText(asset.path)}>Copy Path</Button>
              <Button onClick={() => setContent(setPath(content, ["assets", "assets"], assets.filter((item) => item.id !== asset.id)))}>Remove From List</Button>
            </div>
          </article>
        ))}
      </div>
      <AdvancedJson title="Advanced JSON for Assets" value={content.assets} onApply={(value) => setContent(setPath(content, ["assets"], value))} />
    </Panel>
  );
}

function AdminApp({ initialContent, reloadContent }) {
  const expectedPasscode = String(import.meta.env.VITE_ADMIN_PASSCODE || "").trim();
  const adminConfigured = expectedPasscode.length > 0;
  const [authenticated, setAuthenticated] = useState(() => adminConfigured && sessionStorage.getItem(authKey) === "true");
  const [passcode, setPasscode] = useState("");
  const [content, setContent] = useState(() => {
    const draft = localStorage.getItem(draftKey);
    return draft ? JSON.parse(draft) : clone(initialContent || defaultContentBundle);
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const importRef = useRef(null);
  const validation = useMemo(() => validateContent(content), [content]);

  useEffect(() => {
    if (import.meta.env.DEV && !adminConfigured) {
      console.warn("VITE_ADMIN_PASSCODE is missing. Local admin login is disabled until it is set in .env.local.");
    }
  }, [adminConfigured]);

  useEffect(() => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        ...content,
        site: {
          ...(content.site || {}),
          draftUpdatedAt: new Date().toISOString(),
        },
      }),
    );
    setDirty(true);
  }, [content]);

  useEffect(() => {
    const warn = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const exportContent = (payload, name) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const save = async () => {
    if (validation.errors.length) {
      setMessage("Please resolve validation errors before updating the site. Warnings are okay.");
      return;
    }
    const savedAt = new Date().toISOString();
    const next = setPath(content, ["site", "lastSavedAt"], savedAt);
    try {
      const response = await fetch("/api/admin/save-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: next }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Save failed.");
      setContent(next);
      localStorage.setItem(draftKey, JSON.stringify(next));
      setDirty(false);
      setMessage(`Saved ${result.saved.join(", ")} at ${new Date(result.savedAt).toLocaleString()}.`);
      await reloadContent?.();
    } catch (error) {
      setMessage(`${error.message} Export JSON is still available.`);
    }
  };

  const importJson = async (file) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const next = parsed.site && parsed.home ? parsed : { ...content, [activeTab]: parsed };
      if (!window.confirm("Import JSON into the current draft?")) return;
      setContent(next);
      setMessage("JSON imported into draft. Review it, then Update Site.");
    } catch (error) {
      setMessage(`Import failed: ${error.message}`);
    }
  };

  if (!authenticated) {
    return (
      <main className="admin-login">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!adminConfigured) {
              sessionStorage.removeItem(authKey);
              setMessage("Admin access is not configured.");
              return;
            }
            if (passcode === expectedPasscode) {
              sessionStorage.setItem(authKey, "true");
              setAuthenticated(true);
            } else {
              setMessage("That passcode did not match.");
            }
          }}
        >
          <span>Local content editor</span>
          <h1>ATHAYA DESIGNED</h1>
          <label>
            <span>Passcode</span>
            <input type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} autoFocus />
          </label>
          <button type="submit" disabled={!adminConfigured}>Enter Admin</button>
          {message ? <p>{message}</p> : <p>{adminConfigured ? "Enter your admin passcode." : "Admin access is not configured."}</p>}
        </form>
      </main>
    );
  }

  const activeRenderer = {
    dashboard: <Dashboard content={content} validation={validation} setActiveTab={setActiveTab} exportAll={() => exportContent(content, "athaya-content-bundle.json")} />,
    site: <SiteEditor content={content} setContent={setContent} />,
    home: <HomeEditor content={content} setContent={setContent} />,
    works: <WorksEditor content={content} setContent={setContent} />,
    fonts: <FontsEditor content={content} setContent={setContent} />,
    services: <ServicesEditor content={content} setContent={setContent} />,
    about: <AboutEditor content={content} setContent={setContent} />,
    contact: <ContactEditor content={content} setContent={setContent} />,
    seo: <SEOEditor content={content} setContent={setContent} />,
    assets: <AssetsEditor content={content} setContent={setContent} />,
  }[activeTab];

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <span>ATHAYA DESIGNED</span>
          <strong>Admin CMS</strong>
        </div>
        <nav>
          {tabs.map(([key, label]) => (
            <button className={activeTab === key ? "is-active" : ""} key={key} type="button" onClick={() => setActiveTab(key)}>
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span className={dirty ? "admin-status is-dirty" : "admin-status"}>{dirty ? "Unsaved changes" : "Saved draft"}</span>
            <small>Last saved: {content.site?.lastSavedAt ? new Date(content.site.lastSavedAt).toLocaleString() : "Not saved yet"}</small>
          </div>
          <div className="admin-topbar__actions">
            <Button onClick={() => window.open("/", "_blank")}>Preview</Button>
            <Button onClick={() => exportContent(content[activeTab] || content, `athaya-${activeTab}.json`)}>Export JSON</Button>
            <Button onClick={() => exportContent(content, "athaya-content-bundle.json")}>Export All</Button>
            <Button onClick={() => importRef.current?.click()}>Import JSON</Button>
            <Button onClick={() => setContent(clone(initialContent || defaultContentBundle))}>Reset Draft</Button>
            <Button onClick={() => { localStorage.removeItem(draftKey); setContent(clone(defaultContentBundle)); }}>Clear Draft</Button>
            <Button variant="solid" onClick={save}>Update Site</Button>
            <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => importJson(event.target.files?.[0])} />
          </div>
        </header>
        {message ? <div className="admin-message">{message}</div> : null}
        {activeTab !== "dashboard" ? <ValidationPanel validation={validation} /> : null}
        {activeRenderer}
      </section>
    </main>
  );
}

export function mountAdmin(element, props) {
  createRoot(element).render(<AdminApp {...props} />);
}
