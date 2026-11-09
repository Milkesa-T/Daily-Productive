from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.webhook import trigger_n8n_webhook
from app.models.models import Task
from app.schemas.schema import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# 1. CREATE
@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate,  background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Convert validated Pydantic fields directly into an ORM object
    new_task = Task(**task_in.model_dump())
    db.add(new_task)
    db.commit()
    db.refresh(new_task)  # Loads system assigned ID and timestamps
    if new_task.due_date:
        payload = {
            "event": "task_created",
            "task_id": new_task.id,
            "title": new_task.title,
            "description": new_task.description,
            "due_date": new_task.due_date.isoformat(),
            "priority_level": new_task.priority_level,
        }
        background_tasks.add_task(trigger_n8n_webhook, payload)
    return new_task

# 2. READ ALL
@router.get("", response_model=List[TaskResponse])
def get_all_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()

# 3. READ BY ID
@router.get("/{task_id}", response_model=TaskResponse)
def get_task_by_id(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")
    return task

# 4. UPDATE (PATCH)
@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_in: TaskUpdate, background_tasks: BackgroundTasks,  db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")
    
    # Extract only fields explicitly sent by user in request payload
    update_data = task_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
        
    db.commit()
    db.refresh(db_task)
    if db_task.reminder_id and any(f in update_data for f in ["title", "description", "due_date"]):
        payload = {
            "event": "task_updated",
            "task_id": db_task.id,
            "reminder_id": db_task.reminder_id,
            "title": db_task.title,
            "description": db_task.description,
            "due_date": db_task.due_date.isoformat() if db_task.due_date else None ,
            "priority_level": db_task.priority_level, 
        }
        background_tasks.add_task(trigger_n8n_webhook, payload)

    return db_task

# 5. DELETE
@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")
    if db_task.reminder_id:
        payload = {
            "event" : "task_deleted",
            "task_id": db_task.id,
            "reminder_id": db_task.reminder_id,     
        }
        background_tasks.add_task(trigger_n8n_webhook, payload)
    db.delete(db_task)
    db.commit()
    return None  # HTTP 204 returns no body layout
