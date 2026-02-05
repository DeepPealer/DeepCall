import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X, Maximize2, Minimize2, Settings, MonitorUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useParticipants, 
  useTracks, 
  VideoTrack,
  useLocalParticipant,
  useRoomContext,
  TrackToggle,
  DisconnectButton
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import api from '../api/axios';

// Custom Video Grid Component
function CustomVideoGrid({ onEnd }) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const toggleMute = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };
  
  const toggleVideo = async () => {
    if (localParticipant) {
      await localParticipant.setCameraEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };
  
  const toggleScreenShare = async () => {
    if (localParticipant) {
      try {
        if (isScreenSharing) {
          await localParticipant.setScreenShareEnabled(false);
        } else {
          await localParticipant.setScreenShareEnabled(true);
        }
        setIsScreenSharing(!isScreenSharing);
      } catch (e) {
        console.error('Screen share error:', e);
      }
    }
  };
  
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Video Grid */}
      <div className={`w-full h-full p-4 gap-4 ${
        tracks.length <= 1 ? 'flex items-center justify-center' :
        tracks.length === 2 ? 'grid grid-cols-2' :
        tracks.length <= 4 ? 'grid grid-cols-2 grid-rows-2' :
        'grid grid-cols-3 grid-rows-2'
      }`}>
        {tracks.map((track, index) => (
          <div 
            key={track.participant.identity + track.source}
            className="relative rounded-2xl overflow-hidden bg-gray-800/50 backdrop-blur border border-white/10 shadow-2xl"
          >
            <VideoTrack trackRef={track} className="w-full h-full object-cover" />
            
            {/* Participant Name Badge */}
            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
              <span className="text-white text-sm font-semibold">
                {track.participant.name || track.participant.identity}
              </span>
            </div>
          </div>
        ))}
        
        {tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center text-gray-500 gap-4">
            <div className="w-24 h-24 rounded-full bg-gray-800/50 flex items-center justify-center border border-white/10">
              <VideoOff size={40} className="text-gray-600" />
            </div>
            <p className="text-lg">Waiting for video...</p>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-center gap-4 p-4 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl">
            {/* Mute Button */}
            <button 
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border ${
                isMuted 
                  ? 'bg-red-500/30 text-red-400 border-red-500/50' 
                  : 'bg-gray-700/50 hover:bg-gray-600/50 text-white border-white/10'
              }`}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            
            {/* Video Toggle */}
            <button 
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border ${
                isVideoOff 
                  ? 'bg-red-500/30 text-red-400 border-red-500/50' 
                  : 'bg-gray-700/50 hover:bg-gray-600/50 text-white border-white/10'
              }`}
            >
              {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
            
            {/* End Call */}
            <button 
              onClick={onEnd}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
            >
              <PhoneOff size={26} />
            </button>
            
            {/* Screen Share */}
            <button 
              onClick={toggleScreenShare}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border ${
                isScreenSharing 
                  ? 'bg-primary/30 text-primary border-primary/50' 
                  : 'bg-gray-700/50 hover:bg-gray-600/50 text-white border-white/10'
              }`}
            >
              <MonitorUp size={22} />
            </button>
            
            {/* Fullscreen Placeholder */}
            <button className="w-14 h-14 rounded-full bg-gray-700/50 hover:bg-gray-600/50 text-white flex items-center justify-center transition-all border border-white/10">
              <Maximize2 size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* Call Duration */}
      <CallTimer />
    </div>
  );
}

// Call Timer Component
function CallTimer() {
  const [seconds, setSeconds] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  
  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
      <span className="text-white/80 text-sm font-mono">{formatTime(seconds)}</span>
    </div>
  );
}

export default function CallOverlay({ 
  callState,
  callType,
  roomName,
  friendName,
  friendAvatar,
  onAccept,
  onReject,
  onEnd
}) {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  const LIVEKIT_URL = 'wss://deepcall-r3yyzo5h.livekit.cloud';

  useEffect(() => {
    if (callState === 'connected' && roomName) {
      console.log('DEBUG: CallOverlay fetching token for room:', roomName);
      api.post('/livekit/token', { room_name: roomName, username: localStorage.getItem('username') })
        .then(res => {
          console.log('DEBUG: Token received successfully');
          setToken(res.data.token);
        })
        .catch(err => {
          console.error('DEBUG: Failed to get token:', err);
          setError('Failed to connect to call');
        });
    } else {
      setToken(null);
    }
  }, [callState, roomName]);

  if (callState === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center"
      >
        {/* Incoming Call UI */}
        {callState === 'incoming' && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-8"
          >
            <div className="relative">
              <div className="absolute inset-0 w-36 h-36 rounded-full bg-green-500/20 animate-ping" />
              <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 overflow-hidden border-4 border-white/20 shadow-2xl">
                {friendAvatar ? (
                  <img src={friendAvatar} alt={friendName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-black text-white bg-gradient-to-br from-primary to-purple-600">
                    {friendName?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-center">
              <h2 className="text-3xl font-black text-white mb-2">{friendName}</h2>
              <p className="text-gray-400 text-lg">
                Incoming {callType === 'video' ? 'video' : 'voice'} call
              </p>
            </div>
            
            <div className="flex gap-8 mt-4">
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onReject}
                className="w-20 h-20 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/30 shadow-lg shadow-red-500/20"
              >
                <PhoneOff size={32} />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onAccept}
                className="w-20 h-20 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all border border-green-500/30 shadow-lg shadow-green-500/20"
              >
                <Phone size={32} />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Outgoing Call UI */}
        {callState === 'outgoing' && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-8"
          >
            <div className="relative">
              <div className="absolute inset-0 w-36 h-36 rounded-full border-4 border-primary/50 animate-pulse" />
              <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 overflow-hidden border-4 border-white/20 shadow-2xl">
                {friendAvatar ? (
                  <img src={friendAvatar} alt={friendName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-black text-white bg-gradient-to-br from-primary to-purple-600">
                    {friendName?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-center">
              <h2 className="text-3xl font-black text-white mb-2">{friendName}</h2>
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="ml-2">Calling</span>
              </div>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onEnd}
              className="mt-4 w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
            >
              <PhoneOff size={32} />
            </motion.button>
          </motion.div>
        )}

        {/* Connected Call UI */}
        {callState === 'connected' && (
          <div className="w-full h-full">
            {error ? (
              <div className="flex-1 h-full flex items-center justify-center text-red-500 text-xl">{error}</div>
            ) : token ? (
              <LiveKitRoom
                serverUrl={LIVEKIT_URL}
                token={token}
                connect={true}
                video={callType === 'video'}
                audio={true}
                className="h-full"
                onDisconnected={onEnd}
              >
                <CustomVideoGrid onEnd={onEnd} />
                <RoomAudioRenderer />
              </LiveKitRoom>
            ) : (
              <div className="flex-1 h-full flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400">Connecting...</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
