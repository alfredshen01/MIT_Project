"""create_users_table

Revision ID: 807d732510ad
Revises: b61ec4551e40
Create Date: 2026-05-19 16:12:07.725626

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '807d732510ad'
down_revision: Union[str, Sequence[str], None] = 'b61ec4551e40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('email', sa.String, nullable=False, unique=True),
        sa.Column('hashed_password', sa.String, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('users')
