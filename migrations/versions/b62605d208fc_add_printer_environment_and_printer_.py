"""add printer_environment and printer tables

Revision ID: b62605d208fc
Revises: d7e8f9a0b1c2
Create Date: 2026-04-12 08:41:35.849540

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b62605d208fc'
down_revision = 'd7e8f9a0b1c2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'printer_environment',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['store_id'], ['store.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table(
        'printer',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('environment_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('baud_rate', sa.Integer(), nullable=True),
        sa.Column('description', sa.String(length=200), nullable=True),
        sa.Column('position', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['environment_id'], ['printer_environment.id'], ),
        sa.ForeignKeyConstraint(['store_id'], ['store.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('printer')
    op.drop_table('printer_environment')
