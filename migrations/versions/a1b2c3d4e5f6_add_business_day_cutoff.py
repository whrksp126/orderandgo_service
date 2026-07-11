"""add business_day_cutoff to store (영업일 변경 기준 시각)

Revision ID: a1b2c3d4e5f6
Revises: f2a3b4c5d6e7
Create Date: 2026-07-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('store', schema=None) as batch_op:
        batch_op.add_column(sa.Column('business_day_cutoff', sa.String(length=5), nullable=True))


def downgrade():
    with op.batch_alter_table('store', schema=None) as batch_op:
        batch_op.drop_column('business_day_cutoff')
