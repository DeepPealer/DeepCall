import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function VoiceArea({ channel }) {
  const [token, setToken] = useState('');

  useEffect(() => {
    const getToken = async () => {
      try {
        const resp = await api.post(`/channels/${channel.id}/join`);
        setToken(resp.data.token);
      } catch (e) {
        console.error(e);
      }
    };

    if (channel.id) {
        getToken();
    }
  }, [channel.id]);

  if (!token) {
    return (
        <div className="glass-card p-4 rounded-xl flex items-center justify-center h-48">
             <span className="loading loading-spinner text-primary"></span>
             <span className="ml-2">Connecting to Voice...</span>
        </div>
    );
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'} // Ensure env var or fallback
      data-lk-theme="default"
      style={{ height: '300px' }}
      className="glass-card rounded-xl overflow-hidden shadow-2xl border border-white/10"
    >
      <MyVideoConference />
      <RoomAudioRenderer />
      <ControlBar variation="minimal" />
    </LiveKitRoom>
  );
}

function MyVideoConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} style={{ height: 'calc(100% - var(--lk-control-bar-height))' }}>
      <ParticipantTile />
    </GridLayout>
  );
}
