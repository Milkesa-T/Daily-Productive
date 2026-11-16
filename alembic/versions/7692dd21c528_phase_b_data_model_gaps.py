"""phase_b_data_model_gaps

Revision ID: 7692dd21c528
Revises: e447a7800ce0
Create Date: 2026-11-16 21:29:29.863670

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7692dd21c528'
down_revision: Union[str, Sequence[str], None] = 'e447a7800ce0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create categories table
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_categories_user_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_user_category_name')
    )
    op.create_index(op.f('ix_categories_id'), 'categories', ['id'], unique=False)
    op.create_index(op.f('ix_categories_user_id'), 'categories', ['user_id'], unique=False)

    # 2. Create journals table
    op.create_table(
        'journals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_journals_user_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_journals_id'), 'journals', ['id'], unique=False)
    op.create_index(op.f('ix_journals_user_id'), 'journals', ['user_id'], unique=False)

    # 3. Create reminders table
    op.create_table(
        'reminders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('due_time', sa.DateTime(), nullable=False),
        sa.Column('recurrence', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('gcal_event_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_reminders_user_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_reminders_id'), 'reminders', ['id'], unique=False)
    op.create_index(op.f('ix_reminders_user_id'), 'reminders', ['user_id'], unique=False)

    # 4. Create habit_completions table
    op.create_table(
        'habit_completions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('habit_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('completed_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['habit_id'], ['habits.id'], name='fk_habit_completions_habit_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_habit_completions_user_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('habit_id', 'completed_date', name='uq_habit_completed_date')
    )
    op.create_index(op.f('ix_habit_completions_completed_date'), 'habit_completions', ['completed_date'], unique=False)
    op.create_index(op.f('ix_habit_completions_habit_id'), 'habit_completions', ['habit_id'], unique=False)
    op.create_index(op.f('ix_habit_completions_id'), 'habit_completions', ['id'], unique=False)
    op.create_index(op.f('ix_habit_completions_user_id'), 'habit_completions', ['user_id'], unique=False)

    # 5. Add columns to habits
    op.add_column('habits', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_habits_category_id'), 'habits', ['category_id'], unique=False)
    op.create_foreign_key('fk_habits_category_id', 'habits', 'categories', ['category_id'], ['id'], ondelete='SET NULL')

    # 6. Add columns to journal_entries
    op.add_column('journal_entries', sa.Column('journal_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_journal_entries_journal_id'), 'journal_entries', ['journal_id'], unique=False)
    op.create_foreign_key('fk_journal_entries_journal_id', 'journal_entries', 'journals', ['journal_id'], ['id'], ondelete='CASCADE')

    # 7. Add columns to tasks
    op.add_column('tasks', sa.Column('goal_id', sa.Integer(), nullable=True))
    op.add_column('tasks', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_tasks_category_id'), 'tasks', ['category_id'], unique=False)
    op.create_index(op.f('ix_tasks_goal_id'), 'tasks', ['goal_id'], unique=False)
    op.create_foreign_key('fk_tasks_category_id', 'tasks', 'categories', ['category_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_tasks_goal_id', 'tasks', 'goals', ['goal_id'], ['id'], ondelete='SET NULL')

    # 8. Data backfill: populate parent journals table for any legacy unlinked journal_entries chunks
    bind = op.get_bind()
    entries = bind.execute(sa.text("SELECT id, user_id, title, content, created_at FROM journal_entries WHERE journal_id IS NULL ORDER BY id ASC")).fetchall()
    for row in entries:
        r_id, u_id, title, content, created_at = row[0], row[1], row[2], row[3], row[4]
        res = bind.execute(
            sa.text("INSERT INTO journals (user_id, title, content, created_at, updated_at) VALUES (:u_id, :title, :content, :created_at, :created_at) RETURNING id"),
            {"u_id": u_id, "title": title or "Daily Note", "content": content, "created_at": created_at}
        )
        j_id = res.scalar()
        bind.execute(
            sa.text("UPDATE journal_entries SET journal_id = :j_id WHERE id = :r_id"),
            {"j_id": j_id, "r_id": r_id}
        )

    # 9. Data backfill: populate categories from distinct task categories
    task_cats = bind.execute(sa.text("SELECT DISTINCT user_id, category FROM tasks WHERE category IS NOT NULL AND category != ''")).fetchall()
    for u_id, cat_name in task_cats:
        c_name = cat_name.strip()
        existing_cat = bind.execute(
            sa.text("SELECT id FROM categories WHERE user_id = :u_id AND LOWER(name) = LOWER(:name)"),
            {"u_id": u_id, "name": c_name}
        ).scalar()
        if not existing_cat:
            c_res = bind.execute(
                sa.text("INSERT INTO categories (user_id, name, color, created_at) VALUES (:u_id, :name, '#4F46E5', NOW()) RETURNING id"),
                {"u_id": u_id, "name": c_name}
            )
            existing_cat = c_res.scalar()
        bind.execute(
            sa.text("UPDATE tasks SET category_id = :cat_id WHERE user_id = :u_id AND category = :cat_name"),
            {"cat_id": existing_cat, "u_id": u_id, "cat_name": cat_name}
        )


def downgrade() -> None:
    op.drop_constraint('fk_tasks_goal_id', 'tasks', type_='foreignkey')
    op.drop_constraint('fk_tasks_category_id', 'tasks', type_='foreignkey')
    op.drop_index(op.f('ix_tasks_goal_id'), table_name='tasks')
    op.drop_index(op.f('ix_tasks_category_id'), table_name='tasks')
    op.drop_column('tasks', 'category_id')
    op.drop_column('tasks', 'goal_id')

    op.drop_constraint('fk_journal_entries_journal_id', 'journal_entries', type_='foreignkey')
    op.drop_index(op.f('ix_journal_entries_journal_id'), table_name='journal_entries')
    op.drop_column('journal_entries', 'journal_id')

    op.drop_constraint('fk_habits_category_id', 'habits', type_='foreignkey')
    op.drop_index(op.f('ix_habits_category_id'), table_name='habits')
    op.drop_column('habits', 'category_id')

    op.drop_index(op.f('ix_habit_completions_user_id'), table_name='habit_completions')
    op.drop_index(op.f('ix_habit_completions_id'), table_name='habit_completions')
    op.drop_index(op.f('ix_habit_completions_habit_id'), table_name='habit_completions')
    op.drop_index(op.f('ix_habit_completions_completed_date'), table_name='habit_completions')
    op.drop_table('habit_completions')

    op.drop_index(op.f('ix_reminders_user_id'), table_name='reminders')
    op.drop_index(op.f('ix_reminders_id'), table_name='reminders')
    op.drop_table('reminders')

    op.drop_index(op.f('ix_journals_user_id'), table_name='journals')
    op.drop_index(op.f('ix_journals_id'), table_name='journals')
    op.drop_table('journals')

    op.drop_index(op.f('ix_categories_user_id'), table_name='categories')
    op.drop_index(op.f('ix_categories_id'), table_name='categories')
    op.drop_table('categories')
