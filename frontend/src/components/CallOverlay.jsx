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
function CustomVideoGrid({ onEnd, isMinimized, onToggleMinimize }) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Sync state with participant
  useEffect(() => {
    if (localParticipant) {
      setIsMuted(!localParticipant.isMicrophoneEnabled);
      setIsVideoOff(!localParticipant.isCameraEnabled);
      setIsScreenSharing(localParticipant.isScreenShareEnabled);
    }
  }, [localParticipant?.isMicrophoneEnabled, localParticipant?.isCameraEnabled, localParticipant?.isScreenShareEnabled]);

  const toggleMute = async () => {
    if (localParticipant) {
      const newState = !localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(newState);
      setIsMuted(newState);
    }
  };

  const toggleVideo = async () => {
    if (localParticipant) {
      const newState = !localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(newState);
      setIsVideoOff(newState);
    }
  };

  const toggleScreenShare = async () => {
    if (localParticipant) {
      try {
        const newState = !localParticipant.isScreenShareEnabled;
        // ENABLE 60 FPS
        await localParticipant.setScreenShareEnabled(newState, {
          videoCaptureOptions: { frameRate: 60 }
        });
        setIsScreenSharing(newState);
      } catch (e) {
        console.error('Screen share error:', e);
      }
    }
  };

  if (isMinimized) {
    const mainTrack = tracks.find(t => t.source === Track.Source.ScreenShare) || tracks[0];

    return (
      <div className="fixed bottom-6 right-6 w-80 aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/20 z-[10000] group pointer-events-auto">
        {mainTrack ? (
          <VideoTrack trackRef={mainTrack} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-surface-800">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Phone className="text-primary" size={20} />
            </div>
          </div>
        )}

        {/* Minimized Controls */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={onToggleMinimize}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white flex items-center justify-center border border-white/10"
          >
            <Maximize2 size={18} />
          </button>
          <button
            onClick={onEnd}
            className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#0a0a0b] flex flex-col overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-6 relative z-10 min-h-0">
        <div className={`w-full h-full gap-4 ${tracks.length <= 1 ? 'flex items-center justify-center' :
          tracks.length === 2 ? 'grid grid-cols-2' :
            tracks.length <= 4 ? 'grid grid-cols-2 grid-rows-2' :
              'grid grid-cols-3 grid-rows-2'
          }`}>
          {tracks.map((track, index) => (
            <motion.div
              key={track.participant.identity + track.source}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-3xl overflow-hidden bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl group"
            >
              <VideoTrack trackRef={track} className="w-full h-full object-cover" />

              {/* Participant Info Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${track.participant.isSpeaking ? 'bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)]' : 'bg-white/40'}`} />
                  <span className="text-white text-xs font-black uppercase tracking-widest leading-none">
                    {track.participant.name || track.participant.identity}
                  </span>
                </div>
                {track.source === Track.Source.ScreenShare && (
                  <div className="px-2 py-1.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-tighter">
                    60 FPS LIVE
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {tracks.length === 0 && (
            <div className="flex flex-col items-center justify-center text-gray-500 gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                <div className="relative w-32 h-32 rounded-[40px] bg-white/5 flex items-center justify-center border border-white/10 backdrop-blur-xl">
                  <VideoOff size={48} className="text-gray-400" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xl font-black text-white uppercase tracking-[0.2em]">Waiting for Feed</p>
                <p className="text-sm font-bold opacity-40">The signal is being established...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Control Bar - Fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-10 z-20 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center justify-center gap-4 p-5 rounded-[32px] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]"
          >
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 transform active:scale-95 border ${isMuted
                ? 'bg-red-500/20 text-red-500 border-red-500/30'
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/20'
                }`}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            {/* Video Toggle */}
            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 transform active:scale-95 border ${isVideoOff
                ? 'bg-red-500/20 text-red-500 border-red-500/30'
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/20'
                }`}
            >
              {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
            </button>

            {/* End Call */}
            <button
              onClick={onEnd}
              className="w-20 h-16 rounded-[24px] bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30"
            >
              <PhoneOff size={28} />
            </button>

            {/* Screen Share */}
            <button
              onClick={toggleScreenShare}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 transform active:scale-95 border ${isScreenSharing
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/20'
                }`}
            >
              <MonitorUp size={24} />
            </button>

            {/* Minimize Button */}
            <button
              onClick={onToggleMinimize}
              className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all duration-300 border border-white/10 hover:border-white/20"
            >
              <Minimize2 size={24} />
            </button>
          </motion.div>

          {/* Security Warning for Insecure Origin */}
          {!navigator.mediaDevices && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center backdrop-blur-md"
            >
              <p className="text-red-400 text-xs font-black uppercase tracking-widest">
                Browser blocked media access!
              </p>
              <p className="text-white/40 text-[10px] mt-1 font-bold">
                Enable "Insecure origins treated as secure" in chrome://flags for this IP.
              </p>
            </motion.div>
          )}
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
  const [isMinimized, setIsMinimized] = useState(false);

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


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center ${isMinimized ? 'pointer-events-none' : 'bg-black/95 backdrop-blur-xl pointer-events-auto'
        }`}
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
              <CustomVideoGrid
                onEnd={onEnd}
                isMinimized={isMinimized}
                onToggleMinimize={() => setIsMinimized(!isMinimized)}
              />
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
  );
}
