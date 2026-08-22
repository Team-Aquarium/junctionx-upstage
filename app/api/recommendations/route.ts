import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { recommendAnnouncements } from "@/lib/upstage";
import {
  getProfile,
  getRecommendationCache,
  listAnnouncements,
  saveRecommendationCache,
} from "@/lib/store";

export const maxDuration = 120;

export async function GET() {
  const profile = getProfile();
  const announcements = listAnnouncements();
  if (!profile || announcements.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  // 추천 근거가 되는 프로필 요소 + 공고 집합이 같으면 캐시를 재사용한다.
  const profileKey = {
    department: profile.department,
    grade: profile.grade,
    interests: profile.interests,
    skills: profile.skills,
    activities: profile.activities,
  };
  const hash = createHash("sha256")
    .update(JSON.stringify({ p: profileKey, a: announcements.map((a) => a.id).sort() }))
    .digest("hex");

  const cache = getRecommendationCache();
  if (cache?.hash === hash) {
    return NextResponse.json({ recommendations: cache.items, cached: true });
  }

  try {
    const items = await recommendAnnouncements(
      profileKey,
      announcements.map((a) => ({
        id: a.id,
        category: a.category,
        title: a.title,
        field: a.field,
        benefits: a.benefits,
        summary: a.summary,
      })),
    );
    const knownIds = new Set(announcements.map((a) => a.id));
    const valid = items.filter((item) => knownIds.has(item.id));
    saveRecommendationCache({ hash, createdAt: new Date().toISOString(), items: valid });
    return NextResponse.json({ recommendations: valid, cached: false });
  } catch (error) {
    // 추천이 실패해도 피드는 정상 동작해야 한다.
    return NextResponse.json({
      recommendations: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
