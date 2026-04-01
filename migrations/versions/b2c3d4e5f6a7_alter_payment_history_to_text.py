"""alter payment_history to text

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f7
Create Date: 2026-04-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('table_payment_list', schema=None) as batch_op:
        batch_op.alter_column('payment_history',
                              existing_type=sa.String(length=512),
                              type_=sa.Text(),
                              existing_nullable=True)


def downgrade():
    with op.batch_alter_table('table_payment_list', schema=None) as batch_op:
        batch_op.alter_column('payment_history',
                              existing_type=sa.Text(),
                              type_=sa.String(length=512),
                              existing_nullable=True)
