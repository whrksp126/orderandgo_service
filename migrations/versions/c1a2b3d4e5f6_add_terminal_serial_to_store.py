"""add terminal_serial to store

Revision ID: c1a2b3d4e5f6
Revises: bd2139d2a99d
Create Date: 2026-03-19

"""
from alembic import op
import sqlalchemy as sa

revision = 'c1a2b3d4e5f6'
down_revision = 'bd2139d2a99d'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('store', sa.Column('terminal_serial', sa.String(50), nullable=True))


def downgrade():
    op.drop_column('store', 'terminal_serial')
