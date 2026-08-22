import { NextResponse } from "next/server";
import { createTranslator } from "@/lib/i18n";
import { localeFromRequest } from "@/lib/i18n/request";
import { extractProfileFromText } from "@/lib/upstage";
import { getProfile, mergeProfile, saveProfile } from "@/lib/store";
import { clip, clipTail } from "@/lib/workflow";
import { runWorkflowSession } from "@/lib/workflow-session";

export const maxDuration = 120;

export async function POST(req: Request) {
  const t = createTranslator(localeFromRequest(req));
  const { text } = (await req.json()) as { text?: string };
  const note = text?.trim() ?? "";
  if (note.length < 8) {
    return NextResponse.json({ error: t("profile.noteFailed") }, { status: 400 });
  }

  return runWorkflowSession("profile-note", async (emit) => {
    emit({
      type: "step",
      id: "recv",
      title: t("api.noteRecv"),
      status: "done",
      detail: `${note.length} chars`,
    });

    emit({
      type: "step",
      id: "solar",
      title: t("api.solarNote"),
      status: "start",
    });
    let lastReasoningEmit = 0;
    const { extracted, reasoning } = await extractProfileFromText(note, (accumulated) => {
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
    });
    emit({
      type: "step",
      id: "solar",
      title: t("api.solarNote"),
      status: "done",
      payload: extracted,
    });
    if (reasoning) {
      emit({
        type: "step",
        id: "reasoning",
        title: t("api.solarReasoning"),
        status: "done",
      });
    }

    const profile = mergeProfile(await getProfile(), extracted, {
      type: "note",
      label: clip(note, 48),
      addedAt: new Date().toISOString(),
    });
    await saveProfile(profile);
    emit({
      type: "step",
      id: "merge",
      title: t("api.mergeSave"),
      status: "done",
      payload: profile,
    });
    emit({ type: "result", data: { profile, extracted } });
  });
}
