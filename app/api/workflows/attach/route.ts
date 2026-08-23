import { NextResponse } from "next/server";
import { scopedWorkflowKey } from "@/lib/visitor";
import { getSession, sessionResponse } from "@/lib/workflow-session";

/** 기존 워크플로우 세션에 접속해 지금까지의 이벤트 재생 + 라이브 이어보기 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  const session = key ? getSession(scopedWorkflowKey(req, key)) : null;
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  return sessionResponse(session);
}
