from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Habit
from app.schemas.schema import HabitCreate, HabitResponse, HabitUpdate

router = APIRouter(prefix="/habits", tags=["Habits"])

# 1. CREATE
@router.post("", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
def create_habit(habit_in: HabitCreate, db: Session = Depends(get_db)):
    new_habit = Habit(**habit_in.model_dump())
    db.add(new_habit)
    db.commit()
    db.refresh(new_habit)
    return new_habit

# 2. READ ALL
@router.get("", response_model=List[HabitResponse])
def get_all_habits(db: Session = Depends(get_db)):
    return db.query(Habit).all()

# 3. READ BY ID
@router.get("/{habit_id}", response_model=HabitResponse)
def get_habit_by_id(habit_id: int, db: Session = Depends(get_db)):
    habit = db.query(Habit).filter(Habit.id == habit_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail=f"Habit with ID {habit_id} not found")
    return habit

# 4. UPDATE (PATCH)
@router.patch("/{habit_id}", response_model=HabitResponse)
def update_habit(habit_id: int, habit_in: HabitUpdate, db: Session = Depends(get_db)):
    db_habit = db.query(Habit).filter(Habit.id == habit_id).first()
    if not db_habit:
        raise HTTPException(status_code=404, detail=f"Habit with ID {habit_id} not found")
    
    update_data = habit_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_habit, key, value)
        
    db.commit()
    db.refresh(db_habit)
    return db_habit

# 5. DELETE
@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(habit_id: int, db: Session = Depends(get_db)):
    db_habit = db.query(Habit).filter(Habit.id == habit_id).first()
    if not db_habit:
        raise HTTPException(status_code=404, detail=f"Habit with ID {habit_id} not found")
    
    db.delete(db_habit)
    db.commit()
    return None
