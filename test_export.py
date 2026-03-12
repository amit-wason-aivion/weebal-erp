import requests

BASE_URL = "http://127.0.0.1:8000"

def test_export():
    # 1. Login
    login_url = f"{BASE_URL}/api/login"
    data = {
        "username": "superadmin",
        "password": "admin123"
    }
    try:
        r = requests.post(login_url, data=data)
        if r.status_code != 200:
            print(f"Login Failed: {r.text}")
            return
        
        token = r.json().get("access_token")
        
        # 2. Test Export
        export_url = f"{BASE_URL}/api/sync/export-app-data?company_id=1"
        headers = {"Authorization": f"Bearer {token}", "X-Company-ID": "1"}
        r = requests.get(export_url, headers=headers)
        print(f"Export Status: {r.status_code}")
        if r.status_code == 200:
            keys = list(r.json().keys())
            print(f"Keys in JSON: {keys}")
            if "company" in keys:
                print(f"Company Info: {r.json()['company']['name']}")
            else:
                print("FAILED: Company key missing")
        else:
            print(f"Export Failed: {r.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_export()
