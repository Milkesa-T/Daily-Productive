# Daily-Productive

> A full-stack, AI-augmented personal productivity platform combining **FastAPI**, **PostgreSQL + pgvector**, **n8n automation workflows**, **Next.js 15 App Router**, and **Retrieval-Augmented Generation (RAG)** powered by Google Gemini.

---

## 🌟 Overview & Key Features

Daily-Productive was built from scratch over an intensive 3-week engineering sprint, combining modern API design, event-driven workflow automation, and production-grade vector AI.

- **Task & Habit Management**: Full CRUD on tasks (priorities, categories, due dates) and habit tracking with daily streaks.
- **Bi-directional Google Calendar Sync**: Background tasks in FastAPI dispatch webhooks to self-hosted n8n, synchronizing reminders to Google Calendar and saving remote event IDs back to the database.
- **Automated GitHub Activity Ingestion**: Periodic n8n polling automatically logs recent Git commit activity into completed task entries.
- **Automated Morning Executive Briefing**: Daily scheduled 8:00 AM cron workflow aggregates pending tasks and habit streaks into a markdown digest.
- **pgvector Semantic Search & Journal Ingestion**: Splits developer reflections into word-boundary sliding chunks, embeds them into 768-dimensional dense vectors with `gemini-embedding-001`, and persists them to Supabase PostgreSQL.
- **Grounded AI Productivity Chatbot**: RAG conversational interface (`POST /journal/ask` and Next.js `/chat` page) with strict hallucination-resistant prompting (`temperature=0.2`) and source citations.
- **Interactive Next.js 15 Dashboard**: Modern responsive UI built with Tailwind CSS, App Router, client-side JWT persistence, and optimistic state updates.

---

## 🏗️ Architecture

```
               +----------------------------------------------------+
               |              Next.js 15 Frontend                   |
               |     (/dashboard, /chat, /login - App Router)       |
               +-------------------------+--------------------------+
                                         |  REST API / JWT
                                         v
               +----------------------------------------------------+
               |                 FastAPI Backend                    |
               |  - Auth & JWT validation                           |
               |  - Task, Habit, Goal CRUD                          |
               |  - pgvector Cosine Distance Search (<=>)           |
               |  - RAG Generation Service (Gemini Flash)           |
               |  - BackgroundTasks Webhook Dispatcher              |
               +-------------+----------------------+---------------+
                             |                      |
             SQLAlchemy DSN  |                      |  HTTP Webhook
                             v                      v
        +----------------------------+   +----------------------------+
        |   Supabase PostgreSQL      |   |       n8n Automation       |
        |  - tasks, habits, goals    |   |  - Route 0: GCal Create    |
        |  - users (bcrypt hashed)   |   |  - Route 1: GCal Update    |
        |  - journal_entries         |   |  - Route 2: GCal Delete    |
        |    (768-dim Vector column) |   |  - GitHub Commit Ingestion |
        +----------------------------+   |  - 8:00 AM Daily Digest    |
                                         +----------------------------+
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|:---|:---|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, Turbopack / Webpack |
| **Backend** | Python 3.13, FastAPI, Pydantic v2, Uvicorn, httpx, bcrypt, PyJWT |
| **Database & ORM** | PostgreSQL (Supabase), SQLAlchemy 2.0, Alembic Migrations, pgvector |
| **AI & Embeddings** | Google Gemini (`gemini-embedding-001`, `gemini-flash-lite-latest`), `google-genai` SDK |
| **Automation** | Self-hosted n8n (Global npm), Google Calendar API, GitHub REST API |
| **Testing** | pytest, pytest-asyncio, FastAPI TestClient (8 tests, 100% pass) |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python 3.11+** (Tested on 3.13.12)
- **Node.js 18+** & npm
- **PostgreSQL** database with `vector` extension (e.g. Supabase)
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/Milkesa-T/Daily-Productive.git
cd Daily-Productive

# Create & activate a virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET_KEY, and GEMINI_API_KEY

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
Interactive API docs will be available at **http://127.0.0.1:8000/docs**.

### 3. Frontend Setup
```bash
cd frontend

# Install packages
npm install

# Start Next.js development server
npm run dev
```
Open **http://localhost:3000** to access the login page, dashboard, and AI chatbot.

### 4. Running Automations (n8n)
```bash
# Install n8n globally
npm install -g n8n

# Start n8n engine
n8n
```
Access the n8n canvas at **http://localhost:5678**. Import the workflow JSONs to enable Google Calendar synchronization, GitHub polling, and scheduled morning digests.

---

## 📡 API Endpoint Reference

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/health` | System health check and uptime status |
| `POST` | `/auth/register` | Register a new user with bcrypt password hashing |
| `POST` | `/auth/login` | Authenticate with OAuth2 password grant and obtain JWT |
| `GET` | `/tasks` | List all tasks |
| `POST` | `/tasks` | Create task (triggers n8n Google Calendar sync if due date is set) |
| `PATCH` | `/tasks/{id}` | Update task (triggers GCal update if reminder_id is present) |
| `DELETE` | `/tasks/{id}` | Delete task (triggers GCal event cancellation) |
| `GET` | `/habits` | List all habits with current streaks |
| `POST` | `/habits` | Create a new habit |
| `PATCH` | `/habits/{id}` | Increment streak or update habit details |
| `DELETE` | `/habits/{id}` | Delete a habit |
| `POST` | `/journal/` | Ingest journal text (auto-chunks into 300 chars, embeds with Gemini, saves to pgvector) |
| `GET` | `/journal/search` | Semantic similarity search using pgvector `<=>` cosine distance |
| `POST` | `/journal/ask` | Grounded RAG question answering citing retrieved journal excerpts |

---

## 🧪 Testing & Evaluation

### Pytest Integration Suite
Run the automated test suite verifying auth, CRUD, validation business rules, and RAG endpoints:
```bash
pytest
```
*Result: 8 passed in ~17s (100% pass rate).*

### RAG Benchmark Evaluation
Run the 10-question evaluation benchmark measuring retrieval faithfulness and zero-hallucination refusal:
```bash
python scripts/evaluate_rag.py
```
*Result: 10/10 Passed (100.0%) — 5 in-domain questions answered accurately with citations; 5 out-of-domain questions refused safely with zero hallucination.*

---

## 📄 License
MIT License. Built as part of the 3-Week AI-Automation Engineering Sprint.
