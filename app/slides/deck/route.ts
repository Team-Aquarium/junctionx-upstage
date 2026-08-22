import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const filePath = path.join(process.cwd(), "slides", "deck.html");
  const html = (await readFile(filePath, "utf8"))
    .replaceAll("../public/fonts/", "/fonts/")
    .replace(/src="assets\//g, "src=\"/upstage/");

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
