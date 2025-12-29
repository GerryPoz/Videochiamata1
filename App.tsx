
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Participant, ChatMessage, AppState } from './types';
import VideoPlayer from './components/VideoPlayer';
import MeetingAssistant from './components/MeetingAssistant';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LOBBY);
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Sincronizza lo stato con la rappresentazione del partecipante locale
  useEffect(() => {
    if (appState === AppState.IN_ROOM && localStream) {
      const me: Participant = {
        id: 'me',
        name: userName || 'Tu',
        stream: localStream,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing
      };
      setParticipants(prev => {
        const others = prev.filter(p => p.id !== 'me');
        return [me, ...others];
      });
    }
  }, [isAudioMuted, isVideoMuted, isScreenSharing, appState, localStream, userName]);

  // Gestione URL hash per stanze dirette
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setRoomId(hash);
    }
  }, []);

  const createRoom = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    window.location.hash = newId;
    setRoomId(newId);
  };

  const initMedia = async () => {
    try {
      // Pulizia tracce esistenti
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Sincronizzazione stati UI con hardware
      stream.getAudioTracks().forEach(t => t.enabled = !isAudioMuted);
      stream.getVideoTracks().forEach(t => t.enabled = !isVideoMuted);
      
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Errore acquisizione media:", err);
      alert("Impossibile accedere ai dispositivi multimediali. Controlla i permessi della fotocamera e del microfono.");
      return null;
    }
  };

  const joinRoom = async () => {
    if (!userName.trim()) {
      alert("Per favore, inserisci un nome per farti riconoscere.");
      return;
    }
    const stream = await initMedia();
    if (stream) {
      setAppState(AppState.IN_ROOM);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const newState = !isAudioMuted;
      localStream.getAudioTracks().forEach(track => (track.enabled = !newState));
      setIsAudioMuted(newState);
    }
  };

  const toggleVideo = () => {
    if (localStream && !isScreenSharing) {
      const newState = !isVideoMuted;
      localStream.getVideoTracks().forEach(track => (track.enabled = !newState));
      setIsVideoMuted(newState);
    }
  };

  const toggleScreenShare = async () => {
    // Controllo disponibilità API nel browser/ambiente corrente
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert("La condivisione dello schermo non è supportata in questo browser o ambiente di anteprima.");
      return;
    }

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: {
            cursor: "always"
          } as any,
          audio: false // Disabilitato audio sistema per evitare blocchi di sicurezza comuni
        });

        const micTrack = localStream?.getAudioTracks()[0];
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        // Creazione stream ibrido (Schermo + Microfono locale)
        const combinedTracks = [screenVideoTrack];
        if (micTrack) combinedTracks.push(micTrack);
        
        const combinedStream = new MediaStream(combinedTracks);
        
        // Prima fermiamo la webcam locale per liberare risorse
        localStream?.getVideoTracks().forEach(t => t.stop());

        setIsScreenSharing(true);
        setIsVideoMuted(false); 
        setLocalStream(combinedStream);
        
        screenVideoTrack.onended = () => {
          stopScreenSharing();
        };
      } catch (err) {
        console.warn("Condivisione schermo annullata o fallita:", err);
      }
    } else {
      await stopScreenSharing();
    }
  };

  const stopScreenSharing = async () => {
    setIsScreenSharing(false);
    // Fermiamo le tracce della condivisione
    localStream?.getTracks().forEach(track => track.stop());
    // Riattiviamo la webcam standard
    await initMedia();
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${roomId}`;
    navigator.clipboard.writeText(url);
    alert("Link copiato! Condividilo con chi vuoi invitare alla videochiamata.");
  };

  const leaveRoom = () => {
    localStream?.getTracks().forEach(t => t.stop());
    setAppState(AppState.LOBBY);
    setParticipants([]);
    window.location.hash = '';
  };

  if (appState === AppState.LOBBY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6 font-sans">
        <div className="max-w-md w-full bg-gray-900 rounded-[2.5rem] p-10 shadow-2xl border border-gray-800">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20 rotate-3">
              <i className="fas fa-video text-4xl text-white"></i>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">
              Gemini <span className="text-blue-500">Connect</span>
            </h1>
            <p className="text-gray-400 font-medium">Videochiamate HD e assistenza AI</p>
          </div>

          <div className="space-y-6">
            <div className="group">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1 group-focus-within:text-blue-400 transition-colors">Nome Utente</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                placeholder="Come ti chiami?"
                className="w-full bg-gray-800 border-2 border-transparent rounded-2xl px-5 py-4 text-white focus:border-blue-500 focus:bg-gray-800/50 focus:outline-none transition-all placeholder-gray-600 text-lg"
              />
            </div>

            {roomId ? (
              <div className="space-y-4 pt-2">
                <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-blue-400 font-bold uppercase block">ID Stanza</span>
                    <span className="text-xl font-mono font-bold text-white tracking-wider">{roomId}</span>
                  </div>
                  <i className="fas fa-door-open text-blue-500 text-xl"></i>
                </div>
                <button
                  onClick={joinRoom}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-blue-600/30 transform hover:-translate-y-1 active:scale-95 text-lg"
                >
                  Entra nella Riunione
                </button>
              </div>
            ) : (
              <button
                onClick={createRoom}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-600/30 transform hover:-translate-y-1 active:scale-95 text-lg"
              >
                Inizia Nuova Riunione
              </button>
            )}
          </div>

          <div className="mt-12 text-center">
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Powered by Gemini AI Engine</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden font-sans">
      {/* Header */}
      <div className="h-20 flex items-center justify-between px-8 bg-gray-900/50 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i className="fas fa-video text-white"></i>
          </div>
          <div>
            <h2 className="font-bold text-white text-lg leading-none">Meeting {roomId}</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                {participants.length} Presente/i
               </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={copyInviteLink}
            className="flex items-center gap-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl transition-all border border-white/10"
          >
            <i className="fas fa-user-plus text-blue-400"></i>
            Invita
          </button>
          <button 
            onClick={() => setShowAiAssistant(!showAiAssistant)}
            className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-all border ${showAiAssistant ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`}
          >
            <i className="fas fa-robot"></i>
            Assistente AI
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-8 overflow-y-auto">
          <div className={`grid gap-6 h-full content-center ${
            participants.length <= 1 ? 'max-w-4xl mx-auto grid-cols-1' :
            participants.length <= 2 ? 'grid-cols-1 lg:grid-cols-2' :
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}>
            {participants.map(p => (
              <VideoPlayer key={p.id} participant={p} isLocal={p.id === 'me'} />
            ))}
          </div>
        </div>

        {showAiAssistant && (
          <div className="animate-in slide-in-from-right duration-300">
            <MeetingAssistant chatHistory={chatHistory} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-28 bg-gray-900 border-t border-white/5 flex items-center justify-center gap-8 px-10 relative">
        <div className="flex items-center gap-5">
          <button
            onClick={toggleAudio}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform active:scale-90 ${isAudioMuted ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-white/5'} shadow-xl`}
          >
            <i className={`fas ${isAudioMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-xl`}></i>
          </button>

          <button
            onClick={toggleVideo}
            disabled={isScreenSharing}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform active:scale-90 ${isVideoMuted ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-white/5'} ${isScreenSharing ? 'opacity-20 cursor-not-allowed' : 'shadow-xl'}`}
          >
            <i className={`fas ${isVideoMuted ? 'fa-video-slash' : 'fa-video'} text-xl`}></i>
          </button>

          <button
            onClick={toggleScreenShare}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform active:scale-90 ${isScreenSharing ? 'bg-blue-600 text-white animate-pulse shadow-lg shadow-blue-600/40' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-white/5 shadow-xl'}`}
          >
            <i className="fas fa-desktop text-xl"></i>
          </button>

          <div className="w-px h-10 bg-white/10 mx-2"></div>

          <button
            onClick={leaveRoom}
            className="bg-red-600 hover:bg-red-500 text-white font-black py-4 px-10 rounded-2xl flex items-center gap-3 transition-all shadow-2xl shadow-red-600/20 transform hover:-translate-y-1 active:scale-95"
          >
            <i className="fas fa-phone-slash text-xl"></i>
            Esci ora
          </button>
        </div>

        <div className="absolute left-10 hidden xl:flex items-center gap-3">
           <div className="bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border border-blue-500/20">
            Network Status: Ottimale
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
