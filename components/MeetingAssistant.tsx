import * as React from 'react';
import { getMeetingAssistantResponse } from '../services/geminiService';
import { ChatMessage } from '../types';

interface MeetingAssistantProps {
  chatHistory: ChatMessage[];
}

const MeetingAssistant: React.FC<MeetingAssistantProps> = ({ chatHistory }) => {
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [responses, setResponses] = React.useState<{ query: string; answer: string }[]>([]);

  const handleAsk = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    const historyText = chatHistory.map(m => `${m.sender}: ${m.text}`).join('\n');
    const answer = await getMeetingAssistantResponse(historyText, query);
    
    setResponses(prev => [{ query, answer }, ...prev]);
    setQuery('');
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700 w-80">
      <div className="p-4 border-b border-gray-700 flex items-center gap-2">
        <i className="fas fa-robot text-blue-400"></i>
        <h2 className="font-bold">Assistente AI</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {responses.length === 0 && (
          <div className="text-gray-500 text-sm text-center mt-10 italic">
            Chiedimi di riassumere la chat o di creare dei punti d'azione.
          </div>
        )}
        
        {responses.map((res, i) => (
          <div key={i} className="space-y-2">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Hai chiesto</div>
            <div className="text-sm bg-gray-800 p-2 rounded-lg">{res.query}</div>
            <div className="text-xs font-bold text-green-400 uppercase tracking-wider">Assistente AI</div>
            <div className="text-sm bg-blue-900/20 p-2 rounded-lg border border-blue-800/50">
              {res.answer}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700 bg-gray-800/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="Riassumi questa chiamata..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAsk}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 p-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingAssistant;