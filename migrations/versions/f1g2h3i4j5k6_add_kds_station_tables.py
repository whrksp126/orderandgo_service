"""add kds_station tables

Revision ID: f1g2h3i4j5k6
Revises: b62605d208fc
Create Date: 2026-04-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1g2h3i4j5k6'
down_revision = 'b62605d208fc'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'kds_station',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('show_all', sa.Boolean(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['store_id'], ['store.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table(
        'kds_station_menu',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('station_id', sa.Integer(), nullable=False),
        sa.Column('menu_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['menu_id'], ['menu.id'], ),
        sa.ForeignKeyConstraint(['station_id'], ['kds_station.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table(
        'kds_station_staff_call',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('station_id', sa.Integer(), nullable=False),
        sa.Column('staff_call_item_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['staff_call_item_id'], ['staff_call_item.id'], ),
        sa.ForeignKeyConstraint(['station_id'], ['kds_station.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('kds_station_staff_call')
    op.drop_table('kds_station_menu')
    op.drop_table('kds_station')
