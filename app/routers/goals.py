from typing import List
from fastapi import APIRouter, Depends, status 
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Goal
from app.schemas.schema import GoalCreate, GoalResponse, GoalUpdate
from app.core.exceptions import EntityNotFoundException, BusinessRuleViolationException

router = APIRouter(prefix='/goals', tags=["Goals"])
def validate_goal_dates(start_date , target_date):
    if start_date and target_date and target_date < start_date:
        raise BusinessRuleViolationException("Target date cannot be before start date")

@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(goal_in:GoalCreate, db: Session= Depends(get_db)):
    validate_goal_dates(goal_in.start_date, goal_in.target_date)
    new_goal = Goal (**goal_in.model_dump())
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)
    return new_goal

@router.get("", response_model=List[GoalResponse])
def get_all_goals(db: Session = Depends(get_db)):
    return db.query(Goal).all()

@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal_by_id(goal_id: int, db: Session = Depends(get_db)):
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise EntityNotFoundException(entity_name="Goal", entity_id=goal_id)
    return goal

@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(goal_id: int, goal_in: GoalUpdate, db: Session = Depends(get_db)):
    db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not db_goal:
        raise EntityNotFoundException(entity_name="Goal", entity_id=goal_id)
    
    update_data = goal_in.model_dump(exclude_unset=True)
    
    # Cross-field date validation for partial updates
    merged_start = update_data.get("start_date", db_goal.start_date)
    merged_target = update_data.get("target_date", db_goal.target_date)
    validate_goal_dates(merged_start, merged_target)
    
    for key, value in update_data.items():
        setattr(db_goal, key, value)
        
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not db_goal:
        raise EntityNotFoundException(entity_name="Goal", entity_id=goal_id)
    
    db.delete(db_goal)
    db.commit()
    return None