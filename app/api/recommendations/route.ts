import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { recommendAnnouncements } from "@/lib/upstage";
import {
  getProfile,
  getRecommendationCache,
  listAnnouncements,
  saveRecommendationCache,
} from "@/lib/store";
import { clip } from "@/lib/workflow";
import { runWorkflowSession } from "@/lib/workflow-session";

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

  // 실행 중이면 새로고침해도 같은 세션에 붙어 이어본다. (중복 Solar 호출 방지)
  return runWorkflowSession("recommendations", async (emit) => {
    const cache = getRecommendationCache();
    if (cache?.hash === hash) {
      emit({
        type: "step",
        id: "cache",
        title: "캐시된 추천 사용 (프로필·공고 변경 없음)",
        status: "done",
        detail: new Date(cache.createdAt).toLocaleTimeString("ko-KR"),
        payload: cache.items,
      });
      emit({ type: "result", data: { recommendations: cache.items, cached: true } });
      return;
    }

    emit({
      type: "step",
      id: "prep",
      title: "프로필 × 공고 목록 준비",
      status: "done",
      detail: `공고 ${announcements.length}건`,
      payload: profileKey,
    });

    emit({
      type: "step",
      id: "solar",
      title: "Solar 적합도 평가 (solar-pro4)",
      status: "start",
    });
    try {
      let lastReasoningEmit = 0;
      const { items, reasoning } = await recommendAnnouncements(
        profileKey,
        announcements.map((a) => ({
          id: a.id,
          category: a.category,
          title: a.title,
          field: a.field,
          benefits: a.benefits,
          summary: a.summary,
        })),
        (accumulated) => {
          const now = Date.now();
          if (now - lastReasoningEmit < 200) {
            return;
          }
          lastReasoningEmit = now;
          emit({
            type: "step",
            id: "reasoning",
            title: "Solar 추론 과정",
            status: "start",
            detail: `${accumulated.length.toLocaleString()}자`,
            payload: clip(accumulated),
          });
        },
      );
      if (reasoning) {
        emit({
          type: "step",
          id: "reasoning",
          title: "Solar 추론 과정",
          status: "done",
          detail: `${reasoning.length.toLocaleString()}자`,
          payload: clip(reasoning),
        });
      }
      const knownIds = new Set(announcements.map((a) => a.id));
      const valid = items.filter((item) => knownIds.has(item.id));
      emit({
        type: "step",
        id: "solar",
        title: "Solar 적합도 평가 (solar-pro4)",
        status: "done",
        detail: `${valid.length}건 평가`,
        payload: valid,
      });
      saveRecommendationCache({ hash, createdAt: new Date().toISOString(), items: valid });
      emit({ type: "result", data: { recommendations: valid, cached: false } });
    } catch (error) {
      // 추천이 실패해도 피드는 정상 동작해야 한다.
      emit({
        type: "step",
        id: "solar",
        title: "Solar 적합도 평가 (solar-pro4)",
        status: "error",
      });
      emit({ type: "result", data: { recommendations: [] } });
    }
  });
}
