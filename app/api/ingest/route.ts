import { NextResponse } from "next/server";
import { ingestAnnouncementDocument } from "@/lib/ingest";
import { matchAnnouncement } from "@/lib/matching";
import { getProfile } from "@/lib/store";

export const maxDuration = 300;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  try {
    const announcement = await ingestAnnouncementDocument({
      filename: file.name,
      mediaType: file.type || "application/octet-stream",
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({
      announcement: { ...announcement, match: matchAnnouncement(announcement, getProfile()) },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
