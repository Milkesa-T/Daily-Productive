# Learning Log

Use this file to record what you learned each day, key mental models, architectural insights, and what confused or challenged you.

---

## Template for Daily Entries

### Day X: [Topic]
- **Key Concepts Learned:**
- **Behind the Scenes / Under the Hood Insights:**
- **What Confused Me / Obstacles Overcome:**
- **Questions for Mentor:**

---

## Day 1: Python Typing + Pydantic v2 Schemas

### Key Concepts Learned
- Python type hints are metadata only — the interpreter ignores them at runtime. Pydantic is what enforces them.
- Pydantic v2 uses a Rust-powered core (`pydantic-core`) for fast runtime parsing, coercion, and validation.
- The **Base / Create / Update / Response** pattern: each schema has a distinct job and responsibility.
- `@field_validator` runs on a single field in isolation; `@model_validator(mode="after")` runs after all fields are parsed and gives access to the full `self` object — needed for cross-field logic like date range checks.
- `Field(ge=1, le=100)` enforces numeric bounds at the Rust layer before any Python validator runs.
- `ConfigDict(from_attributes=True)` tells Pydantic to read attributes via `getattr()` instead of dictionary keys — critical for SQLAlchemy ORM integration later.

### Behind the Scenes / Architecture Insights
- Schema separation is not just style — it's a **security boundary**. If one model handled everything, a user could POST `id` or `created_at` and try to overwrite server-controlled fields.
- `Update` schemas make all fields `Optional` to support **partial PATCH** updates — only send what changed.
- `from_attributes=True` only goes on `Response` schemas, not `Create` or `Update`, because only responses read from ORM objects.

### What Confused / Mistakes Made
- Inverted validator logic: `if not value or value.strip()` rejects valid inputs. The correct pattern is `if not value or not value.strip()`.
- `HabitBase` was accidentally nested *inside* `TaskResponse` due to wrong indentation — in Python, indentation defines scope entirely.
- `0.0-100` in Python is arithmetic (evaluates to `-100.0`), not a range declaration. Ranges require `Field(ge=0.0, le=100.0)`.
- Accidentally imported `passlib`, `FastAPI`, and `unicodedata` in a schema file — schemas are pure data contracts and should not import web framework or utility libraries.

---

## Day 2: Routers and Project Structure + `/health` Endpoint

### Key Concepts Learned
- **Modular Routing (`APIRouter`)**: Splitting endpoints into domain-specific routers (`app/routers/`) prevents the main application file from becoming a monolithic mess and allows independent prefixing and tagging.
- **Application Factory Pattern**: `FastAPI()` instantiated centrally in `app/main.py` serves as the central orchestrator where routers, middleware, and exception handlers are plugged in via `app.include_router()`.
- **Environment Management (`pydantic-settings`)**: `BaseSettings` automatically reads environment variables and `.env` files into strongly-typed attributes at runtime.
- **Auto-generated Documentation**: FastAPI inspects route decorators, response schemas, and type annotations to automatically build and serve OpenAPI 3.1 specifications (`/openapi.json`) and interactive Swagger UI (`/docs`).

### Behind the Scenes / Architecture Insights
- `APIRouter` does not create a web server; it registers route definitions that are only mounted when `app.include_router(...)` is invoked.
- `.env` files must live at the **project working directory** from where `uvicorn` is executed, not inside subpackages like `app/.env`.

### What Confused / Mistakes Made
- Typo in method invocation: `app.includ_router` instead of `app.include_router`.
- Syntax error in dict return: key-value pairs missing colons/commas, and variable interpolation accidentally placed inside string literals.
- Naming of Python package initialization: created `___init__.py` (3 underscores) which Python did not recognize as a package module until fixed to `__init__.py`.
- Misspelled datetime formatting method: `isformat()` instead of standard `isoformat()`.

---

## Day 3: Postgres (Supabase) + SQLAlchemy Models

### Key Concepts Learned
- **ORM vs Schemas**: SQLAlchemy models (`app/models/models.py`) represent relational database tables and persist state to disk; Pydantic models (`app/schemas/schema.py`) validate, parse, and serialize in-flight HTTP JSON data.
- **Engine vs Session**:
  - `create_engine`: Maintains a pool of physical database socket connections.
  - `sessionmaker` / `SessionLocal`: Factory creating short-lived, transaction-scoped sessions for individual HTTP request lifecycles.
  - Dependency generator `get_db()` with `yield` ensures database connections are cleanly closed via `finally: db.close()`.
- **Declarative Base**: `Base = declarative_base()` registers all subclasses (Task, Habit, Goal) to a shared metadata registry (`Base.metadata`).

### Behind the Scenes / Architecture Insights
- **Supabase Networking (IPv6 vs IPv4)**:
  - Supabase's direct database hostname (`db.<project-ref>.supabase.co`) resolves to an IPv6-only address.
  - Machines or ISP networks lacking native IPv6 fail with `could not translate host name ... to address: Name or service not known`.
  - The solution is routing through the Supabase Connection Pooler (`aws-X-region.pooler.supabase.com:5432`) which provides dual-stack IPv4/IPv6 support.
