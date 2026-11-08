import asyncio
import httpx
import json

BASE_URL = "http://127.0.0.1:8000/api"

async def test_integration():
    print("=" * 60)
    print("VYRA MASTER INTEGRATION & QUALITY ASSURANCE TEST")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=120.0) as client:
        # 1. Health check
        res = await client.get(f"{BASE_URL}/health")
        print(f"[1. Health Check] HTTP {res.status_code}: {res.json()}")
        assert res.status_code == 200

        # 2. Audio & TTS Verification
        res = await client.get(f"{BASE_URL}/audio/voices")
        print(f"[2. Audio Voices] HTTP {res.status_code}: default_voice={res.json().get('default_voice')}")
        assert res.status_code == 200
        assert res.json().get("default_voice") == "en-IN-PrabhatNeural"

        # EdgeTTS speech synthesis check
        tts_res = await client.get(f"{BASE_URL}/audio/tts?text=Welcome+to+your+academic+viva.")
        print(f"[3. EdgeTTS Synthesis] HTTP {tts_res.status_code}: Content-Type={tts_res.headers.get('content-type')}, bytes={len(tts_res.content)}")
        assert tts_res.status_code == 200
        assert "audio/mpeg" in tts_res.headers.get("content-type", "")
        assert len(tts_res.content) > 1000

        # 4. Avatar status
        avatar_res = await client.get(f"{BASE_URL}/avatar/status")
        print(f"[4. Avatar Status] HTTP {avatar_res.status_code}: {avatar_res.json().get('status')}")

        # 5. Full Completed Interview Workflow
        print("\n--- Testing Completed Interview Flow ---")
        create_res = await client.post(f"{BASE_URL}/interviews", json={
            "topic": "Operating Systems Concurrency and Semaphores",
            "category": "viva",
            "difficulty": "medium",
            "duration_minutes": 5
        })
        assert create_res.status_code == 201
        session_id = create_res.json()["id"]
        print(f"[5. Viva Session Created] ID: {session_id}")

        # Start interview
        start_res = await client.post(f"{BASE_URL}/interviews/{session_id}/start")
        assert start_res.status_code == 200
        q1 = start_res.json()
        print(f"[6. Question 1 Delivered]: \"{q1['question_text']}\"")

        # Submit answer
        answer_res = await client.post(f"{BASE_URL}/interviews/{session_id}/answer", json={
            "answer": "A semaphore is a synchronization primitive that maintains a counter to control concurrent access to a shared resource."
        })
        assert answer_res.status_code == 200
        ans_data = answer_res.json()
        print(f"[7. Answer Evaluated]: Score={ans_data.get('previous_answer_score')}%, Feedback={ans_data.get('previous_answer_feedback')}")

        # Conclude and generate evaluation report
        end_res = await client.post(f"{BASE_URL}/interviews/{session_id}/end")
        assert end_res.status_code == 200
        print(f"[8. Session Concluded]: Status={end_res.json().get('status')}, OverallScore={end_res.json().get('overall_score')}")

        # Retrieve evaluation report
        rep_res = await client.get(f"{BASE_URL}/interviews/{session_id}/report")
        assert rep_res.status_code == 200
        report = rep_res.json()
        print(f"[9. Evaluation Report Retrieved]: Score={report.get('overall_score')}/100, Grade={report.get('grade')}, SyllabusGrounding={report.get('syllabus_grounding')}%")

        # 6. Interrupted / Cancelled Interview Workflow
        print("\n--- Testing Interrupted / Cancelled Interview Flow ---")
        create2_res = await client.post(f"{BASE_URL}/interviews", json={
            "topic": "Distributed Consensus and Raft",
            "category": "viva",
            "difficulty": "hard",
            "duration_minutes": 15
        })
        assert create2_res.status_code == 201
        session2_id = create2_res.json()["id"]
        print(f"[10. Second Viva Session Created] ID: {session2_id}")

        # Start session 2
        start2_res = await client.post(f"{BASE_URL}/interviews/{session2_id}/start")
        assert start2_res.status_code == 200
        print(f"[11. Question 1 Delivered]: \"{start2_res.json()['question_text']}\"")

        # Cancel session 2 early
        cancel_res = await client.post(f"{BASE_URL}/interviews/{session2_id}/cancel")
        assert cancel_res.status_code == 200
        assert cancel_res.json().get("status") == "CANCELLED"
        print(f"[12. Session Cancelled Early]: Status={cancel_res.json().get('status')}")

        # Verify Report returns 404 (no fabricated scorecard)
        rep2_res = await client.get(f"{BASE_URL}/interviews/{session2_id}/report")
        print(f"[13. Cancelled Session Report Call]: HTTP {rep2_res.status_code} (Expected 404: No fabricated scorecard)")
        assert rep2_res.status_code == 404

        # Verify session info is preserved
        sess2_res = await client.get(f"{BASE_URL}/interviews/{session2_id}")
        assert sess2_res.status_code == 200
        s_data = sess2_res.json()
        print(f"[14. Session Data Preserved]: Status={s_data.get('status')}, Questions Recorded={len(s_data.get('exchanges'))}")
        assert s_data.get("status") == "CANCELLED"
        assert len(s_data.get("exchanges")) == 1

        print("\n" + "=" * 60)
        print("ALL INTEGRATION VERIFICATION CHECKS PASSED PERFECTLY!")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_integration())

