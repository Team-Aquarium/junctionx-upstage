import { NextResponse } from "next/server";
import { matchAnnouncement } from "@/lib/matching";
import { getProfile, listAnnouncements } from "@/lib/store";

export async function GET() {
  const profile = getProfile();
  const announcements = listAnnouncements().map((announcement) => ({
    ...announcement,
    match: matchAnnouncement(announcement, profile),
  }));
  return NextResponse.json({ announcements, hasProfile: profile !== null });
}