- **URL Percent-Encoding in DSNs**: Passwords with special characters (e.g. `&`, `@`, `#`) will break URI parser delimiters unless encoded (`&` -> `%26`).

### What Confused / Mistakes Made
- Missing audit fields: `Habit` and `Goal` models initially lacked `created_at` and `updated_at` columns, which would cause runtime serialization errors when mapped to `Response` schemas.
- Foreign import pollution: Accidentally imported `from google.auth import default` into `models.py`.

---

## Day 4: Database Migrations with Alembic

### Key Concepts Learned
- **Database Version Control**: Alembic tracks schema evolutionary history through linear or branching migration scripts inside `alembic/versions/`.
- **Why `create_all()` is insufficient**: `Base.metadata.create_all()` only issues `CREATE TABLE IF NOT EXISTS`. It cannot modify existing column types, add new constrained columns, remove tables, or support downgrades/rollbacks.
- **Autogenerate Mechanism**: Alembic compares Python SQLAlchemy metadata (`target_metadata = Base.metadata`) against the live PostgreSQL catalog and generates differential operations (`op.create_table`, `op.add_column`).
- **Migration Execution**:
  - `alembic revision --autogenerate -m "..."` creates the revision file.
  - `alembic upgrade head` executes unapplied migrations and updates the `alembic_version` state table in Postgres.
  - `alembic current` inspects the active database revision hash.

### Behind the Scenes / Architecture Insights
- Dynamic configuration in `alembic/env.py`: Pulling `settings.database_url` programmatically via `config.set_main_option("sqlalchemy.url", ...)` avoids leaking production credentials into static `alembic.ini` files.
- Empty autogenerate migrations (`pass`): If tables were already created in a previous manual step or via `create_all()`, Alembic detects zero schema delta and produces an empty revision. Running `alembic upgrade head` stamps the database so future changes start from a known baseline.

### What Confused / Mistakes Made
- Seeing an empty `upgrade()` function with only `pass` initially seemed like an error, but it correctly represented that the live Supabase database and models were already in complete parity.

---

## Day 5: CRUD for Tasks and Habits

### Key Concepts Learned
- **FastAPI Dependency Injection (`Depends(get_db)`)**: Using generator functions with `yield` enables automatic request-scoped session management. When the request starts, `SessionLocal()` is yielded to the route handler. When the response is dispatched or if an exception is raised, execution continues to the `finally` block to execute `db.close()`, preventing connection leaks.
- **RESTful HTTP Status Codes**:
  - `201 CREATED` for resource creation (`POST`).
  - `200 OK` for retrievals (`GET`) and mutations (`PATCH`).
  - `204 NO CONTENT` for successful deletion (`DELETE`), which strictly returns an empty response body.
  - `404 NOT FOUND` via `HTTPException` when target primary keys do not exist in the database.
- **Partial Updates with `exclude_unset=True`**: `task_in.model_dump(exclude_unset=True)` filters out all fields that the client did not explicitly pass in the HTTP payload. This allows updating only targeted columns via `setattr(db_record, key, value)` without accidentally overwriting unmentioned fields with `None`.
- **ORM Refresh**: Calling `db.refresh(orm_obj)` re-queries the database after `db.commit()` to populate autogenerated fields (like `id`, `created_at`, `updated_at`) before serializing through `response_model`.

### Behind the Scenes / Architecture Insights
- **Decoupled Architecture**: Routes only interact with Pydantic schemas for boundary input/output and SQLAlchemy models for relational persistence. Business validation stays in Pydantic, persistence logic stays in SQLAlchemy, and routing stays in `APIRouter`.
- **Router Mounting Order**: Merely defining and importing routers (`from app.routers import tasks, habits`) is insufficient until they are explicitly attached to the top-level ASGI application via `app.include_router()`.

### What Confused / Mistakes Made
- Routers were initially imported into `app/main.py` but not registered with `app.include_router(...)`. They did not appear in `/docs` until mounted.
- Understanding why `exclude_unset=True` is critical: without it, Pydantic defaults optional unprovided attributes to `None`, which would overwrite existing database values during partial updates.

---

## Day 6: CRUD for Goals + Validation and Error Handling

### Key Concepts Learned
- **Centralized Custom Exceptions**: Subclassing `HTTPException` into domain-specific exceptions like `EntityNotFoundException(entity_name, entity_id)` and `BusinessRuleViolationException(detail)` provides standardized HTTP status codes (`404` and `400`) and uniform error response structures across the codebase without redundant boilerplate.
- **Cross-Field Partial Update Validation**:
  - In a `PATCH` request, clients typically submit only a subset of fields (e.g. updating `start_date` alone).
  - Pydantic schema-level `@model_validator` cannot reliably validate relational or temporal constraints against existing state because it only has access to payload fields.
  - Solving this requires merging the incoming update payload with existing persisted database values:
    ```python
    merged_start = update_data.get("start_date", db_goal.start_date)
    merged_target = update_data.get("target_date", db_goal.target_date)
    validate_goal_dates(merged_start, merged_target)
    ```
    This guarantees that partial updates can never leave the database in an invalid state where `target_date < start_date`.
