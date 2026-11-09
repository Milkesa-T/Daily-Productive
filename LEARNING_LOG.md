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
