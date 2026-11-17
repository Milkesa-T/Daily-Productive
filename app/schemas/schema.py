from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from datetime import datetime, date
from typing import Optional, List, Dict, Any


# --- Category Schemas ---

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = Field(default="#4F46E5", max_length=20)

    @field_validator("name")
    @classmethod
    def validate_name_not_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Category name cannot be empty")
        return value.strip()


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and (not value or not value.strip()):
            raise ValueError("Category name cannot be empty or just whitespace.")
        return value.strip() if value else None


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Task Schemas ---

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    priority_level: str
    category: Optional[str] = None
    category_id: Optional[int] = None
    is_completed: bool = False
    reminder_id: Optional[str] = None
    goal_id: Optional[int] = None

    @field_validator("title")
    @classmethod
    def validate_title_not_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Title cannot be empty")
        return value.strip()


class TaskCreate(TaskBase):
    pass


class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    priority_level: Optional[str] = None
    category: Optional[str] = None
    category_id: Optional[int] = None
    is_completed: Optional[bool] = None
    goal_id: Optional[int] = None
    reminder_id: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and (not value or not value.strip()):
            raise ValueError("Title cannot be empty or just whitespace.")
        return value.strip() if value else None


# --- Habit Schemas ---

class HabitBase(BaseModel):
    name: str
    frequency_type: str = Field(..., min_length=1, max_length=100)
    target_count: int = Field(..., ge=1, description="Target count must be at least 1")
    current_streak: int = Field(default=0, ge=0, description="Consecutive completions streak")
    category_id: Optional[int] = None

    @field_validator("name", "frequency_type")
    @classmethod
    def validate_name(cls, value: str):
        if not value or not value.strip():
            raise ValueError("Habit cannot be empty")
        return value.strip()


class HabitCreate(HabitBase):
    pass


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    frequency_type: Optional[str] = None
    target_count: Optional[int] = Field(default=None, ge=1)
    current_streak: Optional[int] = Field(default=None, ge=0)
    category_id: Optional[int] = None


class HabitResponse(HabitBase):
    id: int
    longest_streak: int = 0
    completed_today: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class HabitToggleResponse(BaseModel):
    id: int
    completed_today: bool
    current_streak: int
    longest_streak: int
    message: str


# --- Goal Schemas ---

class GoalBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    progress_percentage: float = Field(default=0.0, ge=0.0, le=100.0)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Goal title cannot be empty")
        return value.strip()

    @model_validator(mode="after")
    def validate_date_range(self):
        """Cross-field validation: target_date must not be earlier than start_date."""
        if self.start_date and self.target_date:
            if self.target_date < self.start_date:
                raise ValueError("target_date cannot be earlier than start_date")
        return self


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    progress_percentage: Optional[float] = Field(default=None, ge=0.0, le=100.0)

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.start_date and self.target_date:
            if self.target_date < self.start_date:
                raise ValueError("target_date cannot be earlier than start_date")
        return self


class GoalResponse(GoalBase):
    id: int
    total_tasks: int = 0
    completed_tasks: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Reminder Schemas ---

class ReminderBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    due_time: datetime
    recurrence: Optional[str] = Field(default="none", description="none, daily, weekly, weekdays, monthly")
    is_active: bool = True

    @field_validator("title")
    @classmethod
    def validate_title_not_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Reminder title cannot be empty")
        return value.strip()


class ReminderCreate(ReminderBase):
    pass


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_time: Optional[datetime] = None
    recurrence: Optional[str] = None
    is_active: Optional[bool] = None
    gcal_event_id: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and (not value or not value.strip()):
            raise ValueError("Reminder title cannot be empty or just whitespace.")
        return value.strip() if value else None


class ReminderResponse(ReminderBase):
    id: int
    gcal_event_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- User Schemas ---

class UserCreate(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Journal & Vector Search Schemas ---

class JournalCreate(BaseModel):
    title: Optional[str] = None
    content: str


class JournalUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class JournalResponse(BaseModel):
    id: int
    title: Optional[str] = None
    content: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class JournalSummaryResponse(BaseModel):
    id: int
    title: Optional[str] = None
    snippet: str
    created_at: datetime
    updated_at: datetime
    chunks_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class JournalSearchResult(BaseModel):
    id: int
    title: Optional[str] = None
    content: str
    chunk_index: int
    similarity: float
    distance: float
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class JournalSearchResponse(BaseModel):
    query: str
    total_results: int
    results: List[JournalSearchResult]


class JournalAskRequest(BaseModel):
    question: str


class JournalSource(BaseModel):
    id: int
    title: Optional[str] = None
    chunk_index: Optional[int] = 0
    similarity: Optional[float] = None
    snippet: str


class JournalAskResponse(BaseModel):
    question: str
    answer: str
    sources: List[JournalSource]


# --- Dashboard Schemas ---

class DashboardSummaryResponse(BaseModel):
    today: str
    tasks: Dict[str, Any]
    habits: Dict[str, Any]
    goals: List[Dict[str, Any]]
    weekly_completion_rate: float


# --- Auth Token Schemas ---

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


# --- GitHub Integration Schemas ---

class RepositoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=200)
    url: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class RepositoryCreate(RepositoryBase):
    pass


class RepositoryResponse(RepositoryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    commits_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class CommitBase(BaseModel):
    commit_hash: str = Field(..., min_length=4, max_length=64)
    message: str = Field(..., min_length=1)
    author_name: Optional[str] = None
    committed_at: datetime
    url: Optional[str] = None


class CommitCreate(CommitBase):
    pass


class CommitBatchCreate(BaseModel):
    repository_full_name: str
    commits: List[CommitCreate]


class CommitResponse(CommitBase):
    id: int
    repository_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