- **Clean RESTful API Organization**: Mounting `goals.router` alongside `health`, `tasks`, and `habits` under distinct OpenAPI tags provides structured, self-documenting interactive documentation in Swagger UI (`/docs`).

### Behind the Scenes / Architecture Insights
- **Domain Invariants**: Business rules (like date integrity) belong at both the gateway boundary (Pydantic schemas for initial creation) and the service/router boundary (for mutations against existing state).
- Subclassing `HTTPException` allows FastAPI to catch exceptions naturally through its built-in exception handler pipeline without requiring custom middleware unless customized JSON schemas are demanded.

### What Confused / Mistakes Made
- Python casing convention: `sqlalchemy.orm.session` is a module, whereas `Session` (capitalized) is the class type used for type annotations. While Python's type annotations do not strictly enforce runtime instantiation types, adhering to `Session` avoids linter warnings and IDE confusion.

---

## Day 7: JWT Authentication + Automated Pytest Suite

### Key Concepts Learned
- **Bcrypt Password Salting & Hashing**:
  - Direct `bcrypt` usage (`hashpw`, `checkpw`, `gensalt`) replaces deprecated/broken packages like `passlib` on Python 3.13.
  - Converting strings to UTF-8 encoded bytes (`password.encode('utf-8')`) is mandatory before cryptographic hashing.
  - Salt generation ensures identical plaintext passwords produce entirely distinct hashes, defeating Rainbow Table attacks.
- **Stateless Authentication with PyJWT**:
  - `create_access_token`: Generates signed `HS256` tokens containing expiration timestamps (`exp`) and identity claims (`sub`).
  - Signed tokens eliminate the need for server-side session caches or Redis for basic identity verification.
- **FastAPI OAuth2 Bearer Integration**:
  - `OAuth2PasswordRequestForm`: Parses credentials conforming to OAuth2 specs (`username`, `password`) and powers Swagger UI's interactive **Authorize 🔓** modal.
  - `OAuth2PasswordBearer(tokenUrl=...)`: Extracts the token automatically from `Authorization: Bearer <token>` HTTP headers.
  - `get_current_user`: Dependency that decodes the token, handles signature expiration (`PyJWTError`), queries the database, and injects the authenticated `User` model.
- **Automated Integration Testing with Pytest & TestClient**:
  - `fastapi.testclient.TestClient`: Spins up an in-process ASGI test harness allowing synchronous, blazing-fast HTTP requests against endpoints without running a live network server.
  - `pytest.ini` with `pythonpath = .` ensures consistent module resolution across different operating systems and CI runners.

### Behind the Scenes / Architecture Insights
- **Security Boundaries**: Raw passwords and `hashed_password` must never leak in API output contracts (`UserResponse` explicitly omits credential attributes).
- **Validation HTTP Status Code Nuance**:
  - Schema-level Pydantic errors (e.g. invalid date ranges caught during body parsing) raise `RequestValidationError`, which FastAPI maps to `422 Unprocessable Entity`.
  - Service/route-level business rule checks raise `HTTPException`, mapped to `400 Bad Request`.
  - Tests verify both status possibilities using `assert response.status_code in [400, 422]`.

### What Confused / Mistakes Made
- Python 3.13 incompatibility: `passlib` attempts to inspect `bcrypt.__about__.__version__`, which was removed in recent bcrypt versions, crashing with an `AttributeError`. Solved by using native `bcrypt` functions directly.
- Indentation scope errors:
  - Register logic (`new_user = User(...)`) was initially indented inside `if existing_user:`, causing valid registrations to silently return `None`.
  - Pydantic models `Token` and `TokenData` were accidentally indented inside `UserResponse`.
- Alembic drift: autogenerated migrations must be kept in sync with model column names before applying `alembic upgrade head`.

---

## Day 8: n8n Local Setup + First Production Webhook Workflow

### Key Concepts Learned
- **n8n Architecture & Core Concepts**:
  - Open-source, node-based automation engine connecting trigger events, data transforms, and action targets.
  - Local self-hosted instance operates independently from cloud accounts, storing workflow states and credentials on disk.
- **Node Execution Pipelines**:
  - **Webhook Trigger Node**: Listens on dedicated HTTP endpoints for incoming payloads (GET, POST, etc.) and packages headers, query parameters, and body objects into an n8n JSON item.
  - **Respond to Webhook Node**: Returns customized responses back to the original HTTP client. Setting `Respond With` to `First Incoming Item` cleanly streams pipeline data without string serialization issues.
