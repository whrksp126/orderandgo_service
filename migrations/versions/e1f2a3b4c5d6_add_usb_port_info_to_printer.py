"""add usb_vendor_id and usb_product_id to printer

Revision ID: e1f2a3b4c5d6
Revises: b62605d208fc
Create Date: 2026-04-12 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e1f2a3b4c5d6'
down_revision = 'b62605d208fc'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('printer', sa.Column('usb_vendor_id', sa.Integer(), nullable=True))
    op.add_column('printer', sa.Column('usb_product_id', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('printer', 'usb_product_id')
    op.drop_column('printer', 'usb_vendor_id')
