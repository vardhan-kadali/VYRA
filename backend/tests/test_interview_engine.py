import pytest
from unittest.mock import AsyncMock, patch
from app.interview.engine import InterviewEngine
from app.models.interview import SessionStatus, InterviewSession

class MockAIProvider:
    async def check_health(self):
        return {"available": True, "model_found": True, "status": "Mock Ready"}

    async def generate_first_question(self, topic, category, difficulty, subject=None, document_context=None, page_ref=None):
        return {
            "question": f"Can you explain the foundational principles of {topic}?",
            "page_ref": page_ref or "Page 1"
        }

    async def evaluate_answer_and_followup(self, topic, difficulty, question_text, candidate_answer, previous_exchanges, document_context=None, page_ref=None):
        return {
            "answer_score": 88.0,
            "feedback": "Clear explanation with good technical accuracy.",
            "next_question": f"How would you optimize performance for {topic} in production?",
            "page_ref": page_ref or "Page 1"
        }

    async def generate_final_evaluation(self, topic, category, difficulty, duration_minutes, exchanges, has_document):
        return {
            "overall_score": 86,
            "grade": "A",
            "subject_knowledge": 88,
            "technical_vocabulary": 85,
            "communication": 84,
            "code_application": 82,
            "syllabus_grounding": 92,
            "strengths": [
                "Solid conceptual fundamentals",
                "Concise and articulate responses",
                "Strong terminology adherence"
            ],
            "improvement_areas": [
                "Expand on edge case analysis",
                "Deepen discussion of performance trade-offs"
            ],
            "examiner_feedback": "The candidate exhibited commendable understanding during the viva."
        }

@pytest.mark.asyncio
async def test_interview_lifecycle_with_engine(db_session):
    engine = InterviewEngine(ai_provider=MockAIProvider())

    # 1. Create Session
    session = engine.create_session(
        db=db_session,
        topic="C++ Virtual Methods and Memory Management",
        category="viva",
        difficulty="intermediate",
        duration_minutes=5
    )
    assert session.status == SessionStatus.READY.value
    assert session.topic == "C++ Virtual Methods and Memory Management"

    # 2. Start Session -> generates Q1
    q1 = await engine.start_session(db_session, session.id)
    assert q1.question_number == 1
    assert "C++ Virtual Methods" in q1.question_text
    assert session.status == SessionStatus.WAITING_FOR_ANSWER.value

    # 3. Submit Candidate Answer -> evaluates & generates Q2
    res_q1 = await engine.submit_answer(
        db=db_session,
        session_id=session.id,
        candidate_answer="A vtable is a table of function pointers used for dynamic dispatch in C++."
    )
    assert res_q1["is_completed"] is False
    assert res_q1["question_number"] == 2
    assert res_q1["previous_answer_score"] == 88.0

    # 4. Submit Answer for Q2
    res_q2 = await engine.submit_answer(
        db=db_session,
        session_id=session.id,
        candidate_answer="Virtual calls introduce an extra pointer dereference overhead."
    )
    assert res_q2["is_completed"] is False
    assert res_q2["question_number"] == 3

    # 5. Submit Answer for Q3 (Duration is 5 mins -> 3 questions max -> concludes)
    res_q3 = await engine.submit_answer(
        db=db_session,
        session_id=session.id,
        candidate_answer="Inlining can sometimes devirtualize calls when types are known at compile time."
    )
    assert res_q3["is_completed"] is True
    assert res_q3["status"] == SessionStatus.COMPLETED.value
    assert "evaluation_id" in res_q3

    # 6. Verify Evaluation Record
    eval_obj = await engine.conclude_session(db_session, session.id)
    assert eval_obj.overall_score == 86
    assert eval_obj.grade == "A"
    assert eval_obj.subject_knowledge == 88
    assert eval_obj.syllabus_grounding == 92

