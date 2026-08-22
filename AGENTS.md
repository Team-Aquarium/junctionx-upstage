# AGENTS.md

Junction Asia 2026 Upstage 트랙 프로젝트 **"모아보라"** — 공고문(PDF·포스터·HWP)을
Upstage Studio 에이전트가 읽어 구조화된 공고 카드로 만들고, 개인 링크·서류로 만든 프로필과
대조해 지원 가능 여부까지 판정하는 공고 에이전트 서비스다. 보조 기능으로 Solar Pro 4
툴콜링 문서 챗(/chat)을 유지한다. 이 문서는 이 저장소에서 작업하는 AI 에이전트/개발자가
지켜야 할 아키텍처와 컨벤션을 정의한다.

## 서비스 구조 (모아보라)

```
[공고 등록 /ingest]  파일 업로드 → POST /api/ingest
                     → Studio 공고 에이전트 실행 (Parse→Classify 6종→Extract 10필드→Instruct JSON)
                     → 파싱(lib/upstage.ts parseAgentJson, 이중 인코딩/인용마커 처리)
                     → data/announcements.json 저장
[프로필 /me]         링크 → POST /api/profile/link (HTML→텍스트→solar-pro4 JSON 추출)
                     서류 → POST /api/profile (Universal Information Extraction)
                     → data/profile.json 병합 저장 (lib/store.ts mergeProfile)
[피드 /]             GET /api/announcements → 공고 × 프로필 매칭(lib/matching.ts)
                     → verdict: eligible(지원 가능)/ineligible(자격 미달)/check(확인 필요)
[상세 /notice/[id]]  요약·핵심 정보·자격 판정 사유·체크리스트·원문(/api/files/[id])
```

- Studio 에이전트: `공고 에이전트` (agt_Wq276WB3gsZygK6WnenGoa, 설정 #2).
  분류 6종(공모전/해커톤·대회/장학금/대외활동·서포터즈/채용·인턴/others),
  Extract 필드 10개(title/organizer/field/eligibility_text/apply_start/apply_end/
  result_date/benefits/contact/apply_url), Instruct는 순수 JSON만 출력하도록 프롬프트됨.
- Instruct 출력은 JSON 문자열로 **이중 인코딩**되어 오고, 값에 인용 마커(【†1】)가 섞일 수 있다.
  `parseAgentJson` + lib/ingest.ts의 `clean()`이 처리하므로 파서를 우회하지 말 것.
- AI가 개입하는 라우트(ingest/crawl/profile/profile-link/recommendations)는 모두
  **NDJSON 워크플로우 스트림**(`lib/workflow.ts`)으로 응답한다. 단계·중간 산출물·Solar 추론이
  실시간으로 흐르고, 클라이언트는 `useWorkflowStream`/`WorkflowLog`(components/workflow.tsx)로 렌더한다.
  Content-Type이 `application/x-ndjson`이므로 클라이언트에서 `includes("json")`으로
  일반 JSON과 구분하면 안 된다 (`application/json` 정확 매칭 필요).
- Studio Job 폴링 응답의 output은 스냅샷마다 담기는 메시지가 달라서(중간엔 개별 노드,
  완료 시점엔 마지막만) `runStudioAgentDetailed`가 누적 맵으로 전체 노드 출력을 보존한다.
- 저장소는 `data/` 파일 기반(JSON + uploads). 전역 DB 도입 금지 — 데모 스코프.
- 데모 샘플: `samples/` (공고문 2종 + 재학증명서, Chrome headless로 HTML→PDF 변환).

## 스택

| 영역 | 사용 기술 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 | |
| AI | Vercel AI SDK v7 (`ai`, `@ai-sdk/react`) | 아래 "AI 레이어" 참고 |
| LLM | Upstage `solar-pro4` (OpenAI 호환 API 직접 연결) | AI Gateway 아님 — 주의 |
| UI | shadcn/ui (radix 베이스) + AI Elements | 소스가 저장소에 포함됨 |
| 스키마 검증 | zod v4 | 툴 inputSchema |
| 테마 | next-themes | class 기반 dark 모드 |

## 명령어

```bash
npm run dev     # 개발 서버 (localhost:3000)
npm run build   # 프로덕션 빌드 + 타입체크 (작업 후 반드시 통과 확인)
npm run lint    # eslint
```

## 디렉터리 구조

```
app/
  page.tsx                    # 공고 피드
  ingest/page.tsx             # 공고 등록 (드래그앤드롭 → 에이전트 실행)
  me/page.tsx                 # 프로필 (링크·서류 추가)
  notice/[id]/page.tsx        # 공고 상세 (판정 사유·체크리스트)
  chat/page.tsx               # 문서 챗 (기존 툴콜링 UI)
  api/ingest/route.ts         # 공고 인제스트 (파일 업로드 → lib/ingest.ts)
  api/ingest/link/route.ts    # 공고 링크 직접 등록 (웹페이지 본문·파일 링크·전용 수집기 라우팅)
  api/crawl/route.ts          # 공모전 크롤링 수집 (콘테스트코리아·위비티, 최대 10건/회)
  api/recommendations/route.ts# Solar 추천 (적합도 점수+이유, 프로필·공고 해시 캐시)
  api/announcements/route.ts  # 공고 목록 + 매칭 판정
  api/profile/route.ts        # 프로필 조회/서류 추출/초기화
  api/profile/link/route.ts   # 개인 링크 → 프로필 추출
  api/files/[id]/route.ts     # 공고 원본 파일 서빙
  api/chat/route.ts           # 챗: streamText + 툴 정의 + reasoning 옵션
  layout.tsx                  # ThemeProvider, TooltipProvider, SiteHeader
lib/
  upstage.ts                  # Upstage REST 클라이언트 (Parse/Extract/Files/Jobs/파서/추천)
  workflow.ts                 # NDJSON 워크플로우 스트림 (서버 헬퍼 + 이벤트 타입)
  ingest.ts                   # 공고 문서 → 에이전트 실행 → Announcement 저장 (공용, 단계 emit)
  crawler.ts                  # 공모전 크롤러: 콘테스트코리아·위비티 (둘 다 robots Allow 확인됨)
                              #  문서 우선순위: 첨부 HWP/PDF > 본문 HTML > 포스터 이미지
                              #  콘테스트코리아 첨부는 file_dn.php 핸들러(확장자는 앵커 텍스트에)이며
                              #  첨부가 신청서여도 정보가 빠지지 않게 본문 HTML을 보조 문서로 함께 투입
  store.ts                    # 파일 기반 저장소 (공고·프로필·업로드·추천 캐시)
  matching.ts                 # 공고 × 프로필 자격 판정
components/
  site-header.tsx             # 전역 헤더 (네비 + 테마 토글)
  announcement.tsx            # 공고 카드·뱃지·D-day 계산
  workflow.tsx                # 워크플로우 스트림 훅(useWorkflowStream) + 단계 로그 UI
  ai-elements/                # AI Elements 컴포넌트 (로컬 패치 있음 — 아래 주의사항)
  ui/                         # shadcn/ui 컴포넌트
samples/                      # 데모용 샘플 문서 (HTML 원본 + PDF)
scripts/test-agent.mjs        # Studio 에이전트 단독 실행 테스트
data/                         # 런타임 저장소 (gitignore)
```

## AI 레이어 (Vercel AI SDK)

**중요**: 팀 내에서 "Vercel AI Gateway"라고 부르지만, 실제로는 Gateway를 쓰지 않는다.
Gateway는 Vercel 발급 키(`vck_`)가 필요해서, 동일한 AI SDK 인터페이스로
`@ai-sdk/openai-compatible`을 통해 `https://api.upstage.ai/v1`에 **직접** 연결한다.
provider 이름은 `upstage`이며, 이 이름이 `providerOptions`의 키가 된다.

```ts
const upstage = createOpenAICompatible({
  name: "upstage",
  baseURL: "https://api.upstage.ai/v1",
  apiKey: process.env.UPSTAGE_API_KEY ?? "",
});

streamText({
  model: upstage(process.env.UPSTAGE_CHAT_MODEL ?? "solar-pro4"),
  stopWhen: stepCountIs(8),                                  // 툴 루프 상한
  providerOptions: { upstage: { reasoningEffort: "high" } }, // reasoning 켜기
  ...
});
```

### 문서 처리 흐름 (docId 패턴)

Solar 챗 API는 파일 입력을 받지 못한다. 그래서:

1. 클라이언트가 파일을 data URL로 담은 `file` 파트로 전송
2. `route.ts`의 `collectDocuments()`가 file 파트를 서버 레지스트리로 옮기고,
   모델에게는 `[첨부 문서] docId="doc-1" ...` 텍스트 마커만 전달
3. 모델이 툴 호출 시 `docId`로 문서를 참조

### 툴 3종 (`app/api/chat/route.ts`)

| 툴 | Upstage API | 엔드포인트 |
| --- | --- | --- |
| `parse_document` | Document Parse | `POST /v1/document-digitization` (multipart) |
| `extract_information` | Universal Information Extraction | `POST /v1/information-extraction/chat/completions` |
| `run_studio_agent` | Studio Agents API | `POST /v2/files` → `POST /v2/responses` → 폴링 |

- 툴 실행 실패는 throw하지 않고 `{ error: string }`을 반환한다 — 모델이 읽고 자가 수정한다.
- 파싱 결과는 sha256 키 메모리 캐시로 재과금을 방지한다 (`lib/upstage.ts`).
- 파싱 마크다운은 40,000자에서 잘라 컨텍스트 폭주를 막는다.
- 새 툴 추가 시: `lib/upstage.ts`에 API 클라이언트 → `route.ts`에 `tool()` 정의 →
  `page.tsx`의 `TOOL_TITLES`에 한국어 제목 추가.

### Reasoning

- 요청 body의 `reasoningEffort`(`low`/`medium`/`high`, 그 외 값은 끔)를
  `providerOptions.upstage.reasoningEffort`로 전달한다.
- Upstage는 스트리밍 델타에 `reasoning` 필드를 실어 보내고, openai-compatible provider가
  이를 reasoning 파트로 자동 매핑한다. `toUIMessageStreamResponse({ sendReasoning: true })` 필수.

## UI 레이어 (shadcn/ui + AI Elements)

- 컴포넌트 추가: `npx shadcn@latest add <name>` 또는 `npx ai-elements@latest add <name>`.
  단, **덮어쓰기 주의** — 아래 로컬 패치가 날아갈 수 있다.
- 로컬 패치된 파일 (재설치 시 `--overwrite` 금지, diff 확인 필수):
  - `prompt-input.tsx` — `matchesAccept`에 `.pdf` 같은 확장자 패턴 지원 추가
  - `message.tsx`, `reasoning.tsx` — streamdown/shiki 중첩 버전 타입 캐스팅
  - `context.tsx`, `agent.tsx`, `schema-display.tsx` — AI SDK v7 타입 호환 수정
  - `tool.tsx` — `ToolHeader`의 `title`을 ReactNode로 확장 (워크플로우 로그가 Upstage 아이콘 포함 제목 전달)
- 워크플로우 로그(components/workflow.tsx)는 챗과 동일한 AI Elements를 쓴다:
  Solar 추론 단계(id="reasoning")는 `Reasoning`, 나머지 단계는 `Tool` 패널로 렌더.
- 스타일은 Tailwind 유틸리티 + `cn()`(`lib/utils.ts`)만 사용. CSS 파일 추가 금지.
- 테마 토큰(`bg-background`, `text-muted-foreground` 등)을 쓰고 색상 하드코딩 금지.
- UI 문구는 한국어가 기본이다.

## 상태 관리

**전역 스토어(Redux/Zustand 등)를 도입하지 않는다.** 현재 구조로 충분하다.

| 상태 | 관리 방식 | 위치 |
| --- | --- | --- |
| 대화(메시지/스트리밍/에러) | `useChat` (`@ai-sdk/react`) | `page.tsx` |
| 입력 텍스트 + 첨부 파일 | `PromptInputProvider` Context | `page.tsx` 최상단 래핑 |
| 추론 수준, 복사 피드백, 파일 에러 | 로컬 `useState` | `page.tsx` |
| 테마 | `next-themes` | `layout.tsx` |
| 파싱 캐시 | 서버 메모리 `Map` (모듈 스코프) | `lib/upstage.ts` |

주의: `PromptInputProvider`를 제거하면 안 된다. 없으면 전송 시 `form.reset()`이
폼 내부 Select(추론 수준)까지 초기화하고, 예시 프롬프트가 첨부 파일을 읽지 못한다.

## 환경변수 (`.env.local`, 커밋 금지)

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `UPSTAGE_API_KEY` | O | `up_...` 키. 코드에 하드코딩 절대 금지 |
| `UPSTAGE_CHAT_MODEL` | X | 기본 `solar-pro4` |
| `UPSTAGE_AGENT_ID` | X | Studio 에이전트 기본 ID (`agt_...`) |

`.env.example`이 템플릿이며 이것만 커밋한다 (`.gitignore`에 `!.env.example` 예외 있음).

## 주의사항

- 트랙 요구사항: "Upstage Studio must power the core document-processing stages" —
  최종 제출은 `run_studio_agent` 경로가 핵심 처리를 담당해야 한다.
- Upstage API 호출은 과금된다. 테스트는 1페이지짜리 작은 문서로 하고,
  같은 파일 반복 파싱은 캐시에 맡긴다.
- 커밋 전 `npm run build`로 타입체크를 통과시킨다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
