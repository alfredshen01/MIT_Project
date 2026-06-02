"""rename_email_to_username

Revision ID: a1b2c3d4e5f6
Revises: f5fd037e614b
Create Date: 2026-05-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f5fd037e614b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'email', new_column_name='username')


def downgrade() -> None:
    op.alter_column('users', 'username', new_column_name='email')
