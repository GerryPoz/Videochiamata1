
import React, { useEffect, useRef } from 'react';
import { Participant } from '../types';

interface VideoPlayerProps {
  participant: Participant;
  isLocal?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ participant, isLocal }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className={`relative group rounded-[2rem] overflow-hidden shadow-2xl border-2 transition-all duration-300 aspect-video ${participant.isScreenSharing ? 'border-blue-500 bg-blue-900/10 ring-4 ring-blue-500/10' : 'border-white/5 bg-gray-900'}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-500 ${participant.isVideoMuted ? 'opacity-0' : 'opacity-100'}`}
      />
      
      {participant.isVideoMuted && !participant.isScreenSharing && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center text-4xl font-black text-blue-500 shadow-inner">
            {participant.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Info Badge */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
          <span className="text-sm font-bold text-white">
            {isLocal ? 'Tu' : participant.name}
          </span>
          {participant.isAudioMuted && (
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <i className="fas fa-microphone-slash text-red-500 text-[10px]"></i>
            </div>
          )}
        </div>
      </div>

      {/* Screen Share Overlay */}
      {participant.isScreenSharing && (
        <div className="absolute top-4 left-4">
          <div className="bg-blue-600 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg shadow-blue-600/30 animate-pulse border border-blue-400">
            <i className="fas fa-desktop text-[10px] text-white"></i>
            <span className="text-[10px] uppercase font-black tracking-widest text-white">In Condivisione</span>
          </div>
        </div>
      )}

      {/* Controls Visibility on Hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
    </div>
  );
};

export default VideoPlayer;
