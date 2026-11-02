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
