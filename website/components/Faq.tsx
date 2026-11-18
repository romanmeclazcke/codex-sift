import { FAQ } from "@/lib/content";

export function Faq() {
  return (
    <section id="faq" className="border-t border-line px-5 py-28" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">FAQ</p>
        <h2 id="faq-heading" className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          Questions about Codex Sift
        </h2>
        <dl className="mt-12 space-y-8">
          {FAQ.map((item) => (
            <div key={item.q} className="border-b border-line pb-8 last:border-b-0 last:pb-0">
              <dt className="text-lg font-semibold tracking-tight text-ink">{item.q}</dt>
              <dd className="mt-3 text-[15px] leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
