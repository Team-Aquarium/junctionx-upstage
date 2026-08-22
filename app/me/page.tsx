"use client";

import {
  CheckCircle2Icon,
  CircleDashedIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { UpstageBadge } from "@/components/upstage";
import { useWorkflowStream, WorkflowLog } from "@/components/workflow";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useI18n, useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n/types";
import type { UserProfile } from "@/lib/store";

const PROFILE_DOC_ACCEPT = ".pdf,.png,.jpg,.jpeg,.bmp,.tif,.tiff,.heic";

const REQUIRED_FIELDS = [
  { key: "name", label: "profile.fieldName" },
  { key: "university", label: "profile.fieldUniversity" },
  { key: "department", label: "profile.fieldDepartment" },
  { key: "grade", label: "profile.fieldGrade" },
  { key: "enrollment_status", label: "profile.fieldStatus" },
  { key: "birth_year", label: "profile.fieldBirthYear" },
] as const;

const STATUS_OPTIONS = ["재학", "휴학", "졸업"] as const;

type Draft = {
  name: string;
  university: string;
  department: string;
  grade: string;
  enrollment_status: string;
  birth_year: string;
};

function emptyDraft(): Draft {
  return {
    name: "",
    university: "",
    department: "",
    grade: "",
    enrollment_status: "",
    birth_year: "",
  };
}

function draftFromProfile(profile: UserProfile | null): Draft {
  if (!profile) {
    return emptyDraft();
  }
  return {
    name: profile.name ?? "",
    university: profile.university ?? "",
    department: profile.department ?? "",
    grade: profile.grade == null ? "" : String(profile.grade),
    enrollment_status: profile.enrollment_status ?? "",
    birth_year: profile.birth_year == null ? "" : String(profile.birth_year),
  };
}

function sourceLabel(type: UserProfile["sources"][number]["type"], t: Translator) {
  if (type === "link") {
    return t("profile.sourceLink");
  }
  if (type === "file") {
    return t("profile.sourceFile");
  }
  if (type === "note") {
    return t("profile.sourceNote");
  }
  return t("profile.sourceManual");
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const t = useT();
  const { locale } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const fileRef = useRef<HTMLInputElement>(null);
  const wf = useWorkflowStream();

  const load = async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      setProfile(data.profile);
      setDraft(draftFromProfile(data.profile));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const { run: runWf } = wf;
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/workflows");
        const { active } = (await res.json()) as { active: string[] };
        const key = active.find(
          (k) => k === "profile-file" || k === "profile-link" || k === "profile-note",
        );
        if (!key) {
          return;
        }
        setBusy(key === "profile-file" ? "file" : key === "profile-note" ? "note" : "link");
        const data = await runWf<{ profile: UserProfile }>(
          `/api/workflows/attach?key=${encodeURIComponent(key)}`,
        );
        if (data?.profile) {
          setProfile(data.profile);
          setDraft(draftFromProfile(data.profile));
          setMessage(t("profile.resumed"));
        }
        setBusy(null);
      } catch {
        // ignore
      }
    })();
  }, [runWf, t]);

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
      setDraft(draftFromProfile(data.profile));
      setLinkUrl("");
      setMessage(t("profile.linkUpdated"));
    } else {
      setMessage(wf.errorRef.current ?? t("profile.linkFailed"));
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
      setDraft(draftFromProfile(data.profile));
      setMessage(t("profile.fileUpdated", { name: file.name }));
    } else {
      setMessage(wf.errorRef.current ?? t("profile.fileFailed"));
    }
    setBusy(null);
  };

  const reset = async () => {
    setBusy("reset");
    await fetch("/api/profile", { method: "DELETE" });
    setProfile(null);
    setDraft(emptyDraft());
    setMessage(t("profile.resetDone"));
    setBusy(null);
  };

  const saveDraft = async () => {
    setBusy("save");
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          university: draft.university,
          department: draft.department,
          grade: draft.grade,
          enrollment_status: draft.enrollment_status,
          birth_year: draft.birth_year,
        }),
      });
      const data = (await res.json()) as { profile?: UserProfile };
      if (data.profile) {
        setProfile(data.profile);
        setDraft(draftFromProfile(data.profile));
        setMessage(t("profile.saved"));
      } else {
        setMessage(t("profile.saveFailed"));
      }
    } catch {
      setMessage(t("profile.saveFailed"));
    }
    setBusy(null);
  };

  const submitNote = async () => {
    if (!note.trim()) {
      return;
    }
    setBusy("note");
    setMessage(null);
    const data = await wf.run<{ profile: UserProfile }>("/api/profile/note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: note.trim() }),
    });
    if (data?.profile) {
      setProfile(data.profile);
      setDraft(draftFromProfile(data.profile));
      setNote("");
      setMessage(t("profile.noteUpdated"));
    } else {
      setMessage(wf.errorRef.current ?? t("profile.noteFailed"));
    }
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

  const dateLocale = locale === "ko" ? "ko-KR" : "en-US";

  return (
    <div className="w-full py-10 sm:py-14">
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 space-y-10">
        {/* Header */}
        <div>
          <span className="text-xs font-semibold tracking-wider text-primary uppercase">
            Profile & Eligibility
          </span>
          <h1 className="mt-1 font-bold text-3xl tracking-tight text-foreground">
            {t("profile.title")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {t("profile.subtitle")}
          </p>
        </div>

        {/* Profile Card */}
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          {loading ? (
            <div className="flex min-h-20 items-center justify-center">
              <Spinner className="size-5 text-primary" />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
              <div className="space-y-2">
                <h2 className="font-bold text-xl sm:text-2xl text-foreground">
                  {profile?.name ?? t("profile.emptyName")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {profile
                    ? [profile.university, profile.department].filter(Boolean).join(" · ") ||
                      t("profile.noAffiliation")
                    : t("profile.emptyHint")}
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-44 sm:shrink-0">
                {profile && (
                  <Button
                    disabled={busy !== null}
                    onClick={reset}
                    size="sm"
                    variant="outline"
                  >
                    <RotateCcwIcon className="size-3.5" />
                    {t("profile.reset")}
                  </Button>
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">{t("profile.completeness")}</span>
                    <span className="font-semibold text-primary">{completeness}%</span>
                  </div>
                  <Progress className="h-1.5 w-full bg-secondary" value={completeness} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2-Column Inputs & Extracted Data */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[340px_1fr]">
          {/* Left Column: Data Sources */}
          <div className="space-y-6">
            {/* Link Input */}
            <section className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">
                  {t("profile.addLink")}
                </h3>
                <UpstageBadge compact feature="solar" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("profile.addLinkBody")}
              </p>

              <div className="space-y-2 pt-1">
                <input
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  disabled={busy !== null}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitLink()}
                  placeholder="https://github.com/username"
                  type="url"
                  value={linkUrl}
                />
                <Button
                  className="w-full"
                  disabled={busy !== null || !linkUrl.trim()}
                  onClick={submitLink}
                  size="sm"
                >
                  {busy === "link" ? <Spinner className="size-4" /> : t("profile.analyzeLink")}
                </Button>
              </div>
            </section>

            {/* Document Input */}
            <section className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">
                  {t("profile.addDoc")}
                </h3>
                <UpstageBadge compact feature="information-extract" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("profile.addDocBody")}
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
                className="w-full"
                disabled={busy !== null}
                onClick={() => fileRef.current?.click()}
                size="sm"
                variant="outline"
              >
                {busy === "file" ? <Spinner className="size-4" /> : t("profile.pickFile")}
              </Button>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">
                  {t("profile.noteTitle")}
                </h3>
                <UpstageBadge compact feature="solar" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("profile.noteBody")}
              </p>
              <textarea
                className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                disabled={busy !== null}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("profile.notePlaceholder")}
                value={note}
              />
              <Button
                className="w-full"
                disabled={busy !== null || note.trim().length < 8}
                onClick={submitNote}
                size="sm"
              >
                {busy === "note" ? <Spinner className="size-4" /> : t("profile.noteSubmit")}
              </Button>
            </section>

            {message && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
                {message}
              </div>
            )}

            {wf.steps.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="text-xs font-semibold text-foreground">{t("profile.process")}</span>
                <WorkflowLog steps={wf.steps} />
              </div>
            )}
          </div>

          {/* Right Column: Information Display */}
          <div className="space-y-8">
            {/* Qualification Core Info */}
            <section className="space-y-3">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  {t("profile.coreTitle")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("profile.coreBody")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REQUIRED_FIELDS.map((field) => {
                  const filled = Boolean(draft[field.key]);
                  return (
                    <label
                      className="flex items-start gap-3 rounded-lg border border-border bg-card p-3.5"
                      key={field.key}
                    >
                      {filled ? (
                        <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <CircleDashedIcon className="size-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] text-muted-foreground block">{t(field.label)}</span>
                        {field.key === "enrollment_status" ? (
                          <select
                            className="mt-1 w-full bg-transparent text-sm font-medium text-foreground outline-none"
                            disabled={busy !== null}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, enrollment_status: e.target.value }))
                            }
                            value={draft.enrollment_status}
                          >
                            <option value="">{t("profile.unregistered")}</option>
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="mt-1 w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60 placeholder:font-normal"
                            disabled={busy !== null}
                            inputMode={
                              field.key === "grade" || field.key === "birth_year" ? "numeric" : "text"
                            }
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                            placeholder={t("profile.unregistered")}
                            type={field.key === "grade" || field.key === "birth_year" ? "number" : "text"}
                            value={draft[field.key]}
                          />
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              <Button disabled={busy !== null} onClick={saveDraft} size="sm">
                {busy === "save" ? <Spinner className="size-4" /> : t("profile.saveFields")}
              </Button>
            </section>

            {/* Recommendation Info */}
            <section className="space-y-3">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  {t("profile.recInfoTitle")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("profile.recInfoBody")}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div>
                  <span className="text-xs text-muted-foreground block mb-1.5 font-medium">
                    {t("profile.interests")}
                  </span>
                  <Chips
                    empty={t("profile.interestsEmpty")}
                    items={profile?.interests ?? []}
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1.5 font-medium">
                    {t("profile.skills")}
                  </span>
                  <Chips
                    empty={t("profile.skillsEmpty")}
                    items={profile?.skills ?? []}
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1.5 font-medium">
                    {t("profile.activities")}
                  </span>
                  <Chips
                    empty={t("profile.activitiesEmpty")}
                    items={profile?.activities ?? []}
                  />
                </div>
              </div>
            </section>

            {/* Sources List */}
            {profile && profile.sources.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-bold text-base text-foreground">
                  {t("profile.sourcesTitle", { n: profile.sources.length })}
                </h3>
                <ul className="space-y-1.5">
                  {profile.sources.map((source) => (
                    <li
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                      key={`${source.label}-${source.addedAt}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                          {sourceLabel(source.type, t)}
                        </span>
                        <span className="truncate text-foreground font-medium">{source.label}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(source.addedAt).toLocaleDateString(dateLocale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
