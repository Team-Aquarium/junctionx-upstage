import { NextResponse } from "next/server";
import { createTranslator } from "@/lib/i18n";
import { localeFromRequest } from "@/lib/i18n/request";
import { matchAnnouncement } from "@/lib/matching";
import { getProfile, listAnnouncements } from "@/lib/store";

export async function GET(req: Request) {
  const t = createTranslator(localeFromRequest(req));
  const [profile, list] = await Promise.all([getProfile(), listAnnouncements()]);
  const announcements = list.map((announcement) => ({
    ...announcement,
    match: matchAnnouncement(announcement, profile, t),
  }));
  return NextResponse.json({ announcements, hasProfile: profile !== null });
}
