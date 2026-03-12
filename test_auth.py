import requests

BASE_URL = "http://127.0.0.1:8000"

def test_auth():
    # 1. Login
    login_url = f"{BASE_URL}/api/login"
    data = {
        "username": "superadmin",
        "password": "superadminpassword" # Assuming this is the password from previous context or seeders
    }
    # Note: Login expects form-data
    try:
        print("Attempting login...")
        r = requests.post(login_url, data=data)
        print(f"Login Status: {r.status_code}")
        if r.status_code != 200:
            print(f"Login Failed: {r.text}")
            return
        
        token = r.json().get("access_token")
        print(f"Token obtained: {token[:20]}...")
        
        # 2. Test Ledgers with token
        ledgers_url = f"{BASE_URL}/api/ledgers?company_id=1"
        headers = {"Authorization": f"Bearer {token}"}
        print("Attempting to fetch ledgers...")
        r = requests.get(ledgers_url, headers=headers)
        print(f"Ledgers Status: {r.status_code}")
        print(f"Response: {r.text[:200]}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_auth()
