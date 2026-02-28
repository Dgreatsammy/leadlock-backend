export interface Lead {
  id: number;
  name: string;
  phone: string;
  budget: number;
  location: string;
  property_type: string;
  urgency: 'High' | 'Medium' | 'Low';
  intent: 'Buying' | 'Renting' | 'Selling' | 'Just Inquiring';
  raw_chat: string;
  created_at: string;
}

export interface Message {
  id?: number;
  lead_id?: number;
  role: 'user' | 'model';
  content: string;
  created_at?: string;
}

export interface ExtractedData {
  budget: number;
  location: string;
  propertyType: string;
  urgency: 'High' | 'Medium' | 'Low';
  intent: 'Buying' | 'Renting' | 'Selling' | 'Just Inquiring';
}
