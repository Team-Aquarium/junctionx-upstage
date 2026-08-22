"use client";

import {
  FileUpIcon,
  LinkIcon,
  RotateCcwIcon,
  UserRoundIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWorkflowStream, WorkflowLog } from "@/components/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { UserProfile } from "@/lib/store";

const PROFILE_DOC_ACCEPT = ".pdf,.png,.jpg,.jpeg,.bmp,.tif,.tiff,.heic";

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
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

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 font-medium text-sm">{value ?? "—"}</p>
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-bold text-2xl tracking-tight">내 프로필</h1>
      <p className="mt-1 text-muted-foreground text-sm">
        개인 링크를 붙여넣으면 관심사·역량으로 <span className="font-medium">맞춤 추천</span>을,
        재학증명서 같은 서류를 올리면 학년·재학상태로{" "}
        <span className="font-medium">자격 판정</span>까지 해드려요.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold text-sm">
            <LinkIcon className="size-4 text-primary" />개인 링크로 추가
          </h2>
          <p className="mt-1 text-muted-foreground text-xs">
            GitHub, 블로그, 링크트리, 공개 포트폴리오 (로그인 필요 페이지 불가)
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
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold text-sm">
            <FileUpIcon className="size-4 text-primary" />서류로 추가
          </h2>
          <p className="mt-1 text-muted-foreground text-xs">
            재학증명서·성적증명서 (PDF/이미지) — Information Extract로 추출해요
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
        </div>
      </div>

      {message && (
        <p className="mt-3 rounded-lg border bg-muted/50 px-3 py-2 text-sm">{message}</p>
      )}

      {wf.steps.length > 0 && (
        <div className="mt-3 rounded-xl border bg-card p-4">
          <p className="mb-2 font-semibold text-sm">실행 과정</p>
          <WorkflowLog steps={wf.steps} />
        </div>
      )}

      <div className="mt-6 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-sm">
            <UserRoundIcon className="size-4 text-primary" />현재 프로필
          </h2>
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

        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : !profile ? (
          <p className="mt-3 text-muted-foreground text-sm">
            아직 프로필이 없어요. 위에서 링크나 서류를 추가해 보세요.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="이름" value={profile.name} />
              <Field label="학교" value={profile.university} />
              <Field label="학과" value={profile.department} />
              <Field label="학년" value={profile.grade != null ? `${profile.grade}학년` : null} />
              <Field label="학적 상태" value={profile.enrollment_status} />
              <Field label="출생연도" value={profile.birth_year} />
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground text-xs">관심 분야</p>
              <Chips items={profile.interests} />
              <p className="pt-1 text-muted-foreground text-xs">기술·역량</p>
              <Chips items={profile.skills} />
              <p className="pt-1 text-muted-foreground text-xs">활동 이력</p>
              <Chips items={profile.activities} />
            </div>
            {profile.sources.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs">출처</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground text-xs">
                  {profile.sources.map((source) => (
                    <li key={`${source.label}-${source.addedAt}`}>
                      [{source.type === "link" ? "링크" : "서류"}] {source.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
