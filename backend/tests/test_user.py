import pytest
from models.user import User
from models import db


def test_email_unique_constraint(app):
    # Create first user
    user1 = User(
        username="testuser1", email="test1@example.com", password_hash="dummy_hash"
    )
    db.session.add(user1)
    db.session.commit()

    # Try to create second user with same email
    user2 = User(
        username="testuser2", email="test1@example.com", password_hash="dummy_hash"
    )
    db.session.add(user2)

    # Should raise IntegrityError due to unique constraint
    with pytest.raises(Exception):
        db.session.commit()

    db.session.rollback()


def test_email_not_nullable(app):
    # Try to create user without email
    user = User(username="testuser", password_hash="dummy_hash")
    db.session.add(user)

    # Should raise IntegrityError due to nullable=False
    with pytest.raises(Exception):
        db.session.commit()

    db.session.rollback()


def test_email_max_length(app):
    # Try to create user with email > 120 chars
    long_email = "a" * 110 + "@example.com"  # 121 chars
    user = User(username="testuser", email=long_email, password_hash="dummy_hash")
    db.session.add(user)

    # Should raise DataError due to max length
    with pytest.raises(Exception):
        db.session.commit()

    db.session.rollback()
