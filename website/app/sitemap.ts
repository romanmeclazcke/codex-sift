import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/guides/en", "/guides/es", "/benchmark"].map((path) => ({
    url: new URL(path, SITE_URL).href,
  }));
}
