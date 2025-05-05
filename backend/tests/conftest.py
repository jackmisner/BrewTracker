import pytest
from app import create_app
from models import db
import config


@pytest.fixture
def app():
    app = create_app(config.TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()
