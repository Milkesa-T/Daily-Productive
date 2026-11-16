from datetime import datetime, date, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Task, Habit, Goal, User
from app.routers.auth import get_current_user
from app.routers.habits import calculate_streaks
from app.routers.goals import format_goal_response
from app.schemas.schema import DashboardSummaryResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    now = datetime.utcnow()
    start_of_today = datetime.combine(today, datetime.min.time())
    end_of_today = datetime.combine(today, datetime.max.time())
    seven_days_ago = start_of_today - timedelta(days=7)

    # 1. Tasks
    all_user_tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    tasks_today = [
        t for t in all_user_tasks
        if t.due_date and start_of_today <= t.due_date <= end_of_today
    ]
    overdue_tasks = [
        t for t in all_user_tasks
        if t.due_date and t.due_date < start_of_today and not t.is_completed
    ]
    completed_today = sum(1 for t in tasks_today if t.is_completed)

    # Tasks for display (today's tasks + overdue tasks)
    display_tasks = [
        {
            "id": t.id,
            "title": t.title,
            "priority_level": t.priority_level,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "is_completed": t.is_completed,
            "is_overdue": bool(t.due_date and t.due_date < start_of_today and not t.is_completed),
            "goal_id": t.goal_id,
            "category_id": t.category_id,
        }
        for t in (tasks_today + overdue_tasks)
    ]

    # Weekly completion rate
    recent_tasks = [
        t for t in all_user_tasks
        if (t.due_date and t.due_date >= seven_days_ago) or (t.created_at and t.created_at >= seven_days_ago)
    ]
    if recent_tasks:
        recent_completed = sum(1 for t in recent_tasks if t.is_completed)
        weekly_rate = round((recent_completed / len(recent_tasks)) * 100.0, 1)
    else:
        weekly_rate = 100.0 if all_user_tasks and all(t.is_completed for t in all_user_tasks) else 0.0

    # 2. Habits
    all_user_habits = db.query(Habit).filter(Habit.user_id == current_user.id).all()
    habits_list = []
    habits_completed_today_count = 0
    for h in all_user_habits:
        completion_dates = {c.completed_date for c in h.completions} if h.completions else set()
        c_streak, l_streak, c_today = calculate_streaks(completion_dates)
        if c_today:
            habits_completed_today_count += 1
        habits_list.append({
            "id": h.id,
            "name": h.name,
            "frequency_type": h.frequency_type,
            "target_count": h.target_count,
            "current_streak": c_streak,
            "longest_streak": l_streak,
            "completed_today": c_today,
            "category_id": h.category_id,
        })

    # 3. Goals
    all_user_goals = db.query(Goal).filter(Goal.user_id == current_user.id).all()
    goals_list = [format_goal_response(g).model_dump() for g in all_user_goals]

    return DashboardSummaryResponse(
        today=today.isoformat(),
        tasks={
            "total_today": len(tasks_today),
            "completed_today": completed_today,
            "overdue_count": len(overdue_tasks),
            "items": display_tasks,
        },
        habits={
            "total_habits": len(all_user_habits),
            "completed_today": habits_completed_today_count,
            "items": habits_list,
        },
        goals=goals_list,
        weekly_completion_rate=weekly_rate,
    )
