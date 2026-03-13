from database import SessionLocal
from auth import get_password_hash
from models import User

def create_admin():
    db = SessionLocal()
    # Check if admin already exists
    existing_admin = db.query(User).filter(User.username == "admin").first()
    if existing_admin:
        existing_admin.password_hash = get_password_hash("admin123")
        db.commit()
        print("Admin user updated with new hashing scheme.")
    else:
        admin_user = User(
            username="admin",
            password_hash=get_password_hash("admin123"),
            role="superadmin"
        )
        db.add(admin_user)
        db.commit()
        print("Admin user created successfully.")
    db.close()

if __name__ == "__main__":
    create_admin()
