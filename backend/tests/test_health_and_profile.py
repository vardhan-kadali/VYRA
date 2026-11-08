def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "VYRA Backend"

def test_ai_health_check(client):
    response = client.get("/api/ai/health")
    # If Ollama is running, it returns 200; if not, 503
    assert response.status_code in (200, 503)
    data = response.json()
    assert "available" in data
    assert "configured_model" in data or "model" in data

def test_profile_default_and_update(client):
    # 1. Get default profile
    res1 = client.get("/api/profile")
    assert res1.status_code == 200
    profile = res1.json()
    assert profile["full_name"] == "Candidate User"
    assert profile["email"] == "candidate@example.edu"
    assert profile["default_category"] == "viva"
    assert profile["default_difficulty"] == "intermediate"

    # 2. Update profile
    update_payload = {
        "full_name": "K.Y. Vardhan",
        "email": "vardhan@example.edu",
        "target_goal": "Senior Viva Examiner Screening",
        "default_duration": 30,
        "theme_mode": "high-contrast"
    }
    res2 = client.put("/api/profile", json=update_payload)
    assert res2.status_code == 200
    updated = res2.json()
    assert updated["full_name"] == "K.Y. Vardhan"
    assert updated["email"] == "vardhan@example.edu"
    assert updated["target_goal"] == "Senior Viva Examiner Screening"
    assert updated["default_duration"] == 30
    assert updated["theme_mode"] == "high-contrast"

    # 3. Verify persistence
    res3 = client.get("/api/profile")
    assert res3.status_code == 200
    assert res3.json()["full_name"] == "K.Y. Vardhan"
