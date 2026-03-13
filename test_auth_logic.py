import sys
import os
from unittest.mock import MagicMock

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.auth import get_current_company

class MockUser:
    def __init__(self, role, company_id):
        self.role = role
        self.company_id = company_id

# Test cases: (role, company_id, header_id, expected, description)
test_cases = [
    ("superadmin", None, 1, 1, "Superadmin with header"),
    ("Superadmin", None, 1, 1, "Capitalized Superadmin with header"),
    ("admin", None, 1, 1, "Admin with header"),
    ("Admin", 2, 1, 1, "Capitalized Admin with header override"),
    ("Operator", 1, None, 1, "Operator with assigned ID"),
    ("Operator", None, 1, "EXCEPTION", "Operator without assigned ID"),
    ("superadmin", None, None, "EXCEPTION", "Superadmin without any ID"),
]

print("--- Testing get_current_company logic ---")
for role, user_cid, header_cid, expected, desc in test_cases:
    user = MockUser(role, user_cid)
    try:
        # Mock Header dependency
        res = get_current_company(current_user=user, x_company_id=header_cid)
        status = "PASS" if res == expected else "FAIL"
        print(f"[{status}] {desc}: Result={res}, Expected={expected}")
    except Exception as e:
        status = "PASS" if expected == "EXCEPTION" else "FAIL"
        print(f"[{status}] {desc}: Exception={e}, Expected={expected}")
