# Codex Sift discovery baseline

The npm registry API was sampled on November 26, 2026. Run `node tools/discovery.mjs` to repeat the snapshot. The Discovery metrics GitHub workflow also records a weekly snapshot and supports manual runs.

| Measurement | Baseline |
| --- | --- |
| npm downloads, Nov 19–25 | 66 |
| npm downloads, Oct 27–Nov 25 | 345 |
| Registry position for codex-sift | 1 |
| Registry position for codex model routing | Outside top 50 |
| Registry position for codex cli model router | Outside top 50 |
| Registry position for codex cost optimization | Outside top 50 |
| Registry position for codex token usage | Outside top 50 |
| Registry position for codex cli | Outside top 50 |

Registry results can differ from the npm website. Downloads include repeat and automated requests. Compare consistent 30-day windows and annotate releases and distribution dates.

For web discovery, use Search Console with the production site property and submit `https://codex-sift.vercel.app/sitemap.xml`. Track indexing, impressions, clicks, and average position for `/guides/es`, `/guides/en`, and `/benchmark`. Compare Spanish and English queries independently. Search Console data requires verified property access.

The site uses Vercel Web Analytics. Enable Analytics in the project to collect pageviews. The guide and benchmark emit `npm_package_clicked` and `install_command_copied` on Vercel plans that support custom events. A command copy or outbound click is a measure of install intent.

## Search intents to monitor

| Intent | Page | Query examples |
| --- | --- | --- |
| Reduce Codex CLI usage in Spanish | `/guides/es` | cómo reducir consumo de tokens Codex CLI, cómo ahorrar créditos en Codex |
| Reduce Codex CLI usage in English | `/guides/en` | reduce Codex CLI token usage, Codex CLI credits optimization |
| Choose a model per task | `/compare` | Codex CLI model router, automatic model switching Codex CLI |
| Find measured results | `/benchmark` | Codex model routing benchmark, Codex model routing token usage |

For each property, export a 28-day Search Analytics window grouped by landing page and query. Review indexing and canonical selection with URL Inspection. Flag pages with growing impressions and persistently low CTR for title or snippet review. If the Google generative AI report is available for the property, monitor it separately. When checking other AI search services, record engine, date, exact prompt, whether Codex Sift appeared, and cited URLs. A few prompts are a visibility sample.

The [Illyism SEO workflow](https://il.ly/blog/seo-skills) informed the technical crawl audit, links between related articles and the use of first-hand evidence on the comparison page. The site's HTML carries the primary content. [Google Search Central](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) documents its approach to generative search and the role of conventional SEO.
