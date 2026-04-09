"""add table_name to table_payment_list

Revision ID: d7e8f9a0b1c2
Revises: c6e4d7c0ac8b
Create Date: 2026-04-09 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd7e8f9a0b1c2'
down_revision = 'c6e4d7c0ac8b'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('table_payment_list', schema=None) as batch_op:
        batch_op.add_column(sa.Column('table_name', sa.String(length=100), nullable=True))


def downgrade():
    with op.batch_alter_table('table_payment_list', schema=None) as batch_op:
        batch_op.drop_column('table_name')
