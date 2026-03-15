import requests

API_URL = "https://accounts-api.weebalinfotech.com"

try:
    auth_response = requests.post(
        f"{API_URL}/api/token", 
        data={"username": "superadmin", "password": "password"} # Try default or empty if not working
    )
    
    if auth_response.status_code == 200:
        token = auth_response.json().get("access_token")
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{API_URL}/api/vouchers/4", headers=headers)
        print("Status Code:", resp.status_code)
        print("Response:", resp.text)
    else:
        print("Auth failed:", auth_response.status_code, auth_response.text)
except Exception as e:
    print("Error:", str(e))