- **Webhook Lifecycles (Test vs Production)**:
  - **Test Mode (`/webhook-test/<path>`)**: Listens ephemerally for a single incoming HTTP request after clicking *Test workflow*, then automatically unregisters to aid step-by-step debugging. Subsequent calls yield a `404 Not Registered` error until re-triggered.
  - **Production Mode (`/webhook/<path>`)**: Activated once the workflow is **Published**; remains persistently listening and processing real-time incoming traffic.

### Behind the Scenes / Architecture Insights
- **Webhook Decoupling**: By placing n8n in front of external integrations (Google Calendar, GitHub, etc.), our FastAPI backend can simply dispatch lightweight event payloads over HTTP webhooks rather than managing vendor SDKs, OAuth token refreshes, and retry logic directly within Python application code.

### What Confused / Mistakes Made
- **Windows File Locking with `npx` (`EBUSY` / `EPERM`)**: On Windows, `npx n8n` downloads packages to a temporary cache folder (`AppData\Local\npm-cache\_npx`), where active background locks prevent cleanup routines from removing node directories. Overcome by installing n8n globally (`npm install -g n8n`).
- **Response Format Mismatch**: Configuring `Respond With: JSON` while passing stringified expressions like `{{ JSON.stringify($json) }}` creates invalid response bodies. Switching to `First Incoming Item` resolved the payload serialization cleanly.
- **Testing 404 Disorientation**: Believing the webhook was broken after receiving a `404 Not Registered` on subsequent requests; recognized that test mode endpoints auto-expire after exactly 1 call unless published to production.

---

## Day 9: FastAPI Outgoing Webhooks + Google Calendar Automation

### Key Concepts Learned
- **FastAPI `BackgroundTasks`**:
  - Offloads I/O-bound tasks (like external HTTP webhook requests) to execute *after* sending the HTTP response.
  - Keeps API response latency ultra-low (~10-50ms) instead of blocking the client waiting for downstream services.
- **Resilient Webhook Dispatching (`httpx`)**:
  - `httpx.Client(timeout=5.0)` prevents worker thread starvation if n8n is unreachable.
  - Wrapping network calls in `try...except httpx.RequestError` ensures backend core operations (task creation in database) never fail even if automation endpoints are offline.
- **Google Cloud OAuth 2.0 Credentials Pipeline**:
  - Configuring OAuth Consent Screen, scopes, and Test Users whitelist (`milkesataye0450@gmail.com`).
  - Setting Authorized Redirect URIs matching local n8n callback (`http://localhost:5678/rest/oauth2-credential/callback`).
  - Handling unverified developer app warnings safely via Advanced settings.
- **n8n Event Mapping to Google Calendar**:
  - Mapping incoming webhook JSON payload (`body.title`, `body.due_date`, `body.description`) directly into Google Calendar Event Create parameters.
  - Formatting ISO-8601 timestamps and calculating dynamic end times (`new Date(start.getTime() + 60*60*1000)`).

### Behind the Scenes / Architecture Insights
- **Decoupled Architecture Pattern**: FastAPI focuses strictly on data persistence, validation, and business logic. External third-party integrations (OAuth tokens, calendars, notifications) are completely offloaded to n8n.
- **Fail-Safe Webhook Execution**: BackgroundTasks guarantee database commits are isolated from webhook delivery status.

### What Confused / Mistakes Made
- **Google OAuth 403 `access_denied`**: When a Google Cloud project is in Testing mode, unverified accounts cannot sign in unless their exact email is added under the project's **Test users** whitelist.
- **Datetime Serialization in Payloads**: Native Python `datetime` objects cannot be JSON-serialized directly by `httpx` dictionaries. Must call `.isoformat()` prior to payload dispatch.

---

## Day 10: Event ID Storage + Bi-directional Update & Delete Synchronization

### Key Concepts Learned
- **Bi-directional Webhook & Callback Architecture**:
  - FastAPI dispatches `task_created` ➡️ n8n creates Google Calendar event ➡️ n8n captures Google's generated `id` ➡️ n8n calls `PATCH /tasks/{id}` on FastAPI to store Google's event ID inside `task.reminder_id`.
  - Closing the loop enables future operations (modifications and cancellations) to target the exact remote calendar event.
- **Event-Driven Branching with n8n Switch Node**:
  - Routing single webhook intake into 3 separate execution lanes based on `{{ $json.body.event }}`:
    - Route 0 (`task_created`): Google Calendar Create ➡️ HTTP Request callback.
    - Route 1 (`task_updated`): Google Calendar Update targeting `{{ $json.body.reminder_id }}`.
    - Route 2 (`task_deleted`): Google Calendar Delete targeting `{{ $json.body.reminder_id }}`.
- **FastAPI Lifecycle Synchronization**:
  - In `update_task` (PATCH), conditionally dispatching `task_updated` only if `reminder_id` exists and fields affecting calendar events (`title`, `description`, `due_date`) are present in `update_data`.
  - In `delete_task` (DELETE), dispatching `task_deleted` with the target `reminder_id` before deleting the database row.

