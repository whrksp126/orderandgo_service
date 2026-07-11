"""add carryover_deletion_log (이전 영업일 미결제/미완료 삭제 이력)

Revision ID: carryover_del_log_01
Revises: a1b2c3d4e5f6
Create Date: 2026-07-11 13:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'carryover_del_log_01'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'carryover_deletion_log',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('table_id', sa.Integer(), nullable=True),
        sa.Column('table_name', sa.String(length=100), nullable=True),
        sa.Column('business_day', sa.String(length=10), nullable=True),
        sa.Column('order_summary', sa.Text(), nullable=True),
        sa.Column('order_count', sa.Integer(), nullable=True),
        sa.Column('first_order_time', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['store_id'], ['store.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('carryover_deletion_log')
