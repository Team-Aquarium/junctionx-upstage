import { NextResponse } from "next/server";
import { getAnnouncement, readUploadFile } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [announcement, bytes] = await Promise.all([
    getAnnouncement(id),
    readUploadFile(id),
  ]);
  if (!announcement?.sourceFile || !bytes) {
    return NextResponse.json({ error: "원본 파일을 찾을 수 없습니다." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": announcement.sourceFile.mediaType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(announcement.sourceFile.name)}`,
    },
  });
}
