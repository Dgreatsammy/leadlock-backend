import os
import json
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# 1. SETUP CONNECTIONS
app = FastAPI()

# --- CORS MIDDLEWARE (Added for Frontend Access) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows AI Studio and other frontends to talk to your API
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# 2. YOUR LEADLOCK PERSONA
LEADLOCK_PROMPT = """
## Identity
You are "LeadLock AI," the primary AI revenue intelligence assistant for Nigerian real estate agents. 
Your goal is to extract structured data from messy chat conversations.

## Task 1: Internal Lead Qualification
Extract the following JSON ONLY. No markdown. No extra text.
{
  "full_name": "string",
  "phone_number": "string",
  "budget_ngn": integer,
  "preferred_location": "string",
  "prop_type": "land|self_contain|flat|duplex|terrace|commercial|shortlet",
  "urgency_score": integer,
  "summary": "string"
}
"""

class ManualLead(BaseModel):
    chat_text: str
    company_id: str  # The ID of the agent/company in Supabase

@app.get("/")
async def root():
    return {"message": "LeadLock AI Backend is Live!"}

@app.post("/process-lead")
async def process_lead(data: ManualLead):
    try:
        # A. SEND TO AI
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(
            f"{LEADLOCK_PROMPT}\n\nPROCESS THIS CHAT:\n{data.chat_text}",
            generation_config={"response_mime_type": "application/json"}
        )
        
        # B. PARSE AI JSON
        lead_data = json.loads(response.text)
        
        # C. SAVE TO SUPABASE
        db_payload = {
            "company_id": data.company_id,
            "full_name": lead_data.get("full_name", "Unknown"),
            "phone_number": lead_data.get("phone_number", "Not provided"),
            "budget_ngn": lead_data.get("budget_ngn"),
            "preferred_location": lead_data.get("preferred_location"),
            "prop_type": lead_data.get("prop_type"),
            "urgency_score": lead_data.get("urgency_score"),
            "summary": lead_data.get("summary")
        }
        
        result = supabase.table("leads").insert(db_payload).execute()
        
        return {"status": "Lead Locked", "data": result.data}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# KEEP YOUR WEBHOOK HANDSHAKE FOR LATER
@app.get("/webhook/whatsapp")
async def verify(request: Request):
    return request.query_params.get("hub.challenge")