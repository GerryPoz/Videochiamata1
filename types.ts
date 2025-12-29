
export interface Participant {
  id: string;
  stream: MediaStream;
  name: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

export enum AppState {
  LOBBY = 'LOBBY',
  IN_ROOM = 'IN_ROOM'
}
