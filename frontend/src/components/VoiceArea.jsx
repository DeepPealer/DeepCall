import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api/axios';

/**
 * Headless voice connection manager.
 * No visible UI — all UI lives in the sidebar (ChannelList).
 * Manages LiveKit connection, mute/deafen state, and WS signaling.
 */
export default function VoiceArea({ channel, onDisconnect, globalWs, onConnectionChange }) {
  const [token, setToken] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | connected | error
  const intentionalDisconnect = useRef(false);
  const user = {
    id: localStorage.getItem('user_id'),
    username: localStorage.getItem('username'),
    avatar: localStorage.getItem('user_avatar')
  };

  useEffect(() => {
    let cancelled = false;
    intentionalDisconnect.current = false;
    setConnectionStatus('connecting');
    onConnectionChange?.('connecting');

    const getToken = async () => {
      try {
        const resp = await api.post(`/channels/${channel.id}/join`);
        if (!cancelled) {
          setToken(resp.data.token);
          setConnectionStatus('connected');
          onConnectionChange?.('connected');

          // Signal join to global WS
          if (globalWs?.readyState === WebSocket.OPEN) {
            globalWs.send(JSON.stringify({
              type: 'voice_join',
              channel_id: channel.id,
              user: user
            }));
          }
        }
      } catch (e) {
        console.error('Failed to join voice channel:', e);
        if (!cancelled) {
          setConnectionStatus('error');
          onConnectionChange?.('error');
        }
      }
    };

    if (channel.id) {
      getToken();
    }

    return () => {
      cancelled = true;
      // Signal leave
      if (globalWs?.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({
          type: 'voice_leave',
          channel_id: channel.id,
          user_id: user.id
        }));
      }
    };
  }, [channel.id]);

  const handleDisconnect = useCallback(() => {
    intentionalDisconnect.current = true;
    setToken('');
    setConnectionStatus('disconnected');
    onConnectionChange?.('disconnected');
    onDisconnect();
  }, [onDisconnect, onConnectionChange]);

  const handleLiveKitDisconnected = useCallback(() => {
    if (intentionalDisconnect.current) return;
    console.log('LiveKit disconnected unexpectedly');
    // Don't unmount — keep the component alive for reconnect attempts
  }, []);

  // Expose disconnect method via ref-like pattern
  useEffect(() => {
    // Store handler globally so sidebar can call it
    window.__voiceDisconnect = handleDisconnect;
    return () => { delete window.__voiceDisconnect; };
  }, [handleDisconnect]);

  if (!token) {
    // Still loading or error — render nothing visible
    return null;
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'}
      connect={true}
      onDisconnected={handleLiveKitDisconnected}
      style={{ display: 'none' }}
    >
      <RoomAudioRenderer />
      <VoiceControls />
    </LiveKitRoom>
  );
}

/**
 * Inner component that exposes mute/deafen controls via window globals
 * so the sidebar can read/trigger them.
 */
function VoiceControls() {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const toggleMute = useCallback(async () => {
    if (!localParticipant) return;
    const newMuted = !isMuted;
    await localParticipant.setMicrophoneEnabled(!newMuted);
    setIsMuted(newMuted);
  }, [localParticipant, isMuted]);

  const toggleDeafen = useCallback(() => {
    // Deafen = mute audio output (we'll just mute all remote tracks)
    setIsDeafened(prev => !prev);
    // When deafening, also mute mic
    if (!isDeafened && !isMuted) {
      localParticipant?.setMicrophoneEnabled(false);
      setIsMuted(true);
    }
  }, [localParticipant, isDeafened, isMuted]);

  // Expose to window so sidebar controls can call
  useEffect(() => {
    window.__voiceMute = toggleMute;
    window.__voiceDeafen = toggleDeafen;
    window.__voiceState = { isMuted, isDeafened };
    return () => {
      delete window.__voiceMute;
      delete window.__voiceDeafen;
      delete window.__voiceState;
    };
  }, [toggleMute, toggleDeafen, isMuted, isDeafened]);

  // Handle deafen - mute all audio elements on page
  useEffect(() => {
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(el => {
      if (el.closest('[data-lk-room]')) {
        el.muted = isDeafened;
      }
    });
  }, [isDeafened]);

  return null;
}
