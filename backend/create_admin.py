from .database import SessionLocal
from .auth import get_password_hash
from .models import User

def create_admin():
    db = SessionLocal()
    # Check if admin already exists
    existing_admin = db.query(User).filter(User.username == "admin").first()
    if existing_admin:
        existing_admin.password_hash = get_password_hash("admin123")
        existing_admin.role = "superadmin"
        db.commit()
        print("Admin user updated to superadmin with new hashing scheme.")
    else:
        admin_user = User(
            username="admin",
            password_hash=get_password_hash("admin123"),
            role="superadmin",
            can_view_reports=True,
            can_manage_vouchers=True,
            can_manage_inventory=True,
            can_manage_masters=True
        )
        db.add(admin_user)
        db.commit()
        print("Admin user created as superadmin successfully.")
    db.close()

if __name__ == "__main__":
    create_admin()
