import * as React from 'react';
import { Participant, ChatMessage, AppState } from './types';
import VideoPlayer from './components/VideoPlayer';
import MeetingAssistant from './components/MeetingAssistant';
// @ts-ignore
import { joinRoom as joinTrysteroRoom } from 'trystero/torrent';

const App: React.FC = () => {
  const [appState, setAppState] = React.useState<AppState>(AppState.LOBBY);
  const [roomId, setRoomId] = React.useState('');
  const [userName, setUserName] = React.useState('');
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null);
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [chatHistory, setChatHistory] = React.useState<ChatMessage[]>([]);
  const [showAiAssistant, setShowAiAssistant] = React.useState(false);
  const [isAudioMuted, setIsAudioMuted] = React.useState(false);
  const [isVideoMuted, setIsVideoMuted] = React.useState(false);
  const [isScreenSharing, setIsScreenSharing] = React.useState(false);

  // Refs per gestire lo stato della stanza Trystero senza re-render
  const roomRef = React.useRef<any>(null);
  const participantsRef = React.useRef<Participant[]>([]);

  // Sincronizza lo stato locale con i ref e la lista partecipanti
  React.useEffect(() => {
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
        const newParticipants = [me, ...others];
        participantsRef.current = newParticipants;
        return newParticipants;
      });
    }
  }, [isAudioMuted, isVideoMuted, isScreenSharing, appState, localStream, userName]);

  // Gestione URL hash per stanze dirette
  React.useEffect(() => {
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
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      stream.getAudioTracks().forEach(t => t.enabled = !isAudioMuted);
      stream.getVideoTracks().forEach(t => t.enabled = !isVideoMuted);
      
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Errore acquisizione media:", err);
      alert("Impossibile accedere ai dispositivi multimediali. Controlla i permessi.");
      return null;
    }
  };

  const connectToRoom = (stream: MediaStream, id: string, name: string) => {
    const appId = 'gemini-connect-demo-v1';
    const room = joinTrysteroRoom({ appId }, id);
    roomRef.current = room;

    // Actions per scambiare dati
    const [sendName, getName] = room.makeAction('name');
    const [sendChat, getChat] = room.makeAction('chat');

    // Gestione nuovi peer
    room.onPeerJoin((peerId: string) => {
      console.log('Peer joined:', peerId);
      room.addStream(stream, peerId);
      sendName(name, peerId);
    });

    // Ricezione Stream
    room.onPeerStream((remoteStream: MediaStream, peerId: string) => {
      console.log('Received stream from:', peerId);
      setParticipants(prev => {
        if (prev.find(p => p.id === peerId)) return prev;
        return [...prev, {
          id: peerId,
          name: `Utente ${peerId.substr(0, 4)}`, // Fallback name
          stream: remoteStream,
          isAudioMuted: false,
          isVideoMuted: false,
          isScreenSharing: false
        }];
      });
    });

    // Ricezione Nome
    getName((remoteName: string, peerId: string) => {
      setParticipants(prev => prev.map(p => 
        p.id === peerId ? { ...p, name: remoteName } : p
      ));
    });

    // Ricezione Chat
    getChat((message: any, peerId: string) => {
      const sender = participantsRef.current.find(p => p.id === peerId)?.name || 'Sconosciuto';
      setChatHistory(prev => [...prev, {
        id: Math.random().toString(36),
        sender,
        text: message.text,
        timestamp: Date.now()
      }]);
    });

    // Uscita Peer
    room.onPeerLeave((peerId: string) => {
      setParticipants(prev => prev.filter(p => p.id !== peerId));
    });

    // Invia subito il proprio nome a chi è già nella stanza (best effort)
    // Nota: Trystero non ha un 'getPeers' immediato sincrono, ma onPeerJoin gestisce i nuovi.
    // Per i peer esistenti, lo stream handshake attiverà lo scambio.
  };

  const joinRoom = async () => {
    if (!userName.trim()) {
      alert("Per favore, inserisci un nome per farti riconoscere.");
      return;
    }
    const stream = await initMedia();
    if (stream) {
      setAppState(AppState.IN_ROOM);
      connectToRoom(stream, roomId, userName);
    }
  };

  const handleSendMessage = (text: string) => {
    if (!roomRef.current) return;
    
    // Invia messaggio agli altri
    const [sendChat] = roomRef.current.makeAction('chat');
    sendChat({ text });

    // Aggiungi localmente
    setChatHistory(prev => [...prev, {
      id: Math.random().toString(36),
      sender: 'Tu',
      text,
      timestamp: Date.now()
    }]);
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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return;

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any, audio: false });
        const micTrack = localStream?.getAudioTracks()[0];
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        
        const combinedStream = new MediaStream([screenVideoTrack]);
        if (micTrack) combinedStream.addTrack(micTrack);
        
        // Sostituisci stream nella room Trystero
        if (roomRef.current) {
           roomRef.current.replaceStream(localStream, combinedStream);
        }

        setIsScreenSharing(true);
        setIsVideoMuted(false); 
        setLocalStream(combinedStream);
        
        screenVideoTrack.onended = () => stopScreenSharing();
      } catch (err) {
        console.warn("Condivisione schermo annullata:", err);
      }
    } else {
      await stopScreenSharing();
    }
  };

  const stopScreenSharing = async () => {
    setIsScreenSharing(false);
    localStream?.getVideoTracks().forEach(t => t.stop()); // Ferma lo schermo
    
    const newStream = await initMedia(); // Ripristina webcam
    if (newStream && roomRef.current && localStream) {
      roomRef.current.replaceStream(localStream, newStream);
    }
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${roomId}`;
    navigator.clipboard.writeText(url);
    alert("Link copiato! Invialo ai tuoi amici.");
  };

  const leaveRoom = () => {
    if (roomRef.current) {
      roomRef.current.leave();
    }
    localStream?.getTracks().forEach(t => t.stop());
    setAppState(AppState.LOBBY);
    setParticipants([]);
    setChatHistory([]);
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
            <p className="text-gray-400 font-medium">Videochiamate P2P Illimitate</p>
          </div>

          <div className="space-y-6">
            <div className="group">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1 group-focus-within:text-blue-400 transition-colors">Nome Utente</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                placeholder="Il tuo nome..."
                className="w-full bg-gray-800 border-2 border-transparent rounded-2xl px-5 py-4 text-white focus:border-blue-500 focus:bg-gray-800/50 focus:outline-none transition-all placeholder-gray-600 text-lg"
              />
            </div>

            {roomId ? (
              <div className="space-y-4 pt-2">
                <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-blue-400 font-bold uppercase block">Stanza da raggiungere</span>
                    <span className="text-xl font-mono font-bold text-white tracking-wider">{roomId}</span>
                  </div>
                  <i className="fas fa-door-open text-blue-500 text-xl"></i>
                </div>
                <button onClick={joinRoom} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-blue-600/30 text-lg">
                  Entra Ora
                </button>
              </div>
            ) : (
              <button onClick={createRoom} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-600/30 text-lg">
                Crea Nuova Stanza
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden font-sans">
      <div className="h-20 flex items-center justify-between px-8 bg-gray-900/50 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <i className="fas fa-users text-white"></i>
          </div>
          <div>
            <h2 className="font-bold text-white text-lg leading-none">Meeting Attivo</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                {participants.length} Partecipanti
               </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={copyInviteLink} className="flex items-center gap-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl border border-white/10">
            <i className="fas fa-link text-blue-400"></i> Invita
          </button>
          <button 
            onClick={() => setShowAiAssistant(!showAiAssistant)}
            className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border ${showAiAssistant ? 'bg-blue-600 border-blue-500' : 'bg-white/5 border-white/10'}`}
          >
            <i className="fas fa-magic"></i> AI
          </button>
        </div>
      </div>

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
          <div className="w-80 border-l border-gray-800 bg-gray-900 flex flex-col">
            <MeetingAssistant chatHistory={chatHistory} />
            <div className="p-4 border-t border-gray-800 bg-gray-800/30">
                <input 
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  placeholder="Scrivi in chat a tutti..."
                  onKeyDown={(e) => {
                    if(e.key === 'Enter') {
                        handleSendMessage(e.currentTarget.value);
                        e.currentTarget.value = '';
                    }
                  }}
                />
            </div>
          </div>
        )}
      </div>

      <div className="h-24 bg-gray-900 border-t border-white/5 flex items-center justify-center gap-6 px-10">
        <button onClick={toggleAudio} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isAudioMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
          <i className={`fas ${isAudioMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
        </button>
        <button onClick={toggleVideo} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
          <i className={`fas ${isVideoMuted ? 'fa-video-slash' : 'fa-video'}`}></i>
        </button>
        <button onClick={toggleScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-600 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'}`}>
          <i className="fas fa-desktop"></i>
        </button>
        <button onClick={leaveRoom} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-xl ml-4">
          Esci
        </button>
      </div>
    </div>
  );
};

export default App;