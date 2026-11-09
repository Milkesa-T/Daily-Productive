# 3-Week Learning Sprint: Daily-Productive

Personal productivity platform built from scratch: FastAPI, PostgreSQL (Supabase) + pgvector, n8n, Next.js, and RAG.

---

## Sprint Progress Tracker

| Day | Task | Deliverable | Status | Planned hrs | Actual hrs | Notes / What I Learned |
|:---:|:---|:---|:---:|:---:|:---:|:---|
| **D1** | Python typing + Pydantic models for Task, Habit, Goal | Pydantic schemas validating models with custom validators | Done | 2.5 - 3.0 | ~3.5 | Pydantic v2 field_validator vs model_validator; Base/Create/Update/Response pattern; from_attributes=True for ORM; inverted validator bug; why schema separation is a security boundary not just style |
| **D2** | Routers and project structure, `/health` endpoint | Modular FastAPI app structure with working `/health` route | Done | 2.5 - 3.0 | ~2.5 | APIRouter modular routing; app factory pattern; Pydantic BaseSettings for .env management; OpenAPI/Swagger auto-generation; ISO-8601 formatting |
| **D3** | Postgres (Supabase) + SQLAlchemy models | Database connection engine, session factory, ORM models | Done | 2.5 - 3.0 | ~3.0 | SQLAlchemy engine vs SessionLocal lifecycle; declarative Base; ORM vs Pydantic separation; Supabase IPv6 vs IPv4 connection pooler routing; percent-encoding credentials in DSNs |
| **D4** | Alembic migrations | Alembic configured, initial migration generated & executed | Done | 2.5 - 3.0 | ~2.0 | Schema versioning; autogenerate diffing mechanism; dynamic DB URL injection in env.py; alembic_version stamp table; why create_all() is insufficient for production schema evolution |
| **D5** | CRUD for tasks and habits | Working endpoints with status codes, db dependency injection | Done | 2.5 - 3.0 | ~2.5 | FastAPI Depends(get_db) session lifecycle; REST HTTP status codes (201, 204, 404); Pydantic model_dump(exclude_unset=True) for PATCH; db.refresh() for ORM synchronization |
| **D6** | CRUD for goals + validation and error handling | Goals CRUD, custom HTTP exceptions, relational validation | Done | 2.5 - 3.0 | ~2.5 | Custom HTTPException subclasses (EntityNotFoundException, BusinessRuleViolationException); cross-field partial update merge validation; router mounting and tag isolation |
| **D7** | JWT auth + pytest tests (5+ passing) | User registration/login, password hashing, 5+ passing tests | Done | 2.5 - 3.0 | ~3.0 | bcrypt salting & hashing; PyJWT HS256 stateless tokens; OAuth2PasswordBearer dependency; Pytest TestClient integration suite with 6 passing tests |
| **D8** | n8n setup, basics, first webhook workflow | Running n8n instance + test webhook receiver workflow | Done | 2.5 - 3.0 | ~2.5 | Self-hosted n8n installation on Windows; npx cache lock (EBUSY/EPERM) vs global npm install; webhook triggers, Set/Respond nodes; test vs production webhook lifecycle (/webhook-test vs /webhook) |
| **D9** | FastAPI to Google Calendar reminder sync | Outgoing webhook trigger on reminder create -> Google Calendar | Done | 2.5 - 3.0 | ~2.5 | FastAPI BackgroundTasks async webhook dispatch; httpx client with timeouts and exception handling; Google Cloud OAuth2 consent & credentials setup; Google Calendar node event mapping in n8n |
| **D10** | Store event IDs, handle update and delete | Sync updates and deletions bidirectional or event ID mapping | Done | 2.5 - 3.0 | ~2.5 | Two-way webhook synchronization; n8n Switch router node (task_created, task_updated, task_deleted); HTTP Request node callback storing Google event_id in reminder_id; Node.js IPv6 (::1) ECONNREFUSED vs 127.0.0.1 loopback |
| **D11** | GitHub sync workflow into the database | n8n polling GitHub activity into Supabase | Not started | 2.5 - 3.0 | - | - |
| **D12** | Scheduled daily digest | Cron-based n8n workflow aggregating tasks/habits into digest | Not started | 2.5 - 3.0 | - | - |
| **D13** | Next.js setup, routing, login screen | Clean Next.js project with App Router, auth state & login page | Not started | 2.5 - 3.0 | - | - |
| **D14** | Task and habit lists, forms, simple dashboard | Interactive UI fetching and mutating tasks and habits | Not started | 2.5 - 3.0 | - | - |
| **D15** | Embeddings and chunking concepts | Embedding generator script experimenting with chunk sizes | Not started | 2.5 - 3.0 | - | - |
| **D16** | pgvector table + ingest journal entries | Journal table with vector column + ingestion script | Not started | 2.5 - 3.0 | - | - |
| **D17** | Retrieval endpoint | Similarity search endpoint using vector distance operators | Not started | 2.5 - 3.0 | - | - |
| **D18** | Prompting + evaluate answer quality | RAG augmented prompt + 10-question evaluation benchmark | Not started | 2.5 - 3.0 | - | - |
| **D19** | Chat box in Next.js | Conversational UI communicating with RAG endpoint | Not started | 2.5 - 3.0 | - | - |
| **D20** | Cleanup, README, bug fixes | Clean repository, environment setup guide, bug fixes | Not started | 2.5 - 3.0 | - | - |
| **D21** | Deploy (if time) + retrospective | Live or packaged deployment + sprint retrospective | Not started | 2.5 - 3.0 | - | - |
