"""add_user_id_foreign_keys

Revision ID: e447a7800ce0
Revises: 61f2d1e45bcc
Create Date: 2026-11-16 14:59:25.494428

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e447a7800ce0'
down_revision: Union[str, Sequence[str], None] = '61f2d1e45bcc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema safely with backfill for existing rows."""
    bind = op.get_bind()

    # 1. Resolve default user_id to assign existing records to
    user_row = bind.execute(
        sa.text("SELECT id FROM users WHERE email = 'milkesataye0450@gmail.com' LIMIT 1")
    ).fetchone()
    if not user_row:
        user_row = bind.execute(sa.text("SELECT id FROM users ORDER BY id ASC LIMIT 1")).fetchone()
    default_user_id = user_row[0] if user_row else 1

    tables = ['tasks', 'habits', 'goals', 'journal_entries']

    for table in tables:
        # Step A: Add column as nullable first
        op.add_column(table, sa.Column('user_id', sa.Integer(), nullable=True))
        
        # Step B: Backfill existing rows with primary user ID
        bind.execute(
            sa.text(f"UPDATE {table} SET user_id = :uid WHERE user_id IS NULL"),
            {"uid": default_user_id}
        )
        
        # Step C: Enforce nullable=False
        op.alter_column(table, 'user_id', nullable=False)
        
        # Step D: Create index & named foreign key
        op.create_index(op.f(f'ix_{table}_user_id'), table, ['user_id'], unique=False)
        op.create_foreign_key(
            f'fk_{table}_user_id',
            table,
            'users',
            ['user_id'],
            ['id'],
            ondelete='CASCADE'
        )


def downgrade() -> None:
    """Downgrade schema."""
    tables = ['tasks', 'habits', 'goals', 'journal_entries']
    for table in tables:
        op.drop_constraint(f'fk_{table}_user_id', table, type_='foreignkey')
        op.drop_index(op.f(f'ix_{table}_user_id'), table_name=table)
        op.drop_column(table, 'user_id')

