import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from urllib.parse import urlparse, unquote
from .models import Base

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database Connection String
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/aivion_erp")

def create_database_if_not_exists(db_url):
    parsed = urlparse(db_url)
    db_name = parsed.path.lstrip('/')
    user = unquote(parsed.username) if parsed.username else None
    password = unquote(parsed.password) if parsed.password else None
    host = parsed.hostname
    port = parsed.port or 5432

    # Connect to the default 'postgres' database to create the new one
    try:
        conn = psycopg2.connect(
            dbname='postgres',
            user=user,
            password=password,
            host=host,
            port=port
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        # Check if database exists
        cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{db_name}'")
        exists = cur.fetchone()
        if not exists:
            print(f"Database '{db_name}' not found. Creating it automatically...")
            cur.execute(f"CREATE DATABASE {db_name}")
            print(f"Database '{db_name}' created successfully.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Warning: Could not check/create database automatically. Ensure Postgres is running. Error: {e}")

# Try to auto-create the database before connecting via SQLAlchemy
create_database_if_not_exists(SQLALCHEMY_DATABASE_URL)

engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    # Only use create_all for simple setups/tests. Migrations should use Alembic.
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
