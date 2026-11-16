from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Reminder, User
from app.routers.auth import get_current_user
from app.schemas.schema import ReminderCreate, ReminderUpdate, ReminderResponse
from app.core.exceptions import EntityNotFoundException

router = APIRouter(prefix="/reminders", tags=["Reminders"])


@router.post("", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
def create_reminder(
    reminder_in: ReminderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminder = Reminder(
        **reminder_in.model_dump(),
        user_id=current_user.id
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.get("", response_model=List[ReminderResponse])
def get_all_reminders(
    is_active: Optional[bool] = Query(None, description="Filter active/inactive reminders"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Reminder).filter(Reminder.user_id == current_user.id)
    if is_active is not None:
        query = query.filter(Reminder.is_active == is_active)
    return query.order_by(Reminder.due_time.asc()).all()


@router.get("/{reminder_id}", response_model=ReminderResponse)
def get_reminder_by_id(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminder = db.query(Reminder).filter(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id
    ).first()
    if not reminder:
        raise EntityNotFoundException(entity_name="Reminder", entity_id=reminder_id)
    return reminder


@router.patch("/{reminder_id}", response_model=ReminderResponse)
def update_reminder(
    reminder_id: int,
    reminder_in: ReminderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminder = db.query(Reminder).filter(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id
    ).first()
    if not reminder:
        raise EntityNotFoundException(entity_name="Reminder", entity_id=reminder_id)

    update_data = reminder_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(reminder, key, value)

    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminder = db.query(Reminder).filter(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id
    ).first()
    if not reminder:
        raise EntityNotFoundException(entity_name="Reminder", entity_id=reminder_id)

    db.delete(reminder)
    db.commit()
    return None
