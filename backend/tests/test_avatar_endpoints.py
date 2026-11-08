import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_avatar_status_endpoint():
    response = client.get("/api/avatar/status")
    # LiveTalking is running locally on 8010, so status should be 200 or 503 if offline
    assert response.status_code in [200, 503]
    data = response.json()
    assert "avatar_id" in data
    assert data["avatar_id"] == "wav2lip_avatar_glass_man"
    if response.status_code == 200:
        assert data["available"] is True
        assert data["voice"] == "en-IN-PrabhatNeural"
        assert data["transport"] == "webrtc"
        assert data["persona"] == "Dr. Prabhat Sharma"
    else:
        assert data["available"] is False
        assert "fallback" in data

def test_avatar_speak_invalid_session_rejected():
    response = client.post("/api/avatar/speak", json={
        "sessionid": "nonexistent-session-id-12345",
        "text": "Hello candidate.",
        "interrupt": True
    })
    # If service is up, it should return 400 with 'session not found'; if down, 503
    assert response.status_code in [400, 503]
