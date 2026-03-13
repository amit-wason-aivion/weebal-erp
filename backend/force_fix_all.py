import os
import sys
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.sql.sqltypes import String, Numeric, Integer, Boolean, Date
from dotenv import load_dotenv

# Ensure we load the correct .env
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")
print(f"DEBUG: Connecting to {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def get_sql_type(column):
    col_type = column.type
    if isinstance(col_type, String):
        if col_type.length:
            return f"VARCHAR({col_type.length})"
        return "TEXT"
    if isinstance(col_type, Numeric):
        return f"NUMERIC({col_type.precision}, {col_type.scale})"
    if isinstance(col_type, Integer):
        return "INTEGER"
    if isinstance(col_type, Boolean):
        return "BOOLEAN"
    if isinstance(col_type, Date):
        return "DATE"
    return str(col_type)

def force_migrate():
    # Add backend to path to import models
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from backend.models import Base
    
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        for table_name, table in Base.metadata.tables.items():
            print(f"Checking Table: {table_name}")
            try:
                existing_columns = {col['name'] for col in inspector.get_columns(table_name)}
            except:
                print(f"  Table {table_name} does not exist yet. Creating all...")
                Base.metadata.create_all(bind=engine, tables=[table])
                continue

            for column in table.columns:
                if column.name not in existing_columns:
                    print(f"  [MISSING] {column.name}")
                    col_type_str = get_sql_type(column)
                    
                    default_clause = ""
                    if column.default is not None and hasattr(column.default, 'arg'):
                        arg = column.default.arg
                        if isinstance(arg, bool):
                            default_clause = f" DEFAULT {'TRUE' if arg else 'FALSE'}"
                        elif isinstance(arg, (int, float)):
                            default_clause = f" DEFAULT {arg}"
                        elif isinstance(arg, str):
                            default_clause = f" DEFAULT '{arg}'"
                    
                    sql = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column.name} {col_type_str}{default_clause}"
                    print(f"  [EXECUTING] {sql}")
                    try:
                        conn.execute(text(sql))
                        print(f"  [SUCCESS] Added {column.name}")
                    except Exception as e:
                        print(f"  [ERROR] Failed to add {column.name}: {e}")
        
        conn.commit()
    print("Force migration completed.")

if __name__ == "__main__":
    force_migrate()
