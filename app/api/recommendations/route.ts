import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createTranslator } from "@/lib/i18n";
import { localeFromRequest } from "@/lib/i18n/request";
import { recommendAnnouncements } from "@/lib/upstage";
import {
  getProfile,
  getRecommendationCache,
  listAnnouncements,
  saveRecommendationCache,
} from "@/lib/store";
import { scopedWorkflowKey, visitorIdFromRequest } from "@/lib/visitor";
import { clipTail } from "@/lib/workflow";
import { runWorkflowSession } from "@/lib/workflow-session";

export const maxDuration = 240;

export async function GET(req: Request) {
  const locale = localeFromRequest(req);
  const t = createTranslator(locale);
  const visitorId = visitorIdFromRequest(req);
  const [profile, announcements] = await Promise.all([
    getProfile(visitorId),
    listAnnouncements(),
  ]);
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
    .update(JSON.stringify({ locale, p: profileKey, a: announcements.map((a) => a.id).sort() }))
    .digest("hex");

  // 실행 중이면 새로고침해도 같은 세션에 붙어 이어본다. (중복 Solar 호출 방지)
  return runWorkflowSession(scopedWorkflowKey(req, `recommendations:${locale}`), async (emit) => {
    const cache = await getRecommendationCache(visitorId);
    if (cache?.hash === hash) {
      emit({
        type: "step",
        id: "cache",
        title: t("api.cacheHit"),
        status: "done",
        detail: new Date(cache.createdAt).toLocaleTimeString("en-US"),
        payload: cache.items,
      });
      emit({ type: "result", data: { recommendations: cache.items, cached: true } });
      return;
    }

    emit({
      type: "step",
      id: "prep",
      title: t("api.prep"),
      status: "done",
      detail: `${announcements.length} notices`,
      payload: profileKey,
    });

    emit({
      type: "step",
      id: "solar",
      title: t("api.solarScore"),
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
            title: t("api.solarReasoning"),
            status: "start",
            detail: `${accumulated.length.toLocaleString()} chars`,
            payload: clipTail(accumulated),
          });
        },
        locale,
      );
      if (reasoning) {
        emit({
          type: "step",
          id: "reasoning",
          title: t("api.solarReasoning"),
          status: "done",
          detail: `${reasoning.length.toLocaleString()} chars`,
          payload: clipTail(reasoning),
        });
      }
      const knownIds = new Set(announcements.map((a) => a.id));
      const valid = items.filter((item) => knownIds.has(item.id));
      emit({
        type: "step",
        id: "solar",
        title: t("api.solarScore"),
        status: "done",
        detail: `${valid.length} scored`,
        payload: valid,
      });
      await saveRecommendationCache(visitorId, {
        hash,
        createdAt: new Date().toISOString(),
        items: valid,
      });
      emit({ type: "result", data: { recommendations: valid, cached: false } });
    } catch (error) {
      // 추천이 실패해도 피드는 정상 동작해야 한다.
      emit({
        type: "step",
        id: "solar",
        title: t("api.solarScore"),
        status: "error",
      });
      emit({ type: "result", data: { recommendations: [] } });
    }
  });
}
