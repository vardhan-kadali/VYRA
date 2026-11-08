'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Mic, 
  Volume2, 
  CheckCircle, 
  ArrowLeft, 
  Video, 
  FileText, 
  Clock, 
  Gauge, 
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Info
} from 'lucide-react';
import { InterviewConfig } from '@/types/interview';
import styles from './DeviceCheckView.module.css';

interface DeviceCheckViewProps {
  config: InterviewConfig;
  onBack: () => void;
  onProceed: () => void;
}

export const DeviceCheckView: React.FC<DeviceCheckViewProps> = ({
  config,
  onBack,
  onProceed
}) => {
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [speakerTested, setSpeakerTested] = useState(false);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [hasRealVideo, setHasRealVideo] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initMedia() {
      try {
        setDeviceError(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setDeviceError('Your browser does not support media device capture.');
          return;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch {
          // If video device fails, fall back to microphone only
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Video Track attachment
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          setHasRealVideo(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }

        // Web Audio API volume level analyser
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateLevel = () => {
              if (!isMounted) return;
              if (analyserRef.current && micActive) {
                analyserRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                const normalized = Math.min(100, Math.round((avg / 128) * 100));
                setMicLevel(normalized);
              } else {
                setMicLevel(0);
              }
              animFrameRef.current = requestAnimationFrame(updateLevel);
            };
            animFrameRef.current = requestAnimationFrame(updateLevel);
          } catch {
            // AudioContext not supported
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setDeviceError(
          err instanceof Error
            ? err.message
            : 'Microphone or camera permission was denied. Please allow access in your browser address bar.'
        );
      }
    }

    initMedia();

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const toggleCamera = () => {
    if (streamRef.current) {
      const vTrack = streamRef.current.getVideoTracks()[0];
      if (vTrack) {
        vTrack.enabled = !cameraActive;
      }
    }
    setCameraActive(!cameraActive);
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const aTrack = streamRef.current.getAudioTracks()[0];
      if (aTrack) {
        aTrack.enabled = !micActive;
      }
    }
    setMicActive(!micActive);
  };

  const handleTestSpeaker = () => {
    setIsTestingSpeaker(true);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch {
      // AudioContext unavailable
    }

    setTimeout(() => {
      setIsTestingSpeaker(false);
      setSpeakerTested(true);
    }, 500);
  };

  const isReady = micActive && !deviceError;

  return (
    <div className={styles.container}>
      <div className={styles.headerArea}>
        <button onClick={onBack} className={styles.backLink}>
          <ArrowLeft size={16} />
          <span>Back to Configuration</span>
        </button>
        <div className={styles.badge}>STAGE 2: PRE-INTERVIEW CHECK</div>
        <h1 className={styles.title}>System & Device Check</h1>
        <p className={styles.subtitle}>
          Ensure your microphone and camera are operational before entering the live interview room.
        </p>
      </div>

      {deviceError && (
        <div className={styles.permissionWarning}>
          <AlertCircle size={20} />
          <div>
            <strong>Device Permission Required:</strong> {deviceError}
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {/* Left Column: Device Check Tiles */}
        <div className={styles.deviceColumn}>
          {/* Camera Tile */}
          <div className={styles.deviceCard}>
            <div className={styles.deviceHeader}>
              <div className={styles.deviceTitleGroup}>
                <div className={`${styles.iconCircle} ${cameraActive ? styles.iconSuccess : ''}`}>
                  <Camera size={20} />
                </div>
                <div>
                  <h3 className={styles.deviceTitle}>Camera Feed</h3>
                  <span className={styles.deviceSubtitle}>Candidate video stream</span>
                </div>
              </div>
              <span className={`${styles.statusBadge} ${cameraActive ? styles.statusReady : styles.statusOff}`}>
                {cameraActive ? (hasRealVideo ? 'Live Camera' : 'Ready') : 'Disabled'}
              </span>
            </div>

            <div className={styles.previewBox}>
              {cameraActive && hasRealVideo ? (
                <video ref={videoRef} autoPlay playsInline muted className={styles.realVideoPreview} />
              ) : cameraActive ? (
                <div className={styles.cameraPreviewMock}>
                  <div className={styles.candidateSilhouette}>
                    <div className={styles.silhouetteHead} />
                    <div className={styles.silhouetteBody} />
                  </div>
                  <div className={styles.cameraLiveBadge}>
                    <span className={styles.livePulse} />
                    <span>Camera Standby</span>
                  </div>
                </div>
              ) : (
                <div className={styles.cameraPlaceholder}>
                  <Camera size={36} className={styles.disabledIcon} />
                  <span>Camera feed is paused</span>
                </div>
              )}
            </div>

            <div className={styles.deviceFooter}>
              <button
                type="button"
                onClick={toggleCamera}
                className={styles.toggleBtn}
              >
                {cameraActive ? 'Turn Off Camera' : 'Enable Camera'}
              </button>
            </div>
          </div>

          {/* Microphone Tile */}
          <div className={styles.deviceCard}>
            <div className={styles.deviceHeader}>
              <div className={styles.deviceTitleGroup}>
                <div className={`${styles.iconCircle} ${micActive ? styles.iconSuccess : ''}`}>
                  <Mic size={20} />
                </div>
                <div>
                  <h3 className={styles.deviceTitle}>Microphone Input</h3>
                  <span className={styles.deviceSubtitle}>Voice response capture</span>
                </div>
              </div>
              <span className={`${styles.statusBadge} ${micActive ? styles.statusReady : styles.statusOff}`}>
                {micActive ? 'Active' : 'Muted'}
              </span>
            </div>

            <div className={styles.micVisualizerBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className={styles.micLabel}>Live Microphone Level:</span>
                <span className={styles.liveDbLevel}>{micActive ? `${micLevel}%` : 'Muted'}</span>
              </div>
              <div className={styles.waveformBars}>
                {[15, 30, 50, 75, 90, 65, 80, 45, 95, 70, 50, 25].map((factor, i) => {
                  const dynamicHeight = micActive ? Math.max(12, Math.round((micLevel * factor) / 100)) : 12;
                  return (
                    <span
                      key={i}
                      className={`${styles.bar} ${micActive && micLevel > 5 ? styles.barActive : ''}`}
                      style={{ height: `${dynamicHeight}%` }}
                    />
                  );
                })}
              </div>
            </div>

            <div className={styles.deviceFooter}>
              <div className={styles.privacyNote}>
                <Info size={13} style={{ flexShrink: 0 }} />
                <span>Audio transcribed via browser Web Speech API (vendor cloud-assisted; not local/offline).</span>
              </div>
              <button
                type="button"
                onClick={toggleMic}
                className={styles.toggleBtn}
              >
                {micActive ? 'Mute Microphone' : 'Unmute Microphone'}
              </button>
            </div>
          </div>

          {/* Speaker Audio Output Tile */}
          <div className={styles.deviceCard}>
            <div className={styles.deviceHeader}>
              <div className={styles.deviceTitleGroup}>
                <div className={`${styles.iconCircle} ${speakerTested ? styles.iconSuccess : ''}`}>
                  <Volume2 size={20} />
                </div>
                <div>
                  <h3 className={styles.deviceTitle}>Audio Output</h3>
                  <span className={styles.deviceSubtitle}>AI Interviewer speech playback</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestSpeaker}
                disabled={isTestingSpeaker}
                className={styles.testAudioBtn}
              >
                {isTestingSpeaker ? <RefreshCw size={14} className={styles.spinning} /> : <Volume2 size={14} />}
                <span>{speakerTested ? 'Test Sound Again' : 'Play Test Sound'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Interview Session Summary */}
        <div className={styles.summaryColumn}>
          <div className={styles.summaryCard}>
            <h3 className={styles.summaryHeading}>Session Summary</h3>
            <p className={styles.summarySub}>Review your parameters before joining.</p>

            <div className={styles.summaryList}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Topic</span>
                <span className={styles.summaryValue}>{config.topic}</span>
              </div>

              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Category</span>
                <span className={styles.summaryValue}>
                  {config.category === 'viva' && 'Academic Viva'}
                  {config.category === 'job' && 'Job Interview'}
                  {config.category === 'custom' && 'Any Other Topic'}
                </span>
              </div>

              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Difficulty</span>
                <div className={styles.summaryValueBadge}>
                  <Gauge size={14} />
                  <span>{config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1)}</span>
                </div>
              </div>

              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Duration</span>
                <div className={styles.summaryValueBadge}>
                  <Clock size={14} />
                  <span>{config.duration} Minutes</span>
                </div>
              </div>

              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>AI Interviewer</span>
                <span className={styles.summaryValue}>Male Persona &bull; Indian English (Prabhat)</span>
              </div>

              {config.pdfFileName && (
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Study Material</span>
                  <div className={styles.pdfGroundingBadge}>
                    <FileText size={14} />
                    <span className={styles.truncateText}>{config.pdfFileName}</span>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.readyAlert}>
              <CheckCircle2 size={18} className={styles.readyIcon} />
              <div className={styles.readyText}>
                <strong>All Systems Operational</strong>
                <span>You will enter a real video-call room with your AI interviewer.</span>
              </div>
            </div>

            <button
              onClick={onProceed}
              disabled={!isReady}
              className={`${styles.enterRoomButton} ${!isReady ? styles.btnDisabled : ''}`}
            >
              <Video size={18} />
              <span>Enter Interview Room</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
