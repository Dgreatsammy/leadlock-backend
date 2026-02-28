import requests

# 1. REPLACE with your actual Render URL
RENDER_URL = "https://leadlock-ai.onrender.com" 

# 2. Mock data to simulate a real lead chat
test_data = {
    "chat_text": "My name is Kunle, looking for a 2-bedroom flat in Lekki Phase 1. Budget is 5 million Naira. Need it urgently.",
    "company_id": "test_agency_001"
}

print(f"🚀 Testing LeadLock AI at: {RENDER_URL}")

try:
    # Send the request to your LIVE Render backend
    response = requests.post(f"{RENDER_URL}/process-lead", json=test_data)
    
    if response.status_code == 200:
        print("✅ SUCCESS: Lead Locked!")
        print("AI Result:", response.json())
    else:
        print(f"❌ FAILED: Status {response.status_code}")
        print("Error Detail:", response.text)

except Exception as e:
    print(f"⚠️ ERROR: Could not connect to the server. {e}")