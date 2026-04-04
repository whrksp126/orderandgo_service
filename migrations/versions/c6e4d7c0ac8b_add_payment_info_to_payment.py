"""add payment_info to payment

Revision ID: c6e4d7c0ac8b
Revises: c3d4e5f6a7b8
Create Date: 2026-04-03 10:44:21.956710

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c6e4d7c0ac8b'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('payment', schema=None) as batch_op:
        batch_op.add_column(sa.Column('payment_info', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('payment', schema=None) as batch_op:
        batch_op.drop_column('payment_info')
