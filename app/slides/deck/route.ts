import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const n = Number(new URL(req.url).searchParams.get("s"));
  let html = (await readFile(path.join(process.cwd(), "slides", "deck.html"), "utf8"))
    .replaceAll("../public/fonts/", "/fonts/")
    .replace(/src="assets\//g, 'src="/upstage/');

  if (Number.isFinite(n) && n >= 1) {
    html = html
      .replace("<html lang=\"en\">", '<html lang="en" class="single-slide">')
      .replace(
        "/* __ACTIVE_SLIDE__ */",
        `html.single-slide section.slide:nth-of-type(${n}) { display: flex !important; }`,
      );
  }

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
