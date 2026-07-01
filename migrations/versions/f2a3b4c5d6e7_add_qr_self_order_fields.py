"""add QR self-order fields (table qr_token, store geofence)

Revision ID: f2a3b4c5d6e7
Revises: f1g2h3i4j5k6
Create Date: 2026-07-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2a3b4c5d6e7'
down_revision = 'f1g2h3i4j5k6'
branch_labels = None
depends_on = None


def upgrade():
    # 테이블별 QR 토큰 ('table'은 예약어라 batch_alter_table로 안전 처리)
    with op.batch_alter_table('table', schema=None) as batch_op:
        batch_op.add_column(sa.Column('qr_token', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('qr_generated_at', sa.DateTime(), nullable=True))
        batch_op.create_index(batch_op.f('ix_table_qr_token'), ['qr_token'], unique=True)

    # 매장 지오펜스(가짜 주문 방지)
    with op.batch_alter_table('store', schema=None) as batch_op:
        batch_op.add_column(sa.Column('latitude', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('longitude', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('geofence_radius_m', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('qr_geofence_enabled', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('qr_require_open_session', sa.Boolean(), nullable=True))


def downgrade():
    with op.batch_alter_table('store', schema=None) as batch_op:
        batch_op.drop_column('qr_require_open_session')
        batch_op.drop_column('qr_geofence_enabled')
        batch_op.drop_column('geofence_radius_m')
        batch_op.drop_column('longitude')
        batch_op.drop_column('latitude')

    with op.batch_alter_table('table', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_table_qr_token'))
        batch_op.drop_column('qr_generated_at')
        batch_op.drop_column('qr_token')