### Behind the Scenes / Architecture Insights
- **Dual-Protocol Loopback Resolution (`localhost` vs `127.0.0.1`)**:
  - Modern Node.js environments resolve `localhost` to IPv6 `::1` before IPv4 `127.0.0.1`.
  - If a backend service (like Uvicorn) binds explicitly to `127.0.0.1`, HTTP clients using `localhost` will trigger `ECONNREFUSED ::1:<port>`. Explicitly targeting `127.0.0.1` avoids dual-stack resolution mismatches.
- **Upstream Node Scoping in n8n**:
  - In downstream nodes, accessing data from earlier nodes in the chain uses `$('Node Name').first().json` or `$('Node Name').item.json` to extract origin fields (e.g. `task_id` from the initial Webhook).

### What Confused / Mistakes Made
- **`isformat` vs `isoformat`**: Typo calling `.isformat()` on datetime objects caused `AttributeError: 'datetime.datetime' object has no attribute 'isformat'`.
- **IPv6 ECONNREFUSED**: Seeing `connect ECONNREFUSED ::1:8000` in n8n execution error logs; resolved by specifying IPv4 `http://127.0.0.1:8000/tasks/...`.
- **Querying Historical Task IDs**: Testing Task 7 (which was created before the HTTP Request callback node was fixed) still yielded `reminder_id: null`. Querying the newly created Task 9 verified the populated Google event ID immediately.

---

## Day 11: Developer Activity Automation — GitHub Polling to Supabase

### Key Concepts Learned
- **Polling vs Webhook Triggers for Local Development**:
  - Webhooks require the receiver to have a publicly accessible internet address (or a tunnel like ngrok).
  - Polling (using n8n Schedule Trigger) initiates outbound HTTP requests from the local server to external APIs (GitHub REST API), completely bypassing NAT and firewall restrictions without requiring reverse proxies.
- **GitHub REST API v3 Integration**:
  - Authenticating with Personal Access Tokens (PATs) using `Authorization: Bearer ghp_...` and identifying clients via `User-Agent`.
  - Fetching commits with pagination query parameters (`?per_page=3`) to prevent flooding downstream databases with historical git trees.
- **Data Transformation & Array Splitting in n8n**:
  - When an HTTP node receives a JSON list (an array of commit objects), n8n automatically splits the array into individual execution items.
  - Downstream nodes (like the FastAPI `POST /tasks` HTTP Request) run sequentially for every commit, extracting first-line commit messages (`$json.commit.message.split('\n')[0]`), commit authors, and direct web URLs (`$json.html_url`).

### Behind the Scenes / Architecture Insights
- **Unified Domain Model**: Instead of building separate database tables and custom schemas for git commits, Jira tickets, and external feeds, mapping developer activities directly into completed `tasks` (`category: "Development"`, `is_completed: true`) provides a unified timeline and productivity dashboard.
- **API Boundary Re-use**: Ingesting third-party data through FastAPI's own REST API (`POST /tasks`) ensures all validation rules, timestamps, and ORM triggers are consistently applied, rather than bypassing business logic with direct SQL inserts.

### What Confused / Mistakes Made
- **n8n Action Categorization**: Searching for "commits" inside n8n's built-in GitHub node showed only issue, PR, and file actions. Solved cleanly by utilizing a direct `HTTP Request` node to `api.github.com/repos/.../commits`, granting complete control over query parameters and pagination.

---

## Day 12: Scheduled Daily Productivity Digest Aggregator

### Key Concepts Learned
- **Cron-Based Scheduling in n8n**:
  - The `Schedule Trigger` operates independently of incoming external webhooks, firing on recurring wall-clock timestamps (e.g. daily at 08:00 AM) to initiate scheduled batch jobs.
- **Cross-Domain Data Aggregation**:
  - Fetching disparate entities (`/tasks` and `/habits`) from the FastAPI REST API and passing them to an in-memory transformation step.
- **n8n JavaScript Code Node Pipelines**:
  - Utilizing `$('Node Name').all().map(item => item.json)` to gather datasets from upstream nodes.
  - Applying array filters to isolate business-critical metrics (e.g. pending tasks, high-priority items with due dates, habit current streaks).
  - Formatting dynamic Markdown executive briefings ready for delivery over chat, email, or logging.

### Behind the Scenes / Architecture Insights
- **The Empty-Array Pipeline Halt Gotcha**:
  - By default in n8n, when an API node returns an empty array `[]` (0 items), n8n assumes there is no payload to iterate over and halts execution of downstream nodes with the warning: *"The execution took a different path and didn't reach this node"*.
  - Enabling **"Always Output Data"** in the node's **Settings** tab forces n8n to output a default object (`[{}]`), ensuring downstream aggregation nodes execute even when a database table is empty.

### What Confused / Mistakes Made
- **Empty Habits Table Blocking Downstream Execution**: When `Get Habits` returned `[]` because no habits had been created yet, the Code node was skipped completely. Fixed by enabling "Always Output Data" on the HTTP nodes and adding a habit via `POST /habits`.
- **Node Scope Reference Errors**: Referencing `$('Get Habits')` before the node was executed or when node name capitalization differed (`get habits` vs `Get Habits`) triggered reference errors in the Code node.

