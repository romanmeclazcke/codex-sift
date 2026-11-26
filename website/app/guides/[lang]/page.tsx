import type { Metadata } from "next";
import Link from "next/link";
import { ArticleJsonLd } from "@/components/JsonLd";
import { InstallActions } from "@/components/InstallActions";
import { guides } from "@/lib/guides";

type GuideProps = { params: Promise<{ lang: keyof typeof guides }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "es" }];
}

export async function generateMetadata({ params }: GuideProps): Promise<Metadata> {
  const { lang } = await params;
  const { title, description } = guides[lang];
  const url = `/guides/${lang}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { en: "/guides/en", es: "/guides/es", "x-default": "/guides/en" },
    },
    openGraph: { title, description, url, type: "article", locale: lang === "es" ? "es_AR" : "en_US" },
    twitter: { card: "summary", title, description },
  };
}

export default async function Guide({ params }: GuideProps) {
  const { lang } = await params;
  const guide = guides[lang];
  const spanish = lang === "es";
  return (
    <main lang={lang} className="mx-auto max-w-3xl px-5 py-12">
      <nav className="flex justify-between">
        <Link href="/">Codex Sift</Link>
        <Link href={spanish ? "/guides/en" : "/guides/es"} hrefLang={spanish ? "en" : "es"}>
          {spanish ? "English" : "Español"}
        </Link>
      </nav>
      <ArticleJsonLd path={`/guides/${lang}`} title={guide.title} description={guide.description} language={lang} />
      <article>
        <h1 className="mb-6 mt-12 text-4xl font-semibold tracking-tight">{guide.title}</h1>
        <p>{guide.intro}</p>
        {guide.sections.map(([title, body]) => (
          <section key={title} className="mt-8">
            <h2 className="mb-2 text-2xl font-semibold">{title}</h2>
            <p>{body}</p>
          </section>
        ))}
        <InstallActions page={`guide-${lang}`} spanish={spanish} />
        <div className="flex flex-col gap-3">
          <Link className="underline" href="/benchmark">{guide.benchmark}</Link>
          <Link className="underline" href="/compare" hrefLang="en">{spanish ? "Comparar selección manual y Codex Sift (en inglés)" : "Compare manual model switching with Codex Sift"}</Link>
          <a className="underline" href={spanish ? "https://chatgpt.com/es-ES/codex/pricing/" : "https://chatgpt.com/codex/pricing/"}>{spanish ? "Precios y uso de Codex (OpenAI)" : "Codex pricing and usage (OpenAI)"}</a>
        </div>
      </article>
    </main>
  );
}
