import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, SITE_URL).href;
  const languages = { en: url("/guides/en"), es: url("/guides/es"), "x-default": url("/guides/en") };
  return [
    ...["/", "/benchmark", "/compare"].map((path) => ({ url: url(path) })),
    ...["/guides/en", "/guides/es"].map((path) => ({ url: url(path), alternates: { languages } })),
  ];
}
