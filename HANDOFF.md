# Developer Handover Guide: VYRA

**Project:** VYRA — Voice-Based AI Viva & Technical Interview Platform  
**Target Repository:** `VYRA`  
**Current Date:** November 2026  
**Document Purpose:** Provide a comprehensive briefing and roadmap for the incoming developer continuing work on VYRA.

---

## 1. Executive Summary & Current Status

VYRA is an AI-driven academic viva and technical interview examination system featuring **Dr. Prabhat Sharma** as the virtual viva chair. The platform provides real-time voice and video interaction, strict PDF study-material grounding, dynamic question formulation, and 5-dimensional rubric grading.

### Current Milestone Status

- **Stage 1 (Gemini Migration Audit & Environment Preparation): COMPLETE**
  - Architecture inspected and documented.
  - All Ollama integration points cataloged.
  - Environment variables (`GEMINI_API_KEY`, `GEMINI_MODEL`) added to `backend/app/core/config.py` with safe defaults.
  - `backend/.env` prepared and protected by `.gitignore`.
  - All 19 backend test cases pass.
- **Stage 2 (Gemini Implementation & Ollama Removal): NOT YET IMPLEMENTED**
  - The codebase currently still uses local **Ollama** (`gemma3:4b` on CPU) as its active AI reasoning provider.
  - The incoming developer's primary immediate task is to implement the Gemini reasoning provider and retire the Ollama adapter according to the roadmap below.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────┐
│               Frontend (Next.js 15 / React 19)         │
│  - Port 3000                                           │
│  - InterviewRoomView.tsx (WebRTC player, speech STT)   │
│  - ReportsView.tsx, HistoryView.tsx, DashboardView.tsx │
└───────────┬────────────────────────────────────────────┘
            │ HTTP API & MediaStream
┌───────────▼────────────────────────────────────────────┐
│               Backend (FastAPI / Python 3.11)          │
│  - Port 8000                                           │
│  - Interview Engine (stateful viva coordinator)        │
│  - PyMuPDF text extractor + lexical chunk retriever    │
│  - EdgeTTS proxy (/api/audio/tts, en-IN-PrabhatNeural) │
│  - SQLite database (vyra.db)                           │
└───────────┬────────────────────────────────────────────┘
            │
    ┌───────┴────────────────────────────┐
    ▼                                    ▼
┌───────────────────────┐    ┌───────────────────────────────────┐
│  AI Reasoning Layer   │    │     Avatar Microservice           │
│  - CURRENT: Ollama    │    │  - LiveTalking (Port 8010)        │
│    (gemma3:4b, :11434)│    │  - Wav2Lip + Dr. Prabhat model   │
│  - TARGET: Gemini API │    │  - WebRTC bidirectional stream    │
│    (gemini-2.5-flash) │    │  - Fallback: High-res portrait    │
└───────────────────────┘    └───────────────────────────────────┘
```

---

## 3. Existing Ollama Implementation Details

Currently, AI viva reasoning is handled by `backend/app/ai/ollama_client.py`:

- **Model:** `gemma3:4b`
- **Execution Mode:** CPU offload (`num_gpu: 0` in `config.py`) to keep 100% of GPU VRAM free for the LiveTalking Wav2Lip video pipeline.
- **Provider Methods:**
  - `check_health()`: Probes `http://127.0.0.1:11434/api/tags` to verify Ollama status.
  - `generate_first_question(...)`: Formulates opening foundational question based on topic or PDF chunk.
  - `evaluate_answer_and_followup(...)`: Scores candidate answer (0-100), provides 1-2 sentence feedback, and formulates the next question.
  - `generate_final_evaluation(...)`: Generates composite scorecard across 5 dimensions, strengths, improvement areas, and closing examiner commentary.
- **Prompts:** Located in `backend/app/ai/prompts.py`. All prompts enforce strict JSON output schemas.

### Why Migrate from Ollama to Gemini?
- **Latency:** CPU inference on Gemma 3 takes 15–35 seconds per question. Gemini 2.5 Flash responds in 0.8–1.5 seconds.
- **CPU Bottleneck:** Offloading inference to cloud API reduces host CPU usage from 100% to near 0%.
- **Context & Adherence:** Gemini 2.5 Flash provides significantly stronger syllabus grounding and JSON schema compliance.

---

## 4. Planned Gemini Migration (Stage 2 Roadmap)

The migration plan transitions VYRA to Google's official Gemini Developer API (`gemini-2.5-flash`).

### Files Identified for Migration

