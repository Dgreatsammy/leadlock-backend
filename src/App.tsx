import { useState, useEffect, useRef, FormEvent } from 'react';
import { 
  MessageSquare, 
  Users, 
  Send, 
  TrendingUp, 
  MapPin, 
  Home, 
  Clock, 
  DollarSign,
  ChevronRight,
  LayoutDashboard,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { chatWithLead, extractLeadData } from './services/geminiService';
import { Lead, Message, ExtractedData } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'leads'>('chat');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [currentLeadId, setCurrentLeadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    if (currentLeadId) {
      fetchMessages(currentLeadId);
    }
  }, [currentLeadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const fetchMessages = async (id: number) => {
    try {
      const res = await fetch(`/api/leads/${id}/messages`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessage: Message = { role: 'user', content: inputText };
    
    // If no lead selected, create one
    let leadId = currentLeadId;
    if (!leadId) {
      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Lead', raw_chat: inputText }),
        });
        const data = await res.json();
        leadId = data.id;
        setCurrentLeadId(leadId);
        fetchLeads();
      } catch (error) {
        console.error('Error creating lead:', error);
        return;
      }
    }

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      // Save user message
      await fetch(`/api/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userMessage),
      });

      // Get AI response
      const history = messages.concat(userMessage).map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      
      const aiResponseText = await chatWithLead(history);
      const aiMessage: Message = { role: 'model', content: aiResponseText || '' };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Save AI message
      await fetch(`/api/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiMessage),
      });

      // Silent Extraction
      const fullChat = messages.concat(userMessage, aiMessage).map(m => `${m.role}: ${m.content}`).join('\n');
      const extracted = await extractLeadData(fullChat);
      
      // Update lead data in DB
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: extracted.budget,
          location: extracted.location,
          property_type: extracted.propertyType,
          urgency: extracted.urgency,
          intent: extracted.intent
        }),
      });

      fetchLeads(); // Refresh dashboard data

    } catch (error) {
      console.error('Error in chat flow:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const filteredLeads = leads.filter(l => 
    l.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.property_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-zinc-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-20 bg-zinc-900 flex flex-col items-center py-8 gap-8 text-zinc-400">
        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
          <TrendingUp size={24} />
        </div>
        
        <button 
          onClick={() => setActiveTab('chat')}
          className={`p-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-zinc-800 text-emerald-400' : 'hover:bg-zinc-800 hover:text-white'}`}
        >
          <MessageSquare size={24} />
        </button>
        
        <button 
          onClick={() => setActiveTab('leads')}
          className={`p-3 rounded-xl transition-all ${activeTab === 'leads' ? 'bg-zinc-800 text-emerald-400' : 'hover:bg-zinc-800 hover:text-white'}`}
        >
          <LayoutDashboard size={24} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'chat' ? (
          <>
            {/* Chat List */}
            <div className="w-80 bg-white border-r border-zinc-200 flex flex-col">
              <div className="p-6 border-b border-zinc-100">
                <h1 className="text-2xl font-display font-bold text-zinc-900">LeadLock AI</h1>
                <p className="text-sm text-zinc-500 mt-1">Nigerian Real Estate Assistant</p>
              </div>
              
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search leads..." 
                    className="w-full pl-10 pr-4 py-2 bg-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredLeads.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => setCurrentLeadId(lead.id)}
                    className={`w-full p-4 flex items-start gap-3 border-b border-zinc-50 transition-colors ${currentLeadId === lead.id ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-zinc-50'}`}
                  >
                    <div className="w-10 h-10 bg-zinc-200 rounded-full flex-shrink-0 flex items-center justify-center text-zinc-600 font-bold">
                      {lead.name[0]}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-zinc-900 truncate">{lead.name}</span>
                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{lead.location} • {lead.property_type}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 flex flex-col bg-white relative">
              {currentLeadId ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold">
                        {leads.find(l => l.id === currentLeadId)?.name[0]}
                      </div>
                      <div>
                        <h2 className="font-bold text-zinc-900">{leads.find(l => l.id === currentLeadId)?.name}</h2>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          Online
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-bold text-zinc-500 uppercase">
                        {leads.find(l => l.id === currentLeadId)?.urgency} Urgency
                      </div>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-6 whatsapp-bg">
                    <div className="flex flex-col gap-4">
                      {messages.map((msg, idx) => (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${
                            msg.role === 'user' 
                              ? 'bg-emerald-500 text-white rounded-tr-none' 
                              : 'bg-white text-zinc-800 rounded-tl-none'
                          }`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            <div className={`text-[10px] mt-1 flex justify-end ${msg.role === 'user' ? 'text-emerald-100' : 'text-zinc-400'}`}>
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                            <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" />
                            <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Input Area */}
                  <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-zinc-100 flex gap-3">
                    <input
                      type="text"
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-3 bg-zinc-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                    <button 
                      type="submit"
                      disabled={!inputText.trim() || isTyping}
                      className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
                  <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
                    <MessageSquare size={40} className="text-zinc-200" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-zinc-900 mb-2">Welcome to LeadLock AI</h3>
                  <p className="max-w-xs text-sm">Select a lead from the sidebar or start a new conversation to begin qualifying.</p>
                  <button 
                    onClick={() => {
                      const name = prompt("Enter lead name (optional):") || "New Lead";
                      fetch('/api/leads', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name }),
                      }).then(res => res.json()).then(data => {
                        setCurrentLeadId(data.id);
                        fetchLeads();
                      });
                    }}
                    className="mt-8 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                  >
                    Start New Conversation
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Leads Dashboard */
          <div className="flex-1 bg-zinc-50 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h1 className="text-3xl font-display font-bold text-zinc-900">Lead Dashboard</h1>
                  <p className="text-zinc-500 mt-1">Real-time qualification insights</p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Leads</div>
                      <div className="text-2xl font-display font-bold text-zinc-900">{leads.length}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leads.map(lead => (
                  <motion.div
                    layout
                    key={lead.id}
                    className="bg-white rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-600 font-bold text-lg">
                            {lead.name[0]}
                          </div>
                          <div>
                            <h3 className="font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">{lead.name}</h3>
                            <p className="text-xs text-zinc-500">{new Date(lead.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          lead.urgency === 'High' ? 'bg-red-100 text-red-600' : 
                          lead.urgency === 'Medium' ? 'bg-orange-100 text-orange-600' : 
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {lead.urgency}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <MapPin size={16} className="text-zinc-400" />
                          <span>{lead.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <Home size={16} className="text-zinc-400" />
                          <span>{lead.property_type}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <DollarSign size={16} className="text-zinc-400" />
                          <span className="font-mono font-bold text-emerald-600">
                            ₦{lead.budget.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <Clock size={16} className="text-zinc-400" />
                          <span>{lead.intent}</span>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setCurrentLeadId(lead.id);
                        setActiveTab('chat');
                      }}
                      className="w-full py-3 bg-zinc-50 border-t border-zinc-100 text-xs font-bold text-zinc-500 uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      View Conversation <ChevronRight size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