def test_api_interview_endpoints_flow(client):
    # Test through HTTP Client
    with patch("app.api.routes_interviews.interview_engine.ai", MockAIProvider()), \
         patch("app.interview.engine.interview_engine.ai", MockAIProvider()):
        
        # Create
        create_res = client.post("/api/interviews", json={
            "topic": "Data Structures & AVL Trees",
            "category": "viva",
            "difficulty": "advanced",
            "duration_minutes": 15
        })
        assert create_res.status_code == 201
        session_id = create_res.json()["id"]

        # Start
        start_res = client.post(f"/api/interviews/{session_id}/start")
        assert start_res.status_code == 200
        q1_data = start_res.json()
        assert q1_data["question_number"] == 1

        # Submit Answer
        answer_res = client.post(f"/api/interviews/{session_id}/answer", json={
            "answer": "AVL trees perform rotations to maintain a strict balance factor between -1 and 1."
        })
        assert answer_res.status_code == 200
        ans_data = answer_res.json()
        assert ans_data["previous_answer_score"] == 88.0

        # Conclude Session
        end_res = client.post(f"/api/interviews/{session_id}/end")
        assert end_res.status_code == 200
        assert end_res.json()["status"] == "COMPLETED"

        # Get Report
        report_res = client.get(f"/api/interviews/{session_id}/report")
        assert report_res.status_code == 200
        rep_data = report_res.json()
        assert rep_data["overall_score"] == 86
        assert len(rep_data["strengths"]) >= 1

        # Check Dashboard Stats
        dash_res = client.get("/api/dashboard/stats")
        assert dash_res.status_code == 200
        dash_data = dash_res.json()
        assert dash_data["completed_count"] >= 1
        assert dash_data["average_score"] == 86.0

@pytest.mark.asyncio
async def test_scoring_representation_and_clamping(db_session):
    """Regression test ensuring answer_score and overall_score are strictly 0-100 scale and clamped."""
    class OutOfBoundsAIProvider(MockAIProvider):
        async def evaluate_answer_and_followup(self, *args, **kwargs):
            return {
                "answer_score": 135.5,  # Exceeds 100
                "feedback": "Outstanding answer.",
                "next_question": "Next question?",
                "page_ref": "Page 1"
            }

        async def generate_final_evaluation(self, *args, **kwargs):
            return {
                "overall_score": 150,  # Exceeds 100
                "grade": "A+",
                "subject_knowledge": -10,  # Below 0
                "technical_vocabulary": 85,
                "communication": 84,
                "code_application": 82,
                "syllabus_grounding": 92,
                "strengths": ["Strong grasp"],
                "improvement_areas": ["None"],
                "examiner_feedback": "Commendable."
            }

    engine = InterviewEngine(ai_provider=OutOfBoundsAIProvider())

    session = engine.create_session(
        db=db_session,
        topic="Boundary Testing",
        category="viva",
        difficulty="easy",
        duration_minutes=5
    )
    await engine.start_session(db_session, session.id)

    # Submit answer with out-of-bounds AI score (135.5) -> clamped to 100.0
    ans_res = await engine.submit_answer(
        db=db_session,
        session_id=session.id,
        candidate_answer="Testing boundary values."
    )
    assert ans_res["previous_answer_score"] == 100.0
    assert 0.0 <= ans_res["previous_answer_score"] <= 100.0

    # Conclude session with out-of-bounds evaluation scores -> clamped
    eval_obj = await engine.conclude_session(db_session, session.id)
    assert eval_obj.overall_score == 100
    assert eval_obj.subject_knowledge == 0  # clamped from -10
    assert 0 <= eval_obj.overall_score <= 100

def test_cancel_interview_lifecycle(client):
    """Verifies that an interview can be cancelled early and reports 404 gracefully without fabricated scores."""
    with patch("app.api.routes_interviews.interview_engine.ai", MockAIProvider()), \
         patch("app.interview.engine.interview_engine.ai", MockAIProvider()):

        # 1. Create interview
        create_res = client.post("/api/interviews", json={
            "topic": "Microservices Architecture & Sagas",
            "category": "viva",
            "difficulty": "medium",
            "duration_minutes": 15
        })
        assert create_res.status_code == 201
        session_id = create_res.json()["id"]

        # 2. Start session (Q1 generated)
        start_res = client.post(f"/api/interviews/{session_id}/start")
        assert start_res.status_code == 200

        # 3. Candidate decides to cancel viva early
        cancel_res = client.post(f"/api/interviews/{session_id}/cancel")
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "CANCELLED"

        # 4. Check session details (status should be CANCELLED)
        get_res = client.get(f"/api/interviews/{session_id}")
        assert get_res.status_code == 200
        assert get_res.json()["status"] == "CANCELLED"
        assert len(get_res.json()["exchanges"]) == 1

        # 5. Report should return 404 (no fabricated score)
        report_res = client.get(f"/api/interviews/{session_id}/report")
        assert report_res.status_code == 404
        assert "not yet generated" in report_res.json()["detail"].lower()

