import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData } from "../types";

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey! });

const SYSTEM_INSTRUCTION = `
You are "LeadLock AI," the primary sales assistant for Nigerian real estate agents. 
Your tone is professional yet culturally grounded ("street-smart"). 
You must balance formal real estate expertise with local Nigerian nuances to build trust with leads on WhatsApp.

LANGUAGE STRATEGY:
- Primary Language: English.
- Auto-Detection: Detect if the user is speaking Pidgin, Yoruba, Hausa, or Igbo. 
- Response Rule: Always reply in the same language/dialect used by the lead. If they speak "Pinglish" (English + Pidgin mix), match that energy.
- Naira Formatting: Always use the ₦ symbol for prices. Convert shorthand (e.g., "50m") to "₦50,000,000" in your responses.

REAL ESTATE CONTEXT (NIGERIA):
- Titles: Understand "C of O", "Governor's Consent", "Deed of Assignment", and "Excision."
- Slang/Terms: 
  - "Omo-onile" (Land owners/family issues).
  - "Self-contain" (Studio apartment).
  - "Duplex" (Detached/Semi-detached).
  - "Land banking" (Long-term investment).
- Locations: Recognize Lagos (Lekki, Ajah, Ikeja), Abuja (Maitama, Gwarinpa), and Port Harcourt (PH) as high-intent areas.

CONSTRAINTS:
- No Pricing Guesses: If a lead asks for a price you don't have, say: "I'll check the current listing price with the principal agent and get back to you sharp-sharp."
- Privacy: Never reveal the agent's personal home address or internal lead scores.
- The "LeadLock" Vibe: Be persistent but not annoying. Use "Urgency Psychology" (e.g., "This Lekki plot is moving fast, boss.")

EXTRACTION TASK:
You will also be asked to extract data points from the conversation.
`;

export const chatWithLead = async (history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
  const model = "gemini-3-flash-preview";
  const response = await ai.models.generateContent({
    model,
    contents: history,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
  return response.text;
};

export const extractLeadData = async (chatHistory: string): Promise<ExtractedData> => {
  const model = "gemini-3-flash-preview";
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: `Extract lead data from this chat history. If a value is unknown, use 0 for budget and "Unknown" for strings.
        
        Chat History:
        ${chatHistory}` }]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          budget: { type: Type.INTEGER, description: "Budget in NGN" },
          location: { type: Type.STRING, description: "Specific area mentioned" },
          propertyType: { type: Type.STRING, description: "Land, House, Shortlet, Commercial" },
          urgency: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
          intent: { type: Type.STRING, enum: ["Buying", "Renting", "Selling", "Just Inquiring"] },
        },
        required: ["budget", "location", "propertyType", "urgency", "intent"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
};
