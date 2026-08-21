# Upstage Document Agent

Junction Asia 2026 Upstage 트랙용 **문서 툴콜링 파이프라인**.
Solar Pro 4가 대화 중에 Upstage Document AI API들을 도구(tool)로 직접 호출해서 문서를 처리합니다.

## 스택

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4
- **Vercel AI SDK v7** (`ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`) — 툴콜링 루프 + 스트리밍
- **AI Elements** — Vercel AI SDK 공식 챗 UI 컴포넌트 (shadcn/ui 기반)
- **Upstage API** — Solar Pro 4 (챗/툴콜링) · Document Parse · Universal Information Extraction · Studio Agents

> 참고: Vercel AI Gateway 자체는 Vercel 발급 키(`vck_`)가 필요해서, 동일한 AI SDK 인터페이스로
> Upstage OpenAI 호환 엔드포인트(`api.upstage.ai/v1`)에 직접 연결했습니다. 모델 교체는 env 하나로 가능합니다.

## 실행

```bash
npm install
cp .env.example .env.local   # UPSTAGE_API_KEY 입력
npm run dev                  # http://localhost:3000
```

## 파이프라인 구조

```
[브라우저]                         [/api/chat]                        [Upstage API]
파일 첨부(PDF/이미지/오피스)   →   file part → docId 레지스트리 변환
질문 입력                      →   streamText(solar-pro4, tools)   →  /v1/chat/completions
                                    ├─ parse_document            →  /v1/document-digitization
                                    ├─ extract_information       →  /v1/information-extraction
                                    └─ run_studio_agent          →  /v2/files + /v2/responses (폴링)
툴 호출/결과 시각화            ←   UI Message Stream (SSE)
```

- 첨부 파일은 모델에게 직접 전달되지 않고 `docId` 마커로 치환됩니다. 모델이 필요할 때 도구를 호출해 내용에 접근합니다.
- 같은 파일 재파싱은 sha256 기반 메모리 캐시로 재과금을 방지합니다.
- 툴 루프는 최대 8스텝(`stopWhen: stepCountIs(8)`)까지 이어집니다.
- **추론(Reasoning) 표시**: Solar Pro 4의 `reasoning_effort`를 켜면 스텝마다 모델의 사고 과정이 스트리밍되어 UI에 접이식으로 표시됩니다. 입력창의 추론 수준 셀렉터(끄기/낮음/보통/높음, 기본 높음)로 조절합니다.

## UI 기능

- 추론 과정 실시간 표시 (자동 펼침/접힘, 소요 시간 표기)
- 툴 호출 카드 (파라미터/결과, 상태 뱃지: Running/Completed/Error)
- 파일 첨부 (버튼/드래그 앤 드롭, 미리보기 칩) · 다크 모드 · 답변 복사 · 다시 생성 · 대화 마크다운 내보내기 · 새 대화

## 도구 목록

| 도구 | Upstage API | 용도 |
| --- | --- | --- |
| `parse_document` | Document Parse (`document-parse`) | 문서 → 마크다운 변환. 요약/QA/번역의 첫 단계. standard/enhanced/auto 모드 |
| `extract_information` | Universal Information Extraction (`information-extract`) | 모델이 직접 설계한 JSON Schema로 필드 추출 |
| `run_studio_agent` | Studio Agents API (`agt_...`) | Studio에서 만든 Parse→Classify→Extract→Instruct 파이프라인 실행 |

## Studio 에이전트 연결

1. [studio.upstage.ai](https://studio.upstage.ai/)에서 에이전트 생성 → 저장 → Code 패널에서 `agt_...` ID 복사
2. `.env.local`에 `UPSTAGE_AGENT_ID=agt_...` 설정 (또는 채팅에서 ID를 직접 알려줘도 됨)
3. "이 문서를 Studio 에이전트로 처리해줘"라고 요청

## 환경변수

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `UPSTAGE_API_KEY` | O | Upstage 콘솔 API 키 (`up_...`) |
| `UPSTAGE_CHAT_MODEL` | X | 챗 모델 (기본 `solar-pro4`) |
| `UPSTAGE_AGENT_ID` | X | `run_studio_agent` 기본 에이전트 ID |

## 주요 파일

- `app/api/chat/route.ts` — 툴 정의 + streamText 루프 (파이프라인 핵심)
- `lib/upstage.ts` — Upstage REST 클라이언트 (Parse / Extract / Files / Jobs)
- `app/page.tsx` — AI Elements 챗 UI (첨부, 툴 시각화, 스트리밍)
