import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Public pages are open to crawlers; signed-in screens and the blog admin are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/home",
          "/onboarding",
          "/login",
          "/welcome",
          "/log",
          "/coach",
          "/dev",
        ],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/"),
  };
}
