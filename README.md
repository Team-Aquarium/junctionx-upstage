# 모아보라

JunctionX Korea 2026 Upstage 트랙 — **공고문(PDF·포스터·HWP)을 Studio 에이전트가 읽어 구조화된 공고 카드로 만들고**, 프로필과 대조해 **지원 가능 여부**까지 판정하는 공고 에이전트 서비스.

보조 기능으로 Solar Pro 4 **문서 챗**(`/chat`)을 제공합니다.

## 실행

```bash
npm install
cp .env.example .env.local   # UPSTAGE_API_KEY, SUPABASE_* 입력
npm run dev                  # http://localhost:3000
```

## 주요 페이지

| 경로 | 설명 |
| --- | --- |
| `/` | 랜딩 — Studio 4단계 파이프라인 소개 |
| `/feed` | 공고 피드 + Solar 추천 + 자격 판정 (`eligible` / `ineligible` / `check`) |
| `/ingest` | 공고 등록 (파일·링크·크롤) → Studio 공고 에이전트 |
| `/me` | 프로필 (링크·서류·메모) |
| `/notice/[id]` | 공고 상세 — 판정 사유·체크리스트 |
| `/chat` | 문서 툴콜링 챗 (Parse · Extract · Studio Agent) |

## 스택

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4
- **Vercel AI SDK v7** — 워크플로우 NDJSON 스트림 + 챗 툴콜링
- **Upstage** — Solar Pro 4 · Document Parse · Information Extraction · Studio Agents
- **Supabase** — 공고·원본 파일 저장 (프로필·추천 캐시는 방문자별 in-memory)

> AI Gateway(`vck_`) 대신 `@ai-sdk/openai-compatible`로 `api.upstage.ai/v1`에 직접 연결합니다.

## 환경변수

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `UPSTAGE_API_KEY` | O | Upstage API 키 (`up_...`) |
| `SUPABASE_URL` | O | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | O | service_role 키 (서버 전용) |
| `UPSTAGE_CHAT_MODEL` | X | 챗 모델 (기본 `solar-pro4`) |
| `UPSTAGE_AGENT_ID` | X | Studio 공고 에이전트 ID (`agt_...`) |

## 개발·피치 스크립트

```bash
npm run dev
node scripts/capture-pitch-ui.mjs   # 피치 덱 UI 스크린샷 (다크, 1280×720)
node scripts/test-agent.mjs         # Studio 에이전트 단독 테스트 (samples PDF)
```

**데모 영상** (`demo/moabora-demo.mp4`)은 Git에 포함하지 않습니다. 로컬에서 녹화:

```bash
npm run dev
npx playwright install chromium   # 최초 1회
node scripts/record-demo.mjs      # ffmpeg 필요 → demo/moabora-demo.mp4
node scripts/burn-demo-subs.mjs   # 자막 번인 (선택)
node scripts/remix-demo.mjs       # 나레이션 믹스 (선택)
```

피치 덱: `slides/deck.html` · PDF `slides/out/moabora-deck.pdf` · 스크립트 `slides/script-ko.md`, `slides/script-en.md`

## 아키텍처 요약

```
공고 등록 → Studio 에이전트 (Parse→Classify→Extract→Instruct) → Supabase
프로필    → 링크/서류/메모 추출 → 방문자별 프로필 (쿠키 `moabora-vid`)
피드      → lib/matching.ts 자격 판정 + Solar 추천 (캐시)
```

자세한 컨벤션·API·워크플로우 스트림 규칙은 [`AGENTS.md`](AGENTS.md)를 참고하세요.

## License

[GNU Affero General Public License v3.0 or later](LICENSE) — Copyright (C) 2026 Team Aquarium
