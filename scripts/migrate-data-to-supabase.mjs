// 파일 기반 저장소(data/)의 데이터를 Supabase로 일회성 이관하는 스크립트.
// 사용법: node scripts/migrate-data-to-supabase.mjs
// .env.local의 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 사용한다.

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// .env.local 로드 (dotenv 없이 간단 파싱)
const envFile = join(process.cwd(), ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2];
    }
  }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const DATA_DIR = join(process.cwd(), "data");
const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
  } catch {
    return fallback;
  }
};

// 1) 공고
const announcements = readJson("announcements.json", []);
if (announcements.length > 0) {
  const rows = announcements.map((a) => ({
    id: a.id,
    category: a.category,
    title: a.title,
    organizer: a.organizer,
    field: a.field,
    apply_start: a.apply_start,
    apply_end: a.apply_end,
    result_date: a.result_date,
    benefits: a.benefits,
    contact: a.contact,
    apply_url: a.apply_url,
    summary: a.summary ?? [],
    rules: a.rules ?? {},
    todo_checklist: a.todo_checklist ?? [],
    source_file: a.sourceFile ?? null,
    source_url: a.sourceUrl ?? null,
    created_at: a.createdAt,
  }));
  const { error } = await supabase.from("announcements").upsert(rows);
  if (error) {
    throw new Error(`공고 이관 실패: ${error.message}`);
  }
  console.log(`공고 ${rows.length}건 이관 완료`);
} else {
  console.log("이관할 공고 없음");
}

// 2) 프로필
const profile = readJson("profile.json", null);
if (profile) {
  const { error } = await supabase
    .from("profile")
    .upsert({ id: 1, data: profile, updated_at: new Date().toISOString() });
  if (error) {
    throw new Error(`프로필 이관 실패: ${error.message}`);
  }
  console.log("프로필 이관 완료");
} else {
  console.log("이관할 프로필 없음");
}

// 3) 추천 캐시
const rec = readJson("recommendations.json", null);
if (rec?.hash) {
  const { error } = await supabase
    .from("recommendation_cache")
    .upsert({ id: 1, hash: rec.hash, items: rec.items ?? [], created_at: rec.createdAt });
  if (error) {
    throw new Error(`추천 캐시 이관 실패: ${error.message}`);
  }
  console.log("추천 캐시 이관 완료");
}

// 4) 업로드 원본 파일 → storage "uploads" 버킷
const uploadsDir = join(DATA_DIR, "uploads");
if (existsSync(uploadsDir)) {
  const byId = new Map(announcements.map((a) => [a.id, a]));
  const files = readdirSync(uploadsDir).filter((f) => !f.startsWith("."));
  let ok = 0;
  for (const name of files) {
    const bytes = readFileSync(join(uploadsDir, name));
    const contentType = byId.get(name)?.sourceFile?.mediaType ?? "application/octet-stream";
    const { error } = await supabase.storage
      .from("uploads")
      .upload(name, bytes, { contentType, upsert: true });
    if (error) {
      console.error(`  업로드 실패 ${name}: ${error.message}`);
    } else {
      ok += 1;
    }
  }
  console.log(`원본 파일 ${ok}/${files.length}건 업로드 완료`);
}

console.log("\n마이그레이션 완료. data/ 디렉터리는 이제 사용되지 않습니다.");
