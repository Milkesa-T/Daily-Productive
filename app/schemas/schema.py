
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from datetime import datetime
from typing import Optional


# task schema 
class TaskBase(BaseModel):
    title: str
    description: Optional[str]=None
    due_date: Optional[datetime]=None
    status: Optional[str]=None
    priority_level: str
    category: Optional[str]=None
    is_completed: bool =False
    reminder_id: Optional[str]=None

    @field_validator("title")
    @classmethod
    def validate_title_not_empty(cls, value:str) -> str:
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
    is_completed: Optional[bool] = None
    reminder_id: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and (not value or not value.strip()):
            raise ValueError("Title cannot be empty or just whitespace.")
        return value.strip() if value else None




    
class HabitBase(BaseModel):
    name: str
    frequency_type: str = Field(..., min_length=1, max_length=100)
    target_count: int = Field(..., ge=1, description="Target count must be at least 1")
    current_streak: int= Field(default=0, ge=0, description="Consecutive completions streak")

    @field_validator("name", "frequency_type")      
    @classmethod 
    def validate_name(cls, value:str):
        if not value or not value.strip():
            raise ValueError("Habit cannot be empty")
        return value.strip()

class HabitCreate(HabitBase):
    pass

        
class HabitUpdate(BaseModel):
    name:Optional[str]=None
    frequency_type:Optional[str]=None
    target_count:Optional[int]=Field(default=None, ge=1)
    current_streak:Optional[int]=Field(default=None, ge=0)

class HabitResponse(HabitBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
   

class GoalBase(BaseModel):
    title: str
    description: Optional[str]=None
    start_date: Optional[datetime]=None
    target_date: Optional[datetime]=None
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
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    progress_percentage: Optional[float] = Field(default=None, ge=0.0, le=100.0)

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.start_date and self.target_date:
            if self.target_date < self.start_date:
                raise ValueError("target_date cannot be earlier than start_date")
        return self
class GoalResponse(GoalBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


if __name__ == "__main__":
    print("--- 1. Testing Task Validation ---")
    valid_task = TaskCreate(
        title="  Build FastAPI app  ",
        priority_level="high",
        category="Dev"
    )
    print(f"Task created successfully. Cleaned title: '{valid_task.title}'")
    print("\n--- 2. Testing Habit Bounds ---")
    try:
        HabitCreate(name="Gym", frequency_type="daily", target_count=0)
    except Exception as e:
        print(f"Correctly caught invalid target_count: {e.errors()[0]['msg']}")
    print("\n--- 3. Testing Goal Date Range ---")
    try:
        GoalCreate(
            title="Sprint Goal",
            start_date=datetime(2026, 11, 1),
            target_date=datetime(2026, 10, 1)  # Earlier than start_date!
        )
    except Exception as e:
        print(f"Correctly caught date logic error: {e.errors()[0]['msg']}")
    print("\nAll schema validations passed!")