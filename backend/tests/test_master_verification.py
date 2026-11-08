import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app
from app.interview.engine import InterviewEngine
from tests.test_interview_engine import MockAIProvider

client = TestClient(app)

def test_full_master_quality_assurance_flow():
    """
    Executes the full master quality assurance workflow across all 4 fixes:
    1. Examiner audio and TTS verification (Fix 1)
    2. Session creation and start
    3. Examiner response generation & answer evaluation
    4. Concluding an interview and retrieving genuine evaluation report (Fix 3 & Fix 4)
    5. Starting an interview and cancelling it early (Fix 3)
    6. Verifying cancelled session report returns 404 (no fabricated scores) (Fix 4)
    7. Verifying cancelled session data is preserved (Fix 4)
    """
    with patch("app.api.routes_interviews.interview_engine.ai", MockAIProvider()), \
         patch("app.interview.engine.interview_engine.ai", MockAIProvider()):

        # -----------------------------------------------------------------
        # STEP 1: FIX 1 - EXAMINER AUDIO & VOICES VERIFICATION
        # -----------------------------------------------------------------
        voices_res = client.get("/api/audio/voices")
        assert voices_res.status_code == 200
        voices_data = voices_res.json()
        assert voices_data["default_voice"] == "en-IN-PrabhatNeural"
        assert "Dr. Prabhat Sharma" in voices_data["interviewer_name"]

        # TTS EdgeTTS Audio Synthesis
        tts_res = client.get("/api/audio/tts?text=Good+morning.+Please+explain+process+scheduling.")
        assert tts_res.status_code == 200
        assert "audio/mpeg" in tts_res.headers.get("content-type", "")
        assert len(tts_res.content) > 1000

        # Avatar status endpoint
        avatar_status_res = client.get("/api/avatar/status")
        assert avatar_status_res.status_code in [200, 503]

        # -----------------------------------------------------------------
        # STEP 2: COMPLETED INTERVIEW FLOW (Fix 3 & Fix 4)
        # -----------------------------------------------------------------
        # Create session
        create_res = client.post("/api/interviews", json={
            "topic": "Operating Systems Process Synchronization",
            "category": "viva",
            "difficulty": "medium",
            "duration_minutes": 15
        })
        assert create_res.status_code == 201
        session1_id = create_res.json()["id"]

        # Start session -> Question 1
        start_res = client.post(f"/api/interviews/{session1_id}/start")
        assert start_res.status_code == 200
        q1_data = start_res.json()
        assert q1_data["question_number"] == 1
        assert len(q1_data["question_text"]) > 10

        # Submit answer
        answer_res = client.post(f"/api/interviews/{session1_id}/answer", json={
            "answer": "A mutex provides mutual exclusion so only one thread can access critical section."
        })
        assert answer_res.status_code == 200
        ans_data = answer_res.json()
        assert ans_data["previous_answer_score"] == 88.0

        # Conclude session via End Session
        end_res = client.post(f"/api/interviews/{session1_id}/end")
        assert end_res.status_code == 200
        assert end_res.json()["status"] == "COMPLETED"

        # Verify completed report is available and contains real evaluations
        report1_res = client.get(f"/api/interviews/{session1_id}/report")
        assert report1_res.status_code == 200
        rep1_data = report1_res.json()
        assert rep1_data["overall_score"] == 86
        assert rep1_data["grade"] == "A"
        assert len(rep1_data["strengths"]) >= 1

        # -----------------------------------------------------------------
        # STEP 3: INTERRUPTED / CANCELLED INTERVIEW FLOW (Fix 3 & Fix 4)
        # -----------------------------------------------------------------
        # Create second session
        create2_res = client.post("/api/interviews", json={
            "topic": "Distributed Consensus & Raft",
            "category": "viva",
            "difficulty": "hard",
            "duration_minutes": 15
        })
        assert create2_res.status_code == 201
        session2_id = create2_res.json()["id"]

        # Start session 2
        start2_res = client.post(f"/api/interviews/{session2_id}/start")
        assert start2_res.status_code == 200

        # Cancel session 2 early (End Session -> Cancel Viva)
        cancel_res = client.post(f"/api/interviews/{session2_id}/cancel")
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "CANCELLED"

        # Cancelled session MUST return 404 for report (no fabricated score)
        report2_res = client.get(f"/api/interviews/{session2_id}/report")
        assert report2_res.status_code == 404
        assert "not yet generated" in report2_res.json()["detail"].lower()

        # Cancelled session data MUST be preserved in database
        sess2_res = client.get(f"/api/interviews/{session2_id}")
        assert sess2_res.status_code == 200
        s2_data = sess2_res.json()
        assert s2_data["status"] == "CANCELLED"
        assert len(s2_data["exchanges"]) == 1

