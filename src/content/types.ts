export type MenuLink = {
  label: string;
  url: string;
  order: number;
  enabled: boolean;
};

export type AssetItem = {
  id: string;
  type: "image" | "background" | "font" | "document";
  name: string;
  path: string;
  createdAt?: string;
};

export type SiteSettings = {
  studioName: string;
  studioSublabel: string;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  bookingUrl: string;
  email: string;
  instagramUrl: string;
  linkedinUrl: string;
  behanceUrl: string;
  footerCopyright: string;
  logoHorizontalPath: string;
  brandmarkPath: string;
  defaultOgImagePath: string;
  globalBackgroundImagePath?: string;
  themeModeNote?: string;
  overlayMenuLinks: MenuLink[];
  lastSavedAt?: string;
};

export type StatItem = {
  value: string;
  label: string;
};

export type CaseStudySectionMap = {
  overview: string;
  challenge: string;
  solution: string;
  system: string;
  applications: string;
  results: string;
};

export type WorkItem = {
  title: string;
  slug: string;
  category: string;
  year: string;
  summary: string;
  description: string;
  services: string[];
  tags?: string[];
  coverImage: string;
  heroImage: string;
  backgroundImage?: string;
  gallery: string[];
  featured: boolean;
  published: boolean;
  order: number;
  sections: CaseStudySectionMap;
  stats?: StatItem[];
};

export type FontItem = {
  name: string;
  slug: string;
  category: string;
  shortDescription?: string;
  description: string;
  longDescription?: string;
  priceLabel?: string;
  payhipUrl: string;
  previewText: string;
  featuredWords: string[];
  useCases: string[];
  fontFileUrl?: string;
  previewImage?: string;
  specimenImage?: string;
  backgroundImage?: string;
  published: boolean;
  order: number;
};

export type ServiceItem = {
  number: string;
  title: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  includedItems: string[];
  backgroundImage?: string;
  featured: boolean;
  enabled: boolean;
  order: number;
};

export type ServicesContent = {
  hero: {
    pageLabel: string;
    headline: string;
    supportingCopy: string;
    backgroundImage?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };
  items: ServiceItem[];
  processTeaser: {
    sectionLabel: string;
    headline: string;
    steps: Array<{
      number: string;
      title: string;
      description: string;
      imageLabel: string;
      imagePath?: string;
      backgroundImage?: string;
      order: number;
    }>;
  };
};

export type HomeContent = {
  heroFeaturedProjects: Array<{
    number: string;
    title: string;
    category: string;
    year: string;
    slug: string;
    description: string;
    image: string;
    coverPath?: string;
    sidePreviewImage?: string;
    enabled: boolean;
    order: number;
    accentColor?: string;
    heroImages?: Record<string, string>;
  }>;
  headline: {
    line1: string;
    line2: string;
    supportingParagraph: string;
    primaryCtaLabel: string;
    primaryCtaUrl: string;
    secondaryCtaLabel: string;
    secondaryCtaUrl: string;
  };
  whatWeDo: {
    items: Array<{ label: string; enabled: boolean; order: number }>;
  };
  featuredCaseStudy: {
    selectedWorkSlug: string;
    title: string;
    category: string;
    paragraph: string;
    stats: StatItem[];
    chapters: Array<Record<string, unknown>>;
  };
  selectedWork: {
    sectionTitle: string;
    viewAllLabel: string;
    viewAllUrl: string;
    items: string[];
  };
  testimonials: {
    label: string;
    headline: string;
    supportingCopy: string;
    items: Array<{
      id: string;
      quote: string;
      name: string;
      role: string;
      organization: string;
      category: string;
      logo: string;
      featured: boolean;
      order: number;
    }>;
    logos: Array<{
      id: string;
      name: string;
      logo: string;
      alt: string;
      order: number;
    }>;
  };
  approach: {
    label: string;
    headline: string;
    paragraph: string;
    ctaLabel: string;
    ctaUrl: string;
    images: string[];
  };
  footerCta: {
    headline: string;
    paragraph: string;
    ctaLabel: string;
    ctaUrl: string;
  };
};

export type AboutContent = {
  pageLabel: string;
  headline: string;
  supportingCopy: string;
  heroImage?: string;
  backgroundImage?: string;
  studioPositioningCopy: string;
  founderNoteLabel?: string;
  founderNoteHeadline?: string;
  founderNoteParagraphs?: string[];
  storyLabel?: string;
  storyHeadline?: string;
  storyParagraphs?: string[];
  beliefPrinciples: Array<{ number: string; title: string; description: string }>;
  whoWeHelp: string[];
  studioFocus: string[];
  ctaHeadline: string;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
};

export type ContactContent = {
  pageLabel: string;
  headline: string;
  supportingCopy: string;
  backgroundImage?: string;
  bookingUrl: string;
  email: string;
  responseTime: string;
  contactOptions: Array<{ label: string; url: string }>;
  typicalProjects: string[];
  formEnabled: boolean;
  formSubmissionMode: "mailto" | "formspree" | "custom";
  formEndpointUrl?: string;
  formFields: Array<{
    label: string;
    name: string;
    type: string;
    required: boolean;
    options: string[];
    enabled: boolean;
    order: number;
  }>;
};

export type SEOEntry = {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
  twitterImage?: string;
  keywords?: string;
  jsonLdType: "Organization" | "ProfessionalService" | "CreativeWork" | "Product";
  noIndex: boolean;
};

export type SEOSettings = {
  pages: Record<string, SEOEntry>;
  workDetails?: Record<string, SEOEntry>;
  fontDetails?: Record<string, SEOEntry>;
};
