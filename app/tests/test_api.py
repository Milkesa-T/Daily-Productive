import pytest
import uuid
from datetime import datetime, date, timedelta
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
    client.post("/journal", json={
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
    client.post("/journal", json={
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
    assert client.get("/categories").status_code == 401
    assert client.get("/reminders").status_code == 401
    assert client.get("/dashboard/summary").status_code == 401
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


# 11. Phase B Test: Tasks Linked to Goals with Dynamic Progress
def test_link_task_to_goal_updates_goal_progress():
    headers = get_auth_headers()

    # Create Goal
    goal_res = client.post("/goals", json={"title": "Ship Phase B"}, headers=headers)
    assert goal_res.status_code == 201
    goal_id = goal_res.json()["id"]

    # Create 2 Tasks linked to goal
    t1 = client.post("/tasks", json={
        "title": "Subtask 1",
        "priority_level": "medium",
        "goal_id": goal_id,
        "is_completed": False
    }, headers=headers).json()

    t2 = client.post("/tasks", json={
        "title": "Subtask 2",
        "priority_level": "high",
        "goal_id": goal_id,
        "is_completed": False
    }, headers=headers).json()

    # Check goal progress: 0/2 completed -> 0%
    goal_check = client.get(f"/goals/{goal_id}", headers=headers).json()
    assert goal_check["total_tasks"] == 2
    assert goal_check["completed_tasks"] == 0
    assert goal_check["progress_percentage"] == 0.0

    # Mark 1 task completed
    client.patch(f"/tasks/{t1['id']}", json={"is_completed": True}, headers=headers)

    # Check goal progress: 1/2 completed -> 50%
    goal_check = client.get(f"/goals/{goal_id}", headers=headers).json()
    assert goal_check["completed_tasks"] == 1
    assert goal_check["progress_percentage"] == 50.0

    # Mark 2nd task completed
    client.patch(f"/tasks/{t2['id']}", json={"is_completed": True}, headers=headers)

    # Check goal progress: 2/2 completed -> 100%
    goal_check = client.get(f"/goals/{goal_id}", headers=headers).json()
    assert goal_check["completed_tasks"] == 2
    assert goal_check["progress_percentage"] == 100.0


# 12. Phase B Test: Categories CRUD and Task Category Association
def test_category_crud_and_task_link():
    headers = get_auth_headers()

    # Create Category
    cat_res = client.post("/categories", json={"name": "Health", "color": "#10B981"}, headers=headers)
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]
    assert cat_res.json()["name"] == "Health"

    # Reject duplicate category name for same user
    dup_res = client.post("/categories", json={"name": "Health"}, headers=headers)
    assert dup_res.status_code == 400

    # Link Task to Category
    task_res = client.post("/tasks", json={
        "title": "Drink 2L Water",
        "priority_level": "medium",
        "category_id": cat_id
    }, headers=headers)
    assert task_res.status_code == 201
    assert task_res.json()["category_id"] == cat_id

    # List categories
    cats = client.get("/categories", headers=headers).json()
    assert any(c["id"] == cat_id for c in cats)


# 13. Phase B Test: Habit Completion History and Dynamic Streaks
def test_habit_completion_toggle_and_dynamic_streaks():
    headers = get_auth_headers()

    # Create Habit
    h_res = client.post("/habits", json={
        "name": "Evening Walk",
        "frequency_type": "daily",
        "target_count": 1
    }, headers=headers)
    assert h_res.status_code == 201
    habit_id = h_res.json()["id"]
    assert h_res.json()["completed_today"] is False
    assert h_res.json()["current_streak"] == 0

    # Toggle today on
    toggle_on = client.post(f"/habits/{habit_id}/toggle-today", headers=headers)
    assert toggle_on.status_code == 200
    data = toggle_on.json()
    assert data["completed_today"] is True
    assert data["current_streak"] == 1
    assert data["longest_streak"] == 1

    # Check Habit detail
    h_detail = client.get(f"/habits/{habit_id}", headers=headers).json()
    assert h_detail["completed_today"] is True
    assert h_detail["current_streak"] == 1

    # History contains today's date
    hist = client.get(f"/habits/{habit_id}/history", headers=headers).json()
    assert len(hist) == 1
    assert hist[0] == date.today().isoformat()

    # Toggle today off
    toggle_off = client.post(f"/habits/{habit_id}/toggle-today", headers=headers)
    assert toggle_off.status_code == 200
    data_off = toggle_off.json()
    assert data_off["completed_today"] is False
    assert data_off["current_streak"] == 0


# 14. Phase B Test: Reminders Full CRUD & Recurrence
def test_reminders_crud():
    headers = get_auth_headers()
    due = (datetime.utcnow() + timedelta(hours=2)).isoformat()

    # Create Reminder
    rem_res = client.post("/reminders", json={
        "title": "Team Standup",
        "description": "Daily sync at 10 AM",
        "due_time": due,
        "recurrence": "daily"
    }, headers=headers)
    assert rem_res.status_code == 201
    rem_data = rem_res.json()
    rem_id = rem_data["id"]
    assert rem_data["recurrence"] == "daily"
    assert rem_data["is_active"] is True

    # Get by ID
    get_res = client.get(f"/reminders/{rem_id}", headers=headers)
    assert get_res.status_code == 200

    # Update
    patch_res = client.patch(f"/reminders/{rem_id}", json={"is_active": False}, headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["is_active"] is False

    # Filter active
    active_rems = client.get("/reminders?is_active=true", headers=headers).json()
    assert all(r["id"] != rem_id for r in active_rems)

    # Delete
    del_res = client.delete(f"/reminders/{rem_id}", headers=headers)
    assert del_res.status_code == 204


# 15. Phase B Test: Journal Full CRUD + Dynamic Re-embedding
def test_journal_full_crud_and_reembedding():
    headers = get_auth_headers()

    # Create Journal
    create_res = client.post("/journal", json={
        "title": "Architectural Design",
        "content": "Designing resilient microservices with event sourcing and CQRS patterns."
    }, headers=headers)
    assert create_res.status_code == 201
    journal_data = create_res.json()
    journal_id = journal_data["id"]
    assert journal_data["title"] == "Architectural Design"

    # List Journals (GET /journal)
    list_res = client.get("/journal", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(j["id"] == journal_id for j in items)

    # Get single Journal by ID (GET /journal/{id})
    single_res = client.get(f"/journal/{journal_id}", headers=headers)
    assert single_res.status_code == 200
    assert "event sourcing" in single_res.json()["content"]

    # Update Journal (PATCH /journal/{id})
    patch_res = client.patch(f"/journal/{journal_id}", json={
        "title": "Architectural Design v2",
        "content": "Updated microservice blueprint using distributed event buses."
    }, headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Architectural Design v2"

    # Delete Journal (DELETE /journal/{id})
    del_res = client.delete(f"/journal/{journal_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify 404 after deletion
    assert client.get(f"/journal/{journal_id}", headers=headers).status_code == 404


# 16. Phase B Test: Dashboard Summary Consolidated Endpoint
def test_dashboard_summary():
    headers = get_auth_headers()

    # Create sample task, habit, and goal
    client.post("/tasks", json={
        "title": "Dashboard Test Task",
        "priority_level": "medium",
        "due_date": datetime.utcnow().isoformat(),
        "is_completed": True
    }, headers=headers)

    client.post("/habits", json={
        "name": "Dashboard Habit",
        "frequency_type": "daily",
        "target_count": 1
    }, headers=headers)

    client.post("/goals", json={
        "title": "Dashboard Goal"
    }, headers=headers)

    # Call summary endpoint
    res = client.get("/dashboard/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "today" in data
    assert "tasks" in data
    assert "habits" in data
    assert "goals" in data
    assert "weekly_completion_rate" in data

    assert data["tasks"]["completed_today"] >= 1
    assert data["habits"]["total_habits"] >= 1
    assert len(data["goals"]) >= 1

# 17. Phase C Test: Reminder Calendar Sync Callback & GCal Event ID Persistence
def test_reminder_calendar_event_id_persistence():
    headers = get_auth_headers()
    due = (datetime.utcnow() + timedelta(days=1)).isoformat()

    # Create Reminder
    rem = client.post("/reminders", json={
        "title": "Sync to Google Calendar",
        "due_time": due,
        "recurrence": "weekly"
    }, headers=headers).json()
    rem_id = rem["id"]
    assert rem["gcal_event_id"] is None

    # Simulate n8n callback updating gcal_event_id
    simulated_event_id = f"gcal_{uuid.uuid4().hex[:12]}"
    patch_res = client.patch(f"/reminders/{rem_id}", json={
        "gcal_event_id": simulated_event_id
    }, headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["gcal_event_id"] == simulated_event_id

    # Verify persistent state
    fetched = client.get(f"/reminders/{rem_id}", headers=headers).json()
    assert fetched["gcal_event_id"] == simulated_event_id


# 18. Phase C Test: GitHub Repositories & Commits Ingestion and User Isolation
def test_github_repos_and_commits_sync():
    headers = get_auth_headers()
    repo_name = f"test-repo-{uuid.uuid4().hex[:6]}"
    full_name = f"octocat/{repo_name}"

    # 1. Register repository
    repo_res = client.post("/github/repos", json={
        "name": repo_name,
        "full_name": full_name,
        "url": f"https://github.com/{full_name}"
    }, headers=headers)
    assert repo_res.status_code == 201
    repo_data = repo_res.json()
    repo_id = repo_data["id"]
    assert repo_data["full_name"] == full_name

    # 2. Ingest batch of commits
    commits_payload = {
        "repository_full_name": full_name,
        "commits": [
            {
                "commit_hash": "a1b2c3d4e5f678901234567890abcdef12345678",
                "message": "feat: initial commit",
                "author_name": "Octocat",
                "committed_at": datetime.utcnow().isoformat(),
                "url": f"https://github.com/{full_name}/commit/a1b2c3d"
            },
            {
                "commit_hash": "b2c3d4e5f678901234567890abcdef1234567890",
                "message": "fix: resolve memory leak",
                "author_name": "Octocat",
                "committed_at": datetime.utcnow().isoformat(),
                "url": f"https://github.com/{full_name}/commit/b2c3d4e"
            }
        ]
    }
    commits_res = client.post("/github/commits", json=commits_payload, headers=headers)
    assert commits_res.status_code == 201
    commits = commits_res.json()
    assert len(commits) == 2

    # 3. List commits for user
    list_commits = client.get(f"/github/commits?repo_id={repo_id}", headers=headers).json()
    assert len(list_commits) == 2
    hashes = [c["commit_hash"] for c in list_commits]
    assert "a1b2c3d4e5f678901234567890abcdef12345678" in hashes

    # 4. Idempotent re-ingestion does not duplicate rows
    re_ingest = client.post("/github/commits", json=commits_payload, headers=headers)
    assert re_ingest.status_code == 201
    after_reingest = client.get(f"/github/commits?repo_id={repo_id}", headers=headers).json()
    assert len(after_reingest) == 2
