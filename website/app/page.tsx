import { ProductJsonLd } from "@/components/JsonLd";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { HowItWorks } from "@/components/HowItWorks";
import { Journey } from "@/components/Journey";
import { Nav } from "@/components/Nav";
import { QuickStart } from "@/components/QuickStart";
import { Results } from "@/components/Results";

export default function Home() {
  return (
    <>
      <ProductJsonLd />
      <Nav />
      <main>
        <Journey />
        <Results />
        <HowItWorks />
        <QuickStart />
        <Faq />
        <FinalCta />
        <footer className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-3 px-5 py-8 text-sm">
          <Link className="underline" href="/guides/en">Reduce Codex CLI token usage</Link>
          <Link className="underline" href="/guides/es" hrefLang="es" lang="es">Cómo reducir el consumo de Codex CLI</Link>
          <Link className="underline" href="/benchmark">Routing benchmark</Link>
          <Link className="underline" href="/compare">Manual model switching vs Codex Sift</Link>
        </footer>
      </main>
    </>
  );
}
