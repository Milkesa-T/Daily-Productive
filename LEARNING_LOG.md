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
