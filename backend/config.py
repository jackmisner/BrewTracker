import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key")
    MONGO_URI = "mongodb://localhost:27017/brewtracker"
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt_dev_secret")
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1 hour


class TestConfig(Config):
    TESTING = True
    MONGO_URI = "mongodb://localhost:27017/brewtracker_test"
    JWT_SECRET_KEY = "test-jwt-secret-key"
    JWT_TOKEN_LOCATION = ["headers"]
