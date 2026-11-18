import { AUTHOR, FAQ, REPO_URL, SITE_URL } from "@/lib/content";

export function JsonLd() {
  const person = {
    "@type": "Person",
    name: AUTHOR.name,
    url: AUTHOR.url,
    sameAs: [AUTHOR.url, AUTHOR.x, AUTHOR.linkedin],
  };

  const software = {
    "@type": "SoftwareApplication",
    name: "Codex Sift",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Linux, Windows",
    license: "https://opensource.org/licenses/MIT",
    url: SITE_URL,
    codeRepository: REPO_URL,
    description:
      "Model router for the OpenAI Codex CLI. Routes each user turn to flash, craft or forge using TypeSafe Jev signals and a YAML policy.",
    author: person,
    creator: person,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const website = {
    "@type": "WebSite",
    name: "Codex Sift",
    url: SITE_URL,
    description: software.description,
    publisher: person,
    inLanguage: "en",
  };

  const faq = {
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [website, software, person, faq],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
  );
}
