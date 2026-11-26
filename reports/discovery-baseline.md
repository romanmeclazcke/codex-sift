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
