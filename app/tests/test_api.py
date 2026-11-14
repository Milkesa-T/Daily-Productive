import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

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

# 5. Test Task Creation & Retrieval
def test_create_and_get_task():
    task_payload = {
        "title": "Automated Test Task",
        "description": "Testing FastAPI Task CRUD",
        "priority_level": "high",
        "category": "Testing"
    }
    create_res = client.post("/tasks", json=task_payload)
    assert create_res.status_code == 201
    task_data = create_res.json()
    assert task_data["title"] == "Automated Test Task"
    task_id = task_data["id"]

    # Verify retrieval by ID
    get_res = client.get(f"/tasks/{task_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == task_id

# 6. Test Goal Relational Date Range Validation (Business Rule)
def test_goal_invalid_date_range():
    invalid_goal = {
        "title": "Invalid Date Goal",
        "start_date": "2026-12-31",
        "target_date": "2026-01-01"  # Target before start!
    }
    response = client.post("/goals", json=invalid_goal)
    # Pydantic schema-level validation returns 422 Unprocessable Entity
    assert response.status_code in [400, 422]
    error_text = response.text.lower()
    assert "earlier than start_date" in error_text or "cannot be before" in error_text


# 7. Test Journal Semantic Vector Search
def test_journal_semantic_search():
    # Test valid semantic query
    response = client.get("/journal/search?q=OAuth bug fix&limit=2")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "OAuth bug fix"
    assert "results" in data
    assert len(data["results"]) >= 1

    top_result = data["results"][0]
    assert "similarity" in top_result
    assert "distance" in top_result
    assert "content" in top_result
    assert top_result["similarity"] > 0.4

    # Test empty query validation (should reject whitespace)
    empty_res = client.get("/journal/search?q=   ")
    assert empty_res.status_code in [400, 422]