---

## Day 13: Next.js App Router Setup, CORS, and Client-Side JWT Authentication

### Key Concepts Learned
- **Next.js 15 App Router & Project Structure**:
  - Initializing modern React applications with TypeScript, Tailwind CSS, and the App Router pattern (`src/app/`).
  - Separation of routing pages (`src/app/login/page.tsx`, `src/app/dashboard/page.tsx`) from shared utility libraries (`src/lib/api.ts`).
  - `@/*` path mapping in `tsconfig.json` allowing clean imports from `@/lib/...` throughout the codebase.
- **FastAPI Cross-Origin Resource Sharing (CORS)**:
  - Browsers enforce the Same-Origin Policy, blocking web apps on `http://localhost:3000` from making asynchronous fetch requests to `http://localhost:8000`.
  - Adding `CORSMiddleware` in `app/main.py` explicitly whitelisting frontend origins, credentials, and HTTP verbs.
- **OAuth2 Form Payload vs JSON Contracts**:
  - FastAPI's `OAuth2PasswordRequestForm` requires `application/x-www-form-urlencoded` payloads (`URLSearchParams` with `username` and `password` keys) for `/auth/login`.
  - Standard user registration endpoints (`/auth/register`) consume standard `application/json` payloads.
- **Client-Side Auth State Persistence**:
  - Storing bearer tokens in browser `localStorage`.
  - Client component route guards (`useEffect` checking `getToken()`) to redirect unauthenticated visitors to `/login` and provide clean logout workflows.

### Behind the Scenes / Architecture Insights
- **`next/font/google` Remote Font Dependencies**:
  - The default Next.js template imports `Geist` from `next/font/google`, which attempts to fetch font files from `fonts.gstatic.com` during compilation.
  - In network environments with restricted connectivity or proxy timeouts, this triggers fatal `Connection timed out` 500 errors. Removing the remote font fetch and utilizing native system typography renders builds completely offline-capable and resilient.

### What Confused / Mistakes Made
- **File Placement vs Path Alias Mapping**: Placing `api.ts` inside `src/app/lib/api.ts` caused TypeScript module resolution errors (`Can't resolve '@/lib/api'`). Solved by moving the folder to `src/lib/` directly under `src/`.
- **Payload Field Name Mismatch**: Typing `formData.append("paasword", ...)` with two `a`s caused FastAPI to reject authentication with a 422 Unprocessable Entity error because OAuth2 explicitly requires the key `password`. Fixed typo to restore authentication.

---

## Day 14: Interactive Task & Habit Dashboard with Full Stack React State

### Key Concepts Learned
- **Full Stack React Mutation Patterns**:
  - Utilizing `Promise.all([fetchTasks(), fetchHabits()])` on initial component mount to parallelize independent data fetches and eliminate waterfalls.
  - Designing client-side state hooks (`useState`) to store array state collections (`TaskItem[]`, `HabitItem[]`).
  - Applying array immutability (`[newTask, ...tasks]`, `tasks.filter(...)`, and `tasks.map(...)`) to ensure reactive re-renders when mutating state.
- **Bi-directional Integration from UI to Automation**:
  - Adding a task with a `due_date` through the web form dispatches `POST /tasks` ➡️ FastAPI triggers background task ➡️ n8n webhook creates Google Calendar event ➡️ n8n calls back `PATCH /tasks/{id}` to store the event ID!
  - Completing or deleting tasks in the UI automatically triggers the update/delete webhook lanes.
- **Habit Streak Gamification**:
  - Implementing single-click `+1 Streak` button calling `PATCH /habits/{id}` with `current_streak: current_streak + 1` to immediately reflect updated streaks in the dashboard and live in Supabase.

### Behind the Scenes / Architecture Insights
- **Monorepo / Multi-Folder Execution Contexts**:
  - Running `npm run dev` from the repository root fails with `Missing script: "dev"` because Next.js dependencies and `package.json` are isolated inside the `frontend/` subdirectory. Executing commands from the dedicated package directory (`cd frontend`) is required.
- **Optimistic vs Server-Driven State Synchronization**:
  - After mutating state over the REST API, updating the local React state directly with the server response guarantees UI synchronization without requiring a full page refresh.

### What Confused / Mistakes Made
- **Working Directory Context Confusion**: Attempting to execute `npm run dev` at the project root generated `npm error Missing script: "dev"`. Resolved by changing directories into `frontend/` where `package.json` resides.

---

## Day 15: Embeddings, Chunking Strategies & Semantic Similarity

### Key Concepts Learned

