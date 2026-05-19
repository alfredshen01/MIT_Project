"""add_user_id_to_events

Revision ID: f5fd037e614b
Revises: 807d732510ad
Create Date: 2026-05-19 16:12:07.829724

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5fd037e614b'
down_revision: Union[str, Sequence[str], None] = '807d732510ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('events', sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('events', 'user_id')
