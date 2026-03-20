"""add last_polled_at to terminal_token

Revision ID: d1e2f3a4b5c6
Revises: c1a2b3d4e5f6
Create Date: 2026-03-20

"""
from alembic import op
import sqlalchemy as sa

revision = 'd1e2f3a4b5c6'
down_revision = '08f669ab058f'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('terminal_token', sa.Column('last_polled_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('terminal_token', 'last_polled_at')