- **Dense Vector Embeddings**: Text is converted by a neural model into a fixed-length list of floats (a vector) where geometric distance captures semantic meaning. Words or passages with related meaning end up close together in this high-dimensional space.
- **`gemini-embedding-001`**: Google's production embedding model accessible via the `google-genai` SDK. Supports `output_dimensionality` configuration (default 3072, configured to 768 for pgvector compatibility). Note: `text-embedding-004` is NOT available in `google-genai` — always use `gemini-embedding-001`.
- **Sliding-Window Chunker**: The `chunk_text(text, chunk_size, chunk_overlap)` function splits text at word boundaries (not mid-word), then slides forward with an overlap to preserve sentence continuity across chunk boundaries. Overlap prevents an important sentence from being cut and lost entirely.
- **Chunk Size Trade-offs** (empirically verified on journal text):
  - `chunk_size=100` → 14 chunks, avg 95 chars — very granular, great for precise retrieval but loses surrounding context
  - `chunk_size=300` → 3 chunks, avg 280 chars — **balanced RAG default**, preserves sentence groups while keeping semantic focus tight
  - `chunk_size=600` → 2 chunks, avg 398 chars — few chunks, broad context preserved, but semantic signal gets diluted across topics
- **Cosine Similarity**: Measures the angle between two vectors regardless of their magnitude: `dot(A,B) / (|A| × |B|)`. Returns 1.0 for identical meaning, 0.0 for orthogonal, −1.0 for opposite. Pure Python implementation using `math.sqrt` and `zip`.

### Behind the Scenes / Architecture Insights

- **Why 768 dimensions?**: pgvector supports up to 2000 dimensions, but 768 is a standard "sweet spot" — high enough for rich semantic expressiveness, small enough to keep index size and query latency manageable.
- **Semantic retrieval proof**: Query "What bug did I fix today?" scored **0.6942** similarity against the OAuth/debugging chunk vs **0.4114** against the unrelated "weather in Paris" query — a gap of 0.28 that demonstrates vectors capture topic relevance, not just keyword overlap.
- **Overlap design**: Keeping the last ~50 chars of words as overlap ensures that a sentence straddling a chunk boundary contributes context to *both* adjacent chunks, which helps retrieval catch edge cases.
- **Embedding as the RAG entry point**: Every piece of data stored in the vector DB goes through `get_embedding()` at ingest time; every user query goes through it at retrieval time. The semantic proximity between query vector and chunk vectors determines what context gets fed to the LLM.

### What Confused / Mistakes Made

- **`text-embedding-004` NOT_FOUND**: Google's `google-genai` SDK does not expose `text-embedding-004` — the endpoint returns a 404. The correct model is `gemini-embedding-001`. This wasted time investigating the wrong model name.
- **`output_dimensionality` vs default**: Without `config={"output_dimensionality": 768}`, the model returns 3072-dimensional vectors by default. We set 768 explicitly to match the pgvector column definition we'll create in D16.
- **Script path resolution**: Running `python scripts/embedding_experiment.py` requires `sys.path.insert(0, ...)` to add the project root to `PYTHONPATH`, otherwise `from app.services.embedding import ...` raises `ModuleNotFoundError`.

### Questions for Further Exploration

- How does chunking strategy change for structured data (JSON logs) vs free-form prose (journal)?
- Should chunk boundaries respect paragraph breaks (semantic chunking) rather than fixed character counts?
- What's the retrieval quality difference between 768-dim and 3072-dim embeddings for our use case?

---

## Day 16: pgvector Integration & Journal Ingestion Pipeline

### Key Concepts Learned

- **PostgreSQL Vector Extension (`pgvector`)**:
  - Adds native vector data types (`vector(dim)`) and distance operators (`<=>` for cosine distance, `<->` for Euclidean L2, `<#>` for inner product) to PostgreSQL.
  - Allows dense embeddings from AI models to be stored directly alongside traditional relational columns (such as `id`, `title`, `created_at`, `chunk_index`).
- **SQLAlchemy + `pgvector` Integration**:
  - The `pgvector` Python package (`pgvector.sqlalchemy.Vector`) bridges SQLAlchemy ORM models with PostgreSQL's `vector` extension.
  - Adding `embedding = Column(Vector(768), nullable=False)` cleanly defines a fixed 768-dimensional column matching `gemini-embedding-001`.
- **Alembic Auto-generation with Vector Columns**:
  - Alembic detects the `Vector` column and generates the table DDL `sa.Column('embedding', pgvector.sqlalchemy.vector.VECTOR(dim=768), nullable=False)`.
  - Important prerequisite: In the migration's `upgrade()` function, always run `op.execute("CREATE EXTENSION IF NOT EXISTS vector")` and `import pgvector` to ensure PostgreSQL activates the extension and Python parses the DDL cleanly.
- **End-to-End Ingestion Pipeline (`app/services/ingest.py`)**:
  - Takes raw text and metadata ➡️ slices into semantic chunks (`chunk_text`) with overlap ➡️ calls `get_embedding()` to generate 768-float vectors via Gemini ➡️ instantiates ORM `JournalEntry` records ➡️ commits them into Supabase via transactional session.

### Behind the Scenes / Architecture Insights

