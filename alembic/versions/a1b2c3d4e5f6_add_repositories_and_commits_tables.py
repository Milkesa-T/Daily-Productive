"""add_repositories_and_commits_tables

Revision ID: a1b2c3d4e5f6
Revises: 7692dd21c528
Create Date: 2026-11-17 13:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '7692dd21c528'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create repositories table
    op.create_table(
        'repositories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('url', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_repositories_user_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'full_name', name='uq_user_repository')
    )
    op.create_index(op.f('ix_repositories_id'), 'repositories', ['id'], unique=False)
    op.create_index(op.f('ix_repositories_user_id'), 'repositories', ['user_id'], unique=False)

    # 2. Create commits table
    op.create_table(
        'commits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('repository_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('commit_hash', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('author_name', sa.String(), nullable=True),
        sa.Column('committed_at', sa.DateTime(), nullable=False),
        sa.Column('url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['repository_id'], ['repositories.id'], name='fk_commits_repository_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_commits_user_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('repository_id', 'commit_hash', name='uq_repo_commit_hash')
    )
    op.create_index(op.f('ix_commits_id'), 'commits', ['id'], unique=False)
    op.create_index(op.f('ix_commits_repository_id'), 'commits', ['repository_id'], unique=False)
    op.create_index(op.f('ix_commits_user_id'), 'commits', ['user_id'], unique=False)
    op.create_index(op.f('ix_commits_commit_hash'), 'commits', ['commit_hash'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_commits_commit_hash'), table_name='commits')
    op.drop_index(op.f('ix_commits_user_id'), table_name='commits')
    op.drop_index(op.f('ix_commits_repository_id'), table_name='commits')
    op.drop_index(op.f('ix_commits_id'), table_name='commits')
    op.drop_table('commits')

    op.drop_index(op.f('ix_repositories_user_id'), table_name='repositories')
    op.drop_index(op.f('ix_repositories_id'), table_name='repositories')
    op.drop_table('repositories')
