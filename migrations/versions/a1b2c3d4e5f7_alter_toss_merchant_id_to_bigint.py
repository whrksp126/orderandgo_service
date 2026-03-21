"""alter toss_merchant_id to bigint

Revision ID: a1b2c3d4e5f7
Revises: 08f669ab058f
Create Date: 2026-03-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('store', schema=None) as batch_op:
        batch_op.alter_column('toss_merchant_id',
                              existing_type=sa.Integer(),
                              type_=sa.BigInteger(),
                              existing_nullable=True)


def downgrade():
    with op.batch_alter_table('store', schema=None) as batch_op:
        batch_op.alter_column('toss_merchant_id',
                              existing_type=sa.BigInteger(),
                              type_=sa.Integer(),
                              existing_nullable=True)
