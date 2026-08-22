import { NextResponse } from "next/server";
import { createTranslator } from "@/lib/i18n";
import { localeFromRequest } from "@/lib/i18n/request";
import { getAnnouncement, readUploadFile } from "@/lib/store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = createTranslator(localeFromRequest(req));
  const { id } = await params;
  const [announcement, bytes] = await Promise.all([
    getAnnouncement(id),
    readUploadFile(id),
  ]);
  if (!announcement?.sourceFile || !bytes) {
    return NextResponse.json({ error: t("api.fileMissing") }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": announcement.sourceFile.mediaType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(announcement.sourceFile.name)}`,
    },
  });
}