- **Why Chunk Before Embedding in Ingestion?**:
  - A long journal entry cannot simply be embedded as one giant vector without losing fine-grained details: an entire 2-page reflection condensed to a single 768-float vector averages out all nuances.
  - Chunking creates focused vectors: one vector for debugging OAuth, one for RAG design decisions, one for the workout. When retrieving in Day 17, queries can find the exact paragraph needed.
- **Database Connection Naming Convention**:
  - Standardizing database session factories (`SessionLocal` vs `sessionLocal`) ensures consistency across scripts, tests, and API dependencies.

### What Confused / Mistakes Made

- **Alembic Auto-Generated Missing Imports**:
  - Alembic generated `pgvector.sqlalchemy.vector.VECTOR(...)` in the migration file without adding `import pgvector` to the file header. Running the migration threw a `NameError` until `import pgvector` was manually added.
- **Extension Order in Migrations**:
  - If `CREATE EXTENSION IF NOT EXISTS vector` isn't executed before `CREATE TABLE journal_entries`, PostgreSQL will reject the table creation with `type "vector" does not exist`. Placing `op.execute(...)` at the top of `upgrade()` fixes this safely.
- **Session Factory Casing**:
  - `database.py` originally defined `sessionLocal = sessionmaker(...)` in camelCase, causing `from app.core.database import SessionLocal` in scripts to fail with an `ImportError`. Aliased `SessionLocal = sessionLocal` to support standard PascalCase conventions.
- **Network Resolution in Sandbox**:
  - Connecting directly to remote cloud databases like Supabase (`aws-1-eu-central-1.pooler.supabase.com`) requires external socket resolution, which runs under standard network execution.

### Questions for Further Exploration

- When our journal table grows to thousands of entries, which index type (`HNSW` vs `IVFFlat`) will provide the best trade-off between build time and query latency?
- Can we perform hybrid search (full-text search with `to_tsvector` + vector search with `<=>`) to get the best of both keyword precision and semantic meaning?

---

## Day 17: Semantic Search Retrieval Endpoint with pgvector

### Key Concepts Learned

- **Vector Distance vs Vector Similarity**:
  - Distance and similarity are inversely related. pgvector's `<=>` operator computes **Cosine Distance**, defined as:
    $$\text{Cosine Distance} = 1.0 - \text{Cosine Similarity}$$
  - A cosine distance of `0.0` represents identical vector alignment (similarity `1.0`).
  - A cosine distance of `1.0` represents orthogonal, unrelated concepts (similarity `0.0`).
  - To present an intuitive score to API clients, we calculate:
    $$\text{similarity} = 1.0 - \text{distance}$$
- **SQLAlchemy pgvector Operator Syntax**:
  - `JournalEntry.embedding.cosine_distance(query_vector)` translates directly into PostgreSQL's `<=>` operator in the generated SQL statement.
  - Adding `.label("distance")` allows selecting both the ORM model instance and the computed distance scalar in a single query tuple: `db.query(JournalEntry, distance).order_by(distance.asc()).limit(k)`.
- **Decoupled Search Service Architecture (`app/services/search.py`)**:
  - Keeps query parsing, dynamic vector embedding via Gemini, and database distance calculation isolated from HTTP routing concerns.
  - Supports optional threshold filtering (`similarity >= threshold`) to exclude irrelevant chunks if needed.
- **RESTful Vector Search API (`GET /journal/search`)**:
  - Exposes `q` (query string with validation rejecting empty whitespace) and `limit` (bounded between 1 and 20).
  - Returns structured `JournalSearchResponse` containing the original query, result count, and ranked list of chunks with similarity scores.

### Behind the Scenes / Architecture Insights

- **Zero-Keyword Semantic Matching**:
  - In our test experiment, querying *"What token problem did I debug?"* yielded the chunk containing *"OAuth bug... token validation middleware... PyJWT decode"* as Rank 1 with similarity `0.7061`, even though the exact word *"problem"* never appeared in the text!
  - Querying *"How far did I run in the evening workout?"* retrieved the workout chunk with `0.7037` similarity, ignoring all OAuth and RAG chunks.
  - This confirms that dense vector retrieval finds content based on conceptual meaning rather than brittle keyword matching.

### What Confused / Mistakes Made

- **Pydantic Type Annotation Scope**:
  - Added `results: List[JournalSearchResult]` to `app/schemas/schema.py` without including `List` in the `typing` import header. Python threw `NameError: name 'List' is not defined` during pytest collection until `from typing import Optional, List` was specified.
- **FastAPI Validation on Whitespace Query**:
  - Standard `min_length=1` allows a string consisting solely of spaces (`"   "`). Added explicit check `if not q.strip(): raise HTTPException(400, ...)` to reject whitespace-only searches cleanly.

### Questions for Further Exploration

- How will search performance scale as the database grows to 100,000+ chunks without an HNSW index?
- Can we re-rank the top-k retrieved chunks using a cross-encoder model before sending them to the generation prompt in Day 18?
