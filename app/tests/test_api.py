import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Helper to register and get auth headers
def get_auth_headers():
    unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretPassword123"
    client.post("/auth/register", json={"email": unique_email, "password": password})
    res = client.post("/auth/login", data={"username": unique_email, "password": password})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# 1. Test Health Endpoint
def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data
    assert "version" in data


# 2. Test User Registration
def test_register_user():
    unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": unique_email,
        "password": "strongPassword123!"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == unique_email
    assert data["is_active"] is True
    assert "id" in data
    # Ensure raw password is NEVER returned in response
    assert "password" not in data
    assert "hashed_password" not in data


# 3. Test User Login and JWT Generation
def test_login_user():
    unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretPassword123"
    
    # First register
    reg_response = client.post("/auth/register", json={"email": unique_email, "password": password})
    assert reg_response.status_code == 201

    # Login with OAuth2 form data (username=email, password=password)
    login_data = {
        "username": unique_email,
        "password": password
    }
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert len(data["access_token"]) > 20


# 4. Test Login with Incorrect Credentials
def test_login_invalid_password():
    unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    password = "correctPassword"
    client.post("/auth/register", json={"email": unique_email, "password": password})

    response = client.post("/auth/login", data={"username": unique_email, "password": "wrongPassword"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


# 5. Test Task Creation & Retrieval (with Auth)
def test_create_and_get_task():
    headers = get_auth_headers()
    task_payload = {
        "title": "Automated Test Task",
        "description": "Testing FastAPI Task CRUD",
        "priority_level": "high",
        "category": "Testing"
    }
    create_res = client.post("/tasks", json=task_payload, headers=headers)
    assert create_res.status_code == 201
    task_data = create_res.json()
    assert task_data["title"] == "Automated Test Task"
    task_id = task_data["id"]

    # Verify retrieval by ID
    get_res = client.get(f"/tasks/{task_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == task_id


# 6. Test Goal Relational Date Range Validation (with Auth)
def test_goal_invalid_date_range():
    headers = get_auth_headers()
    invalid_goal = {
        "title": "Invalid Date Goal",
        "start_date": "2026-12-31",
        "target_date": "2026-01-01"  # Target before start!
    }
    response = client.post("/goals", json=invalid_goal, headers=headers)
    assert response.status_code in [400, 422]
    error_text = response.text.lower()
    assert "earlier than start_date" in error_text or "cannot be before" in error_text


# 7. Test Journal Semantic Vector Search (with Auth)
def test_journal_semantic_search():
    headers = get_auth_headers()
    # Ingest a journal entry first for this user so search has data
    client.post("/journal/", json={
        "title": "OAuth Bug Fix Note",
        "content": "Today was a productive sprint day. I fixed the OAuth bug with PyJWT decode."
    }, headers=headers)

    response = client.get("/journal/search?q=OAuth bug fix&limit=2", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "OAuth bug fix"
    assert "results" in data
    assert len(data["results"]) >= 1

    top_result = data["results"][0]
    assert "similarity" in top_result
    assert "distance" in top_result
    assert "content" in top_result

    # Test empty query validation (should reject whitespace)
    empty_res = client.get("/journal/search?q=   ", headers=headers)
    assert empty_res.status_code in [400, 422]


# 8. Test Journal RAG Question Answering Endpoint (with Auth)
def test_journal_rag_ask():
    headers = get_auth_headers()
    # Ingest an entry first
    client.post("/journal/", json={
        "title": "Sprint Note",
        "content": "Fixed the OAuth bug in the sprint."
    }, headers=headers)

    payload = {"question": "What bug was fixed in the sprint?"}
    response = client.post("/journal/ask", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["question"] == payload["question"]
    assert "answer" in data
    assert len(data["answer"]) > 5
    assert "sources" in data

    # Empty question validation
    bad_response = client.post("/journal/ask", json={"question": "   "}, headers=headers)
    assert bad_response.status_code in [400, 422]


# 9. Phase A Test: Unauthenticated Requests Return 401 Unauthorized
def test_unauthenticated_requests_return_401():
    # Attempting to access protected resources without Authorization header
    assert client.get("/tasks").status_code == 401
    assert client.post("/tasks", json={"title": "Hack", "priority_level": "high"}).status_code == 401
    assert client.get("/habits").status_code == 401
    assert client.post("/habits", json={"name": "Hack", "frequency_type": "daily"}).status_code == 401
    assert client.get("/goals").status_code == 401
    assert client.get("/journal/search?q=secret").status_code == 401
    assert client.post("/journal/ask", json={"question": "test"}).status_code == 401


# 10. Phase A Test: User Data Isolation (Second user cannot see first user's data)
def test_user_data_isolation():
    # User A creates a task
    headers_a = get_auth_headers()
    create_res = client.post(
        "/tasks",
        json={"title": "User A Top Secret Task", "priority_level": "high"},
        headers=headers_a
    )
    assert create_res.status_code == 201
    task_a_id = create_res.json()["id"]

    # User B logs in
    headers_b = get_auth_headers()

    # User B lists tasks - User A's task MUST NOT be returned
    tasks_b = client.get("/tasks", headers=headers_b).json()
    task_ids_b = [t["id"] for t in tasks_b]
    assert task_a_id not in task_ids_b

    # User B attempts to read User A's task directly by ID -> 404 Not Found
    get_direct = client.get(f"/tasks/{task_a_id}", headers=headers_b)
    assert get_direct.status_code == 404

    # User B attempts to update User A's task -> 404 Not Found
    patch_direct = client.patch(f"/tasks/{task_a_id}", json={"title": "Hacked Title"}, headers=headers_b)
    assert patch_direct.status_code == 404

    # User B attempts to delete User A's task -> 404 Not Found
    delete_direct = client.delete(f"/tasks/{task_a_id}", headers=headers_b)
    assert delete_direct.status_code == 404
