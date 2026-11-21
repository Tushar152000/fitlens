/**
 * The website's public origin (https://www.fitr8.com): canonical URLs, sitemap, Open Graph and
 * structured data. Inlined at build; locally next.config.ts fills it from PUBLIC_URL.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.fitr8.com").replace(
  /\/+$/,
  "",
);

export const siteUrl = (path = "/") => `${SITE_URL}${path}`;
