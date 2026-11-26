import { AUTHOR, NPM_URL, REPO_URL, SITE_URL } from "@/lib/content";

const author = {
  "@type": "Person",
  "@id": `${SITE_URL}/#author`,
  name: AUTHOR.name,
  url: AUTHOR.url,
  sameAs: [AUTHOR.x, AUTHOR.linkedin],
};

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{
    __html: JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c"),
  }} />;
}

export function ProductJsonLd() {
  return <JsonLd data={{
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "Codex Sift", url: SITE_URL, publisher: { "@id": author["@id"] }, inLanguage: ["en", "es"] },
      {
        "@type": ["SoftwareApplication", "SoftwareSourceCode"],
        "@id": `${SITE_URL}/#software`,
        name: "Codex Sift",
        applicationCategory: "DeveloperApplication",
        license: "https://opensource.org/licenses/MIT",
        url: SITE_URL,
        codeRepository: REPO_URL,
        installUrl: NPM_URL,
        description: "Open-source model router for the OpenAI Codex CLI. Selects a model and reasoning effort for each turn.",
        author: { "@id": author["@id"] },
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
      },
      author,
    ],
  }} />;
}

export function ArticleJsonLd({ path, title, description, language }: {
  path: string;
  title: string;
  description: string;
  language: string;
}) {
  const url = new URL(path, SITE_URL).href;
  return <JsonLd data={{
    "@graph": [
      { "@type": "Article", "@id": `${url}#article`, headline: title, description, inLanguage: language,
        mainEntityOfPage: url, author: { "@id": author["@id"] }, about: { "@id": `${SITE_URL}/#software` } },
      author,
    ],
  }} />;
}
