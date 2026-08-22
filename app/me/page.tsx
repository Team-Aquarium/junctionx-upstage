"use client";

import {
  CheckCircle2Icon,
  CircleDashedIcon,
  FileUpIcon,
  LinkIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { UpstageBadge } from "@/components/upstage";
import { useWorkflowStream, WorkflowLog } from "@/components/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { UserProfile } from "@/lib/store";

const PROFILE_DOC_ACCEPT = ".pdf,.png,.jpg,.jpeg,.bmp,.tif,.tiff,.heic";

const REQUIRED_FIELDS = [
  { key: "name", label: "이름" },
  { key: "university", label: "학교" },
  { key: "department", label: "학과" },
  { key: "grade", label: "학년" },
  { key: "enrollment_status", label: "학적 상태" },
  { key: "birth_year", label: "출생연도" },
] as const;

function fieldValue(profile: UserProfile, key: (typeof REQUIRED_FIELDS)[number]["key"]) {
  const value = profile[key];
  if (value == null) {
    return null;
  }
  if (key === "grade") {
    return `${value}학년`;
  }
  return String(value);
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-xs">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          className="rounded-full border border-border bg-secondary px-2 py-0.5 text-secondary-foreground text-xs"
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const wf = useWorkflowStream();

  const load = async () => {
    const res = await fetch("/api/profile");
    const data = await res.json();
    setProfile(data.profile);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submitLink = async () => {
    if (!linkUrl.trim()) {
      return;
    }
    setBusy("link");
    setMessage(null);
    const data = await wf.run<{ profile: UserProfile }>("/api/profile/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: linkUrl.trim() }),
    });
    if (data?.profile) {
      setProfile(data.profile);
      setLinkUrl("");
      setMessage("링크에서 프로필을 업데이트했어요.");
    } else {
      setMessage(wf.errorRef.current ?? "링크 처리에 실패했어요.");
    }
    setBusy(null);
  };

  const submitFile = async (file: File) => {
    setBusy("file");
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    const data = await wf.run<{ profile: UserProfile }>("/api/profile", {
      method: "POST",
      body: form,
    });
    if (data?.profile) {
      setProfile(data.profile);
      setMessage(`${file.name}에서 프로필을 업데이트했어요.`);
    } else {
      setMessage(wf.errorRef.current ?? "서류 처리에 실패했어요.");
    }
    setBusy(null);
  };

  const reset = async () => {
    setBusy("reset");
    await fetch("/api/profile", { method: "DELETE" });
    setProfile(null);
    setMessage("프로필을 초기화했어요.");
    setBusy(null);
  };

  const completeness = useMemo(() => {
    if (!profile) {
      return 0;
    }
    const fieldScore = REQUIRED_FIELDS.filter((f) => profile[f.key] != null).length;
    const chipScore = (profile.interests.length > 0 ? 1 : 0) + (profile.skills.length > 0 ? 1 : 0);
    return Math.round(((fieldScore + chipScore) / (REQUIRED_FIELDS.length + 2)) * 100);
  }, [profile]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <p className="font-semibold text-[11px] text-primary uppercase tracking-[0.2em]">
        My Profile
      </p>
      <h1 className="mt-1.5 font-bold text-3xl tracking-tight">내 프로필</h1>
      <p className="mt-1.5 max-w-2xl text-muted-foreground text-sm">
        링크는 관심사·역량을 채워 <span className="font-medium text-foreground">맞춤 추천</span>에,
        서류는 학년·학적을 채워{" "}
        <span className="font-medium text-foreground">자격 판정</span>에 쓰입니다.
      </p>

      <div className="mt-6 rounded-xl border bg-card p-5">
        {loading ? (
          <div className="flex min-h-20 items-center justify-center">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xl">
              {(profile?.name ?? "나").slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-lg leading-tight">
                {profile?.name ?? "아직 프로필이 없어요"}
              </p>
              <p className="truncate text-muted-foreground text-sm">
                {profile
                  ? [profile.university, profile.department].filter(Boolean).join(" · ") ||
                    "학교 정보 없음"
                  : "아래에서 링크나 서류를 추가해 보세요"}
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                <Progress className="h-2 max-w-64" value={completeness} />
                <span className="shrink-0 font-medium text-muted-foreground text-xs">
                  완성도 {completeness}%
                </span>
              </div>
            </div>
            {profile && (
              <Button
                disabled={busy !== null}
                onClick={reset}
                size="sm"
                variant="ghost"
              >
                <RotateCcwIcon className="size-3.5" />초기화
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="flex flex-wrap items-center gap-2 font-semibold text-sm">
              <LinkIcon className="size-4 text-primary" />개인 링크로 추가
              <UpstageBadge compact feature="solar" />
            </h2>
            <p className="mt-1 text-muted-foreground text-xs">
              GitHub · 블로그 · 링크트리 · 공개 포트폴리오 (로그인 필요 페이지 불가)
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                disabled={busy !== null}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitLink()}
                placeholder="https://github.com/username"
                value={linkUrl}
              />
              <Button disabled={busy !== null || !linkUrl.trim()} onClick={submitLink}>
                {busy === "link" ? <Spinner className="size-4" /> : "분석"}
              </Button>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="flex flex-wrap items-center gap-2 font-semibold text-sm">
              <FileUpIcon className="size-4 text-primary" />서류로 추가
              <UpstageBadge compact feature="information-extract" />
            </h2>
            <p className="mt-1 text-muted-foreground text-xs">
              재학증명서·성적증명서 (PDF/이미지) — 학년·학적 상태가 채워져 자격 판정이
              정확해져요
            </p>
            <input
              accept={PROFILE_DOC_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  submitFile(file);
                }
                e.target.value = "";
              }}
              ref={fileRef}
              type="file"
            />
            <Button
              className="mt-3 w-full"
              disabled={busy !== null}
              onClick={() => fileRef.current?.click()}
              variant="outline"
            >
              {busy === "file" ? <Spinner className="size-4" /> : "서류 선택"}
            </Button>
          </section>

          {message && (
            <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">{message}</p>
          )}

          {wf.steps.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <p className="mb-2 font-semibold text-sm">실행 과정</p>
              <WorkflowLog steps={wf.steps} />
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold text-sm">자격 판정용 정보</h2>
            <p className="mt-1 text-muted-foreground text-xs">
              공고의 학년·학적·나이 요건과 대조하는 필드입니다.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {REQUIRED_FIELDS.map((field) => {
                const value = profile ? fieldValue(profile, field.key) : null;
                return (
                  <div
                    className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5"
                    key={field.key}
                  >
                    {value ? (
                      <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
                    ) : (
                      <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground/60" />
                    )}
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">{field.label}</p>
                      <p className="truncate font-medium text-sm">
                        {value ?? <span className="text-muted-foreground/70">미확인</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold text-sm">추천용 정보</h2>
            <p className="mt-1 text-muted-foreground text-xs">
              Solar가 공고와의 적합도를 평가할 때 쓰는 관심사·역량입니다.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1.5 text-muted-foreground text-xs">관심 분야</p>
                <Chips
                  empty="링크를 추가하면 채워져요"
                  items={profile?.interests ?? []}
                />
              </div>
              <div>
                <p className="mb-1.5 text-muted-foreground text-xs">기술·역량</p>
                <Chips empty="링크를 추가하면 채워져요" items={profile?.skills ?? []} />
              </div>
              <div>
                <p className="mb-1.5 text-muted-foreground text-xs">활동 이력</p>
                <Chips
                  empty="링크를 추가하면 채워져요"
                  items={profile?.activities ?? []}
                />
              </div>
            </div>
          </section>

          {profile && profile.sources.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="font-semibold text-sm">출처</h2>
              <ul className="mt-2 space-y-1.5">
                {profile.sources.map((source) => (
                  <li
                    className="flex items-center gap-2 text-muted-foreground text-xs"
                    key={`${source.label}-${source.addedAt}`}
                  >
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px]">
                      {source.type === "link" ? "링크" : "서류"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{source.label}</span>
                    <span className="shrink-0">
                      {new Date(source.addedAt).toLocaleDateString("ko-KR")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
