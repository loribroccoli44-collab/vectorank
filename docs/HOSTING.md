# Hosting

VectoRank is a **static site**. `npm run build` turns the committed data into plain files in `out/` (HTML, JavaScript,
the two JSON data files and images). There is no server, no database, no serverless function and no model call at run
time, so any static host can serve it for free.

## How it works
- Home, About and one page per capsid profile (271 of them) are generated at build time.
- Search, results and filters run in the visitor's browser: the page downloads the two data files once
  (about 0.2 MB compressed, then cached by the browser) and computes what the URL asks for.
- Everything the page shows is identical to the earlier server-rendered version (checked page by page).

## Build and test locally
```bash
npm ci
npm run build        # writes out/
npm run preview      # serves out/ at http://localhost:3000
npm run check -- --out out
```

## Deploy targets (all free)
| Host | Settings | URL form |
|---|---|---|
| **Cloudflare Pages** | build command `npm run build`, output directory `out`, Node 22 | `https://<project>.pages.dev` |
| **GitHub Pages** | workflow `.github/workflows/pages.yml` (builds with `NEXT_PUBLIC_BASE_PATH=/vectorank`); repository Settings → Pages → Source: GitHub Actions | `https://<user>.github.io/vectorank/` |
| **Vercel** | unchanged (`vercel.json`); now serves static files only | `https://vectorank.vercel.app` |

Security headers are in `public/_headers` (Cloudflare Pages) and `vercel.json` (Vercel). GitHub Pages does not allow
custom headers.

## If the address changes
The address appears only in the README's "Live demo" link and the repository's homepage field. Update both and any
external links (applications, CV). A suspended Vercel project cannot redirect visitors, so a new address must be
shared directly.
