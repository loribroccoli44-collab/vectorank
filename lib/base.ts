// Optional sub-path hosting (for example GitHub Pages project sites serve the app under /vectorank). Empty on
// Cloudflare Pages, Vercel and any root-level host. Next's <Link> and router add it automatically; plain
// <form action>, <img src>, <a href> and fetch() do not, so they go through withBase().
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const withBase = (path: string) => BASE_PATH + path;
