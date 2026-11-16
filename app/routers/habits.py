from datetime import date, timedelta
from typing import List, Optional, Set
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Habit, HabitCompletion, User
from app.routers.auth import get_current_user
from app.schemas.schema import HabitCreate, HabitResponse, HabitUpdate, HabitToggleResponse

router = APIRouter(prefix="/habits", tags=["Habits"])


def calculate_streaks(dates: Set[date]):
    if not dates:
        return 0, 0, False

    today = date.today()
    completed_today = today in dates

    # Current streak calculation
    current_streak = 0
    check_date = today if completed_today else (today - timedelta(days=1))
    while check_date in dates:
        current_streak += 1
        check_date -= timedelta(days=1)

    # Longest streak calculation
    sorted_dates = sorted(dates)
    longest_streak = 1
    temp_streak = 1
    for i in range(1, len(sorted_dates)):
        if sorted_dates[i] == sorted_dates[i - 1] + timedelta(days=1):
            temp_streak += 1
            if temp_streak > longest_streak:
                longest_streak = temp_streak
        elif sorted_dates[i] > sorted_dates[i - 1] + timedelta(days=1):
            temp_streak = 1

    return current_streak, longest_streak, completed_today


def format_habit_response(habit: Habit) -> HabitResponse:
    completion_dates = {c.completed_date for c in habit.completions} if habit.completions else set()
    current_streak, longest_streak, completed_today = calculate_streaks(completion_dates)
    return HabitResponse(
        id=habit.id,
        name=habit.name,
        frequency_type=habit.frequency_type,
        target_count=habit.target_count,
        current_streak=current_streak,
        longest_streak=longest_streak,
        completed_today=completed_today,
        category_id=habit.category_id,
        created_at=habit.created_at,
        updated_at=habit.updated_at,
    )


# 1. CREATE
@router.post("", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
def create_habit(
    habit_in: HabitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_habit = Habit(**habit_in.model_dump(), user_id=current_user.id)
    db.add(new_habit)
    db.commit()
    db.refresh(new_habit)
    return format_habit_response(new_habit)


# 2. READ ALL
@router.get("", response_model=List[HabitResponse])
def get_all_habits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habits = db.query(Habit).filter(Habit.user_id == current_user.id).all()
    return [format_habit_response(h) for h in habits]


# 3. READ BY ID
@router.get("/{habit_id}", response_model=HabitResponse)
def get_habit_by_id(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_user.id).first()
    if not habit:
        raise HTTPException(status_code=404, detail=f"Habit with ID {habit_id} not found")
    return format_habit_response(habit)


# 4. TOGGLE COMPLETION FOR TODAY (OR SPECIFIC DATE)
@router.post("/{habit_id}/toggle-today", response_model=HabitToggleResponse)
def toggle_habit_today(
    habit_id: int,
    target_date: Optional[date] = Query(None, description="Optional completion date, defaults to today"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_user.id).first()
    if not habit:
        raise HTTPException(status_code=404, detail=f"Habit with ID {habit_id} not found")

    comp_date = target_date or date.today()

    existing = db.query(HabitCompletion).filter(
        HabitCompletion.habit_id == habit_id,
        HabitCompletion.user_id == current_user.id,
        HabitCompletion.completed_date == comp_date
    ).first()

    if existing:
        # Toggle off
        db.delete(existing)
        db.commit()
        db.refresh(habit)
        completed = False
        msg = f"Habit '{habit.name}' unmarked for {comp_date}."
    else:
        # Toggle on
        new_comp = HabitCompletion(
            habit_id=habit_id,
            user_id=current_user.id,
            completed_date=comp_date
        )
        db.add(new_comp)
        db.commit()
        db.refresh(habit)
        completed = True
        msg = f"Habit '{habit.name}' marked completed for {comp_date}!"

    dates = {c.completed_date for c in habit.completions}
    c_streak, l_streak, c_today = calculate_streaks(dates)

    # Persist current_streak to habit model as well
    habit.current_streak = c_streak
    db.commit()

    return HabitToggleResponse(
        id=habit.id,
        completed_today=c_today,
        current_streak=c_streak,
        longest_streak=l_streak,
        message=msg
    )


# 5. COMPLETION HISTORY
@router.get("/{habit_id}/history", response_model=List[date])
def get_habit_history(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_user.id).first()
    if not habit:
        raise HTTPException(status_code=404, detail=f"Habit with ID {habit_id} not found")

    completions = db.query(HabitCompletion.completed_date).filter(
        HabitCompletion.habit_id == habit_id,
        HabitCompletion.user_id == current_user.id
    ).order_by(HabitCompletion.completed_date.desc()).all()

    return [c[0] for c in completions]


# 6. UPDATE (PATCH)
@router.patch("/{habit_id}", response_model=HabitResponse)
def update_habit(
    habit_id: int,
    habit_in: HabitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_user.id).first()
    if not db_habit:
        raise HTTPException(status_code=404, detail=f"Habit with ID {habit_id} not found")

    update_data = habit_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_habit, key, value)

    db.commit()
    db.refresh(db_habit)
    return format_habit_response(db_habit)


# 7. DELETE
@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_user.id).first()
    if not db_habit:
        raise HTTPException(status_code=404, detail=f"Habit with ID {habit_id} not found")

    db.delete(db_habit)
    db.commit()
    return None
