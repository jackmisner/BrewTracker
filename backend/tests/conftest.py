import pytest
from lib.database_connection import DatabaseConnection

# This is a Pytest fixture.
# It creates an object that we can use in our tests.
# We will use it to create a database connection.
@pytest.fixture
def db_connection():
    conn = DatabaseConnection()
    conn.connect()
    return conn

# Now, when we create a test, if we allow it to accept a parameter called `db_connection`,
# Pytest will automatically pass in the object we created above.

# For example:

# def test_something(db_connection):
#     # db_connection is now available to us in this test.
