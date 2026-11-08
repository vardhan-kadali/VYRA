import pytest
from fastapi.testclient import TestClient

def test_get_voices(client: TestClient):
    response = client.get("/api/audio/voices")
    assert response.status_code == 200
    data = response.json()
    assert data["default_voice"] == "en-IN-PrabhatNeural"
    assert "Dr. Prabhat Sharma" in data["interviewer_name"]
    assert len(data["supported_voices"]) >= 1

def test_tts_synthesis_post_success(client: TestClient):
    payload = {
        "text": "Hello, candidate. Please introduce yourself and your preparation target.",
        "voice": "en-IN-PrabhatNeural"
    }
    response = client.post("/api/audio/tts", json=payload)
    assert response.status_code == 200
    assert "audio/mpeg" in response.headers.get("content-type", "")
    assert len(response.content) > 1000

def test_tts_synthesis_get_success(client: TestClient):
    text = "Explain the difference between stack and heap memory."
    response = client.get(f"/api/audio/tts?text={text}")
    assert response.status_code == 200
    assert "audio/mpeg" in response.headers.get("content-type", "")
    assert len(response.content) > 1000

def test_tts_empty_text_validation(client: TestClient):
    payload = {"text": ""}
    response = client.post("/api/audio/tts", json=payload)
    assert response.status_code == 422
