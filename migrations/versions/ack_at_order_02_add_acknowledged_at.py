"""add acknowledged_at to order (POS 알림 확인 시각, 조리완료와 분리)

Revision ID: ack_at_order_02
Revises: carryover_del_log_01
Create Date: 2026-07-11 14:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ack_at_order_02'
down_revision = 'carryover_del_log_01'
branch_labels = None
depends_on = None


def upgrade():
    # 컬럼 존재 시 건너뜀(멱등)
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('order')]
    if 'acknowledged_at' in cols:
        return
    with op.batch_alter_table('order', schema=None) as batch_op:
        batch_op.add_column(sa.Column('acknowledged_at', sa.DateTime(), nullable=True))


def downgrade():
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('order')]
    if 'acknowledged_at' not in cols:
        return
    with op.batch_alter_table('order', schema=None) as batch_op:
        batch_op.drop_column('acknowledged_at')
