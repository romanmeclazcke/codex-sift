# Codex Sift website

Scroll-driven landing page for Codex Sift. One sticky SVG stage follows a request through the router, the policy branches and the selected model.

```bash
cd website
npm install
npm run dev        # http://localhost:3000
npm run build
```

Stack: Next.js, React, TypeScript, Tailwind CSS v4, Motion (`useScroll`), Geist fonts. Scroll progress drives the diagram imperatively (no per-frame React renders); the particle follows the real SVG path via `getPointAtLength`.

All product facts live in `lib/content.ts` and come from the repository: `README.md`, `policy.yaml` and `reports/e2e-routing.md`. Update that file when the router changes.