| File Path | Description of Required Change |
|---|---|
| `backend/requirements.txt` | Add `google-genai` (official Google Gen AI SDK) or utilize async `httpx`. |
| `backend/app/core/config.py` | Remove Ollama variables (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, etc.). Keep `GEMINI_API_KEY` and `GEMINI_MODEL`. |
| `backend/app/ai/gemini_client.py` | **Create new provider** implementing `GeminiAIProvider` with identical contract to `OllamaAIProvider`. |
| `backend/app/ai/__init__.py` | Export `GeminiAIProvider` and `gemini_ai_provider`. |
| `backend/app/interview/engine.py` | Set default `ai_provider` to `gemini_ai_provider`. |
| `backend/app/main.py` | Replace `OllamaUnavailableError` exception handler with Gemini exception handler. |
| `backend/app/api/routes_health.py` | Update `/api/ai/health` to probe Gemini API instead of Ollama tags. |
| `backend/app/api/routes_interviews.py` | Catch Gemini exceptions instead of `OllamaUnavailableError`. |
| `backend/tests/test_health_and_profile.py` | Update test assertions to match Gemini health response. |
| `backend/app/ai/ollama_client.py` | Retire / delete once Gemini provider is verified. |

### Expected JSON Schemas (Must Be Preserved)

1. **First Question:**
   ```json
   {
     "question": "string",
     "page_ref": "Page X or null"
   }
   ```
2. **Answer Evaluation & Contextual Follow-up:**
   ```json
   {
     "answer_score": 85.0,
     "feedback": "string",
     "next_question": "string",
     "page_ref": "Page X or null"
   }
   ```
3. **Session Evaluation (Final Rubric):**
   ```json
   {
     "overall_score": 88,
     "grade": "A",
     "subject_knowledge": 90,
     "technical_vocabulary": 88,
     "communication": 85,
     "code_application": 82,
     "syllabus_grounding": 94,
     "strengths": ["...", "...", "..."],
     "improvement_areas": ["...", "..."],
     "examiner_feedback": "..."
   }
   ```

### Error Handling Rules
- If `GEMINI_API_KEY` is missing or invalid: return clean HTTP 503 error; **do not fabricate answers or scores**.
- If rate limits (HTTP 429) occur: propagate clean error with retry instructions.
- Never expose `GEMINI_API_KEY` to the Next.js frontend or browser.

---

## 5. LiveTalking Avatar Service Setup

LiveTalking runs as an independent microservice separate from the main VYRA repository:

- **Location:** Typically run from a dedicated virtual environment with PyTorch + CUDA (e.g., `LiveTalking/app.py`).
- **Endpoint:** `http://127.0.0.1:8010`
- **Model:** Dr. Prabhat Sharma persona (`wav2lip_avatar_glass_man`).
- **Protocol:** Bidirectional WebRTC via `aiortc` (FastAPI acts as SDP negotiation proxy via `/api/avatar/offer`).
- **Automatic Fallback:** If LiveTalking is offline or not installed, the VYRA frontend automatically falls back to displaying a high-resolution portrait of Dr. Sharma while using EdgeTTS (`en-IN-PrabhatNeural`) directly via HTML5 `<audio>`. You can run full viva interviews without the live avatar server!

---

## 6. Document Grounding & PDF Handling

- Handled by `backend/app/pdf/extractor.py` (PyMuPDF text extraction) and `backend/app/pdf/retriever.py` (BM25 lexical search).
- When a candidate uploads a syllabus or paper, chunks are stored in `vyra.db` (`document_chunks` table).
- The top relevant chunks are retrieved and prepended to the AI prompt under `DOCUMENT EXCERPT (SOURCE OF TRUTH)`.
- The AI is strictly instructed to test only concepts in the excerpt and cite page numbers (`Page X`).
- This grounding mechanism is decoupled from the AI model and will work seamlessly with Gemini.

---

## 7. Known Limitations & Things to Watch Out For

1. **Browser Speech Recognition (STT):**
   - Uses Web Speech API (`webkitSpeechRecognition`).
   - Requires browser microphone permission.
   - Best supported in Google Chrome and Microsoft Edge.
   - Text keyboard input fallback is built in for environments without mic support.
2. **Audio Autoplay Policy:**
   - Modern browsers block unprompted audio autoplay. The candidate must click **"Start Interview"** or **"Unmute"** to grant audio playback permissions.
3. **Database Records:**
   - SQLite database is saved as `vyra.db`. It is excluded from Git to prevent committing personal viva records or uploaded document binary data.

---

## 8. Starting Point for Continuing Developer

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vardhan-kadali/VYRA.git
   cd VYRA
   ```
2. **Setup Backend:**
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   copy .env.example .env
   # Add your GEMINI_API_KEY to .env
   ```
3. **Run existing tests to confirm baseline health:**
   ```bash
   pytest tests
   # Expect: 19 passed
   ```
4. **Implement Stage 2 Gemini Provider:**
   - Follow the roadmap in Section 4 above.
   - Implement `backend/app/ai/gemini_client.py`.
   - Update `InterviewEngine` to use the new provider.
   - Re-run test suite and perform live end-to-end interview verification.
