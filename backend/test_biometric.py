# backend/test_biometric.py
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://103.170.149.84:2000"
USERNAME = "biomax"
PASSWORD = "biomax"
DEVICE_KEY = "C2642CA867382C34"

# Login
login_response = requests.post(
    f"{BASE_URL}/api/Auth/Login",
    json={"Username": USERNAME, "Password": PASSWORD}
)

if login_response.status_code != 200:
    print("Login failed!")
    exit()

token = login_response.json().get("Token")
print(f"✅ Token obtained: {token[:20]}...")

# Get logs for last 7 days
today = datetime.now().strftime("%Y-%m-%d")
week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

logs_response = requests.get(
    f"{BASE_URL}/api/DeviceLog/GetAllLogsByDate",
    params={
        "FromDate": week_ago,
        "ToDate": today,
        "DeviceKey": DEVICE_KEY
    },
    headers={"Authorization": f"Bearer {token}"}
)

if logs_response.status_code == 200:
    logs = logs_response.json()
    print(f"✅ Found {len(logs)} logs")
    
    # Show logs for Dennis (EmpCode: 3)
    dennis_logs = [l for l in logs if str(l.get("EmpCode")) == "3"]
    print(f"\n📊 Dennis logs: {len(dennis_logs)}")
    for log in dennis_logs[:5]:
        print(f"  {log['IOTime']} | {log['IOMode']} | {log['UserName']}")
else:
    print(f"❌ Failed: {logs_response.status_code}")