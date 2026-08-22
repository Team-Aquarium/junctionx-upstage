import { NextResponse } from "next/server";
import { listActiveSessionKeys } from "@/lib/workflow-session";

/** 진행 중인 워크플로우 세션 키 목록 — 새로고침 후 이어보기용 */
export async function GET() {
  return NextResponse.json({ active: listActiveSessionKeys() });
}
