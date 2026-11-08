'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  PhoneOff, 
  FileText, 
  Clock, 
  Sparkles,
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  Send,
  RefreshCw,
  CheckCircle2,
  Square,
  RotateCcw,
  Volume1,
  Keyboard
} from 'lucide-react';
import { InterviewConfig } from '@/types/interview';
import { api } from '@/lib/api';
import styles from './InterviewRoomView.module.css';

interface InterviewRoomViewProps {
  config: InterviewConfig;
  onEndInterview: () => void;
}

interface TranscriptItem {
  speaker: string;
  text: string;
  time: string;
  score?: number;
  feedback?: string;
  pageRef?: string | null;
}

// Web Speech API interface declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export const InterviewRoomView: React.FC<InterviewRoomViewProps> = ({
  config,
  onEndInterview,
}) => {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [interviewerStatus, setInterviewerStatus] = useState<'speaking' | 'listening' | 'evaluating'>('speaking');

  // Real backend interview state
  const [currentQuestion, setCurrentQuestion] = useState<string>(
    'Connecting to Dr. Prabhat Sharma...'
  );
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [supportingPageRef, setSupportingPageRef] = useState<string | null>(null);
  const [candidateAnswerInput, setCandidateAnswerInput] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);

  // Voice Interaction Pipeline State
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState<boolean>(false);
  const [hasCandidateVideo, setHasCandidateVideo] = useState<boolean>(false);
  const [candidateMicLevel, setCandidateMicLevel] = useState<number>(0);
  const [recognizedVoiceText, setRecognizedVoiceText] = useState<string>('');
  const [interimVoiceText, setInterimVoiceText] = useState<string>('');
  const [silenceSecondsRemaining, setSilenceSecondsRemaining] = useState<number | null>(null);
  const [speechApiSupported, setSpeechApiSupported] = useState<boolean>(true);
  const [showKeyboardFallback, setShowKeyboardFallback] = useState<boolean>(false);
  const [isRecognitionActive, setIsRecognitionActive] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [isEndingSession, setIsEndingSession] = useState<boolean>(false);

  // Avatar WebRTC State
  const [isAvatarLive, setIsAvatarLive] = useState<boolean>(false);
  const [avatarMode, setAvatarMode] = useState<'live' | 'fallback'>('fallback');
  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const avatarAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const avatarSessionIdRef = useRef<string | null>(null);
  const avatarSpeakingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionInitializedRef = useRef<boolean>(false);
  const playInterviewerAudioRef = useRef<((text: string) => void) | null>(null);

  // References
  const candidateVideoRef = useRef<HTMLVideoElement | null>(null);
  const candidateStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const ttsAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const recognizedVoiceTextRef = useRef<string>('');
  const activeQuestionTextRef = useRef<string>('');

  // Format MM:SS helper
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync ref with state
  useEffect(() => {
    recognizedVoiceTextRef.current = recognizedVoiceText;
  }, [recognizedVoiceText]);

  // Clear silence detection timers
  const clearSilenceTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setSilenceSecondsRemaining(null);
  }, []);

  // Stop candidate speech recognition
  const stopSpeechRecognition = useCallback(() => {
    clearSilenceTimers();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // already stopped
      }
    }
    setIsRecognitionActive(false);
  }, [clearSilenceTimers]);

  // Start candidate speech recognition
  const startSpeechRecognition = useCallback(() => {
    if (isMicMuted || !recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsRecognitionActive(true);
    } catch {
      // recognition already running
    }
  }, [isMicMuted]);

  // Core answer submission logic
  const executeSubmitAnswer = useCallback(async (answerText: string) => {
    const cleaned = answerText.trim();
    if (!cleaned || isSubmittingRef.current || !config.sessionId) return;

    isSubmittingRef.current = true;
    setIsEvaluating(true);
    setInterviewerStatus('evaluating');
    setBackendError(null);
    clearSilenceTimers();
    stopSpeechRecognition();
    if (avatarSpeakingTimerRef.current) {
      clearTimeout(avatarSpeakingTimerRef.current);
    }
    if (avatarSessionIdRef.current) {
      api.interruptAvatar(avatarSessionIdRef.current);
    }

    // Reset voice input states
    setRecognizedVoiceText('');
    setInterimVoiceText('');
    setCandidateAnswerInput('');

    const currentTime = formatTime(elapsedSeconds);
    setTranscript((prev) => [
      ...prev,
      { speaker: 'You (Candidate)', text: cleaned, time: currentTime },
    ]);

    try {
      const res = await api.submitAnswer(config.sessionId, cleaned);
      setIsEvaluating(false);
      isSubmittingRef.current = false;

      if (res.previous_answer_score !== undefined && res.previous_answer_score !== null) {
        setLastFeedback({
          score: res.previous_answer_score,
          feedback: res.previous_answer_feedback || 'Answer recorded and evaluated.',
        });
      }

      if (res.is_completed) {
        setInterviewerStatus('speaking');
        setCurrentQuestion('Thank you. That concludes our examination. Generating your comprehensive evaluation report...');
        setTimeout(() => {
          onEndInterview();
        }, 2200);
        return;
      }

      setQuestionNumber(res.question_number);
      setCurrentQuestion(res.question_text);
      activeQuestionTextRef.current = res.question_text;
      setSupportingPageRef(res.supporting_page_ref || null);

      setTranscript((prev) => [
        ...prev,
        {
          speaker: 'Dr. Prabhat Sharma',
          text: res.question_text,
          time: formatTime(elapsedSeconds + 2),
          score: res.previous_answer_score,
          feedback: res.previous_answer_feedback,
          pageRef: res.supporting_page_ref,
        },
      ]);

      // Speak next question via EdgeTTS
      playInterviewerAudio(res.question_text);
    } catch (err: unknown) {
      setIsEvaluating(false);
      isSubmittingRef.current = false;
      setInterviewerStatus('listening');
      setBackendError(err instanceof Error ? err.message : 'Error evaluating response.');
      startSpeechRecognition();
    }
  }, [config.sessionId, elapsedSeconds, onEndInterview, clearSilenceTimers, stopSpeechRecognition, startSpeechRecognition]);

  // Audio unlock helper for browser autoplay policy
  const unlockAudio = useCallback(() => {
    if (avatarAudioRef.current) {
      avatarAudioRef.current.play().then(() => {
        setAutoplayBlocked(false);
      }).catch(() => {});
    }
    if (ttsAudioPlayerRef.current) {
      ttsAudioPlayerRef.current.play().then(() => {
        setAutoplayBlocked(false);
      }).catch(() => {});
    }
    setAutoplayBlocked(false);
  }, []);

  // Window-level interaction listener to seamlessly release audio autoplay block on first click
  useEffect(() => {
    if (!autoplayBlocked) return;
    const handleFirstInteraction = () => {
      unlockAudio();
    };
    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [autoplayBlocked, unlockAudio]);

  // Fallback direct audio playback via EdgeTTS
  const fallbackPlayAudio = useCallback((textToSpeak: string) => {
    if (ttsAudioPlayerRef.current) {
      ttsAudioPlayerRef.current.pause();
    }

    const audioUrl = api.getTTSAudioUrl(textToSpeak, 'en-IN-PrabhatNeural');
    const audio = new Audio(audioUrl);
    audio.muted = isAudioMuted;
    ttsAudioPlayerRef.current = audio;

    audio.onended = () => {
      setIsInterviewerSpeaking(false);
      setInterviewerStatus('listening');
      startSpeechRecognition();
    };

    audio.onerror = (e) => {
      console.warn('Fallback audio error:', e);
      setIsInterviewerSpeaking(false);
      setInterviewerStatus('listening');
      startSpeechRecognition();
    };

    audio.play().catch((err) => {
      console.warn('Fallback audio autoplay deferred:', err);
      setAutoplayBlocked(true);
      const wordCount = textToSpeak.split(/\s+/).filter(Boolean).length;
      const durationMs = Math.max(3000, wordCount * 460 + 1200);
      if (avatarSpeakingTimerRef.current) clearTimeout(avatarSpeakingTimerRef.current);
      avatarSpeakingTimerRef.current = setTimeout(() => {
        setIsInterviewerSpeaking(false);
        setInterviewerStatus('listening');
        startSpeechRecognition();
      }, durationMs);
    });
  }, [isAudioMuted, startSpeechRecognition]);

  // Play Dr. Prabhat Sharma's question speech (WebRTC avatar lipsync or fallback EdgeTTS)
  const playInterviewerAudio = useCallback((textToSpeak: string) => {
    if (isAudioMuted) {
      setInterviewerStatus('listening');
      startSpeechRecognition();
      return;
    }

    stopSpeechRecognition();
    setInterviewerStatus('speaking');
    setIsInterviewerSpeaking(true);

    if (ttsAudioPlayerRef.current) {
      ttsAudioPlayerRef.current.pause();
    }

    // If WebRTC Live Avatar is connected and available:
    if (isAvatarLive && avatarSessionIdRef.current) {
      avatarVideoRef.current?.play().catch(() => {});
      if (avatarAudioRef.current) {
        avatarAudioRef.current.muted = isAudioMuted;
        avatarAudioRef.current.play().catch((err) => {
          console.warn('Avatar audio play deferred:', err);
          setAutoplayBlocked(true);
        });
      }

      api.triggerAvatarSpeak(avatarSessionIdRef.current, textToSpeak, true).then(() => {
        const wordCount = textToSpeak.split(/\s+/).filter(Boolean).length;
        const durationMs = Math.max(3000, wordCount * 460 + 1200);

        if (avatarSpeakingTimerRef.current) clearTimeout(avatarSpeakingTimerRef.current);
        avatarSpeakingTimerRef.current = setTimeout(() => {
          setIsInterviewerSpeaking(false);
          setInterviewerStatus('listening');
          startSpeechRecognition();
        }, durationMs);
      }).catch((err) => {
        console.warn('Avatar speech trigger error, falling back to local TTS player:', err);
        fallbackPlayAudio(textToSpeak);
      });
      return;
    }

    // Direct fallback
    fallbackPlayAudio(textToSpeak);
  }, [isAudioMuted, isAvatarLive, stopSpeechRecognition, startSpeechRecognition, fallbackPlayAudio]);

  // Keep ref up to date
  useEffect(() => {
    playInterviewerAudioRef.current = playInterviewerAudio;
  }, [playInterviewerAudio]);

  // Initialize Dr. Prabhat Sharma WebRTC Avatar Connection
  useEffect(() => {
    let isMounted = true;
    let pc: RTCPeerConnection | null = null;

    async function initAvatar() {
      try {
        const statusData = await api.getAvatarStatus();
        if (!isMounted) return;
        if (!statusData.available) {
          setIsAvatarLive(false);
          setAvatarMode('fallback');
          return;
        }

        pc = new RTCPeerConnection({ iceServers: [] });
        peerConnectionRef.current = pc;

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        const remoteMediaStream = new MediaStream();
        remoteStreamRef.current = remoteMediaStream;

        pc.ontrack = (event) => {
          if (!isMounted) return;
          console.log('[WebRTC ontrack]', event.track.kind);
          remoteMediaStream.addTrack(event.track);

          if (event.track.kind === 'video' && avatarVideoRef.current) {
            avatarVideoRef.current.srcObject = remoteMediaStream;
            avatarVideoRef.current.muted = true; // Video element stays muted to guarantee zero autoplay block
            avatarVideoRef.current.play().catch((err) => console.warn('Video auto-play deferred:', err));
          } else if (event.track.kind === 'audio' && avatarAudioRef.current) {
            const audioStream = new MediaStream([event.track]);
            avatarAudioRef.current.srcObject = audioStream;
            avatarAudioRef.current.muted = isAudioMuted;
            avatarAudioRef.current.play().catch((err) => {
              console.warn('Audio auto-play deferred due to browser policy:', err);
              setAutoplayBlocked(true);
            });
          }

          setIsAvatarLive(true);
          setAvatarMode('live');
        };

        pc.onconnectionstatechange = () => {
          if (!isMounted || !pc) return;
          console.log('[WebRTC] Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setIsAvatarLive(true);
            setAvatarMode('live');
          } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            setIsAvatarLive(false);
            setAvatarMode('fallback');
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const peer = pc;
        // Wait for ICE gathering to complete before sending SDP offer (LiveTalking client standard)
        await new Promise<void>((resolve) => {
          if (peer.iceGatheringState === 'complete') {
            resolve();
          } else {
            const checkState = () => {
              if (peer.iceGatheringState === 'complete') {
                peer.removeEventListener('icegatheringstatechange', checkState);
                resolve();
              }
            };
            peer.addEventListener('icegatheringstatechange', checkState);
            setTimeout(() => {
              peer.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }, 1000);
          }
        });

        const answer = await api.sendAvatarOffer(
          pc.localDescription!.sdp,
          pc.localDescription!.type,
          'wav2lip_avatar_glass_man'
        );

        if (!isMounted || !pc) return;
        avatarSessionIdRef.current = answer.sessionid;
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: answer.type as RTCSdpType,
          sdp: answer.sdp,
        }));
      } catch (err) {
        if (!isMounted) return;
        console.warn('Live avatar setup failed, using fallback portrait:', err);
        setIsAvatarLive(false);
        setAvatarMode('fallback');
      }
    }

    initAvatar();

    return () => {
      isMounted = false;
      if (avatarSpeakingTimerRef.current) clearTimeout(avatarSpeakingTimerRef.current);
      if (pc) {
        pc.close();
      }
    };
  }, [isAudioMuted]);

  // Synchronize audio output mute without restarting WebRTC connection
  useEffect(() => {
    if (avatarVideoRef.current) {
      avatarVideoRef.current.muted = isAudioMuted;
    }
    if (avatarAudioRef.current) {
      avatarAudioRef.current.muted = isAudioMuted;
    }
  }, [isAudioMuted]);

  // Turn-Taking: Reset and start silence timeout
  const resetSilenceTimeout = useCallback(() => {
    clearSilenceTimers();

    let countdown = 2.5;
    setSilenceSecondsRemaining(2.5);

    countdownIntervalRef.current = setInterval(() => {
      countdown = Math.max(0, Math.round((countdown - 0.5) * 10) / 10);
      setSilenceSecondsRemaining(countdown);
      if (countdown <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      }
    }, 500);

    silenceTimerRef.current = setTimeout(() => {
      const finalAccumulated = recognizedVoiceTextRef.current.trim();
      if (finalAccumulated.length > 0 && !isSubmittingRef.current) {
        executeSubmitAnswer(finalAccumulated);
      }
    }, 2500);
  }, [clearSilenceTimers, executeSubmitAnswer]);

  // Initialize Candidate Webcam & Microphone Level Analyser
  useEffect(() => {
    let isMounted = true;

    async function initCandidateMedia() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: { width: { ideal: 640 }, height: { ideal: 480 } }
          });
        } catch {
          // Fall back to audio only if webcam is unavailable
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        candidateStreamRef.current = stream;

        // Video attachment
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          setHasCandidateVideo(true);
          if (candidateVideoRef.current) {
            candidateVideoRef.current.srcObject = stream;
          }
        }

        // Web Audio analyser for live VU meter
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
            const checkVolume = () => {
              if (!isMounted) return;
              if (analyserRef.current && !isMicMuted) {
                analyserRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                const level = Math.min(100, Math.round((avg / 128) * 100));
                setCandidateMicLevel(level);
              } else {
                setCandidateMicLevel(0);
              }
              animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            animFrameRef.current = requestAnimationFrame(checkVolume);
          } catch {
            // AudioContext not supported
          }
        }
      } catch {
        // Microphone permission blocked or device not present
      }
    }

    initCandidateMedia();

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (candidateStreamRef.current) {
        candidateStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isMicMuted]);

  // Initialize Browser Speech Recognition (en-IN)
  useEffect(() => {
    const SpeechRecognitionClass = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setSpeechApiSupported(false);
      setShowKeyboardFallback(true);
      return;
    }

    try {
      const recognition: ISpeechRecognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Indian English tailored recognition

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTrans = '';
        let interimTrans = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTrans += item[0].transcript + ' ';
          } else {
            interimTrans += item[0].transcript;
          }
        }

        if (finalTrans) {
          setRecognizedVoiceText((prev) => (prev ? `${prev} ${finalTrans.trim()}` : finalTrans.trim()));
          setCandidateAnswerInput((prev) => (prev ? `${prev} ${finalTrans.trim()}` : finalTrans.trim()));
        }
        setInterimVoiceText(interimTrans);

        // Turn-Taking: Candidate spoke, so reset the 2.5s silence countdown timer
        resetSilenceTimeout();
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'not-allowed') {
          setBackendError('Microphone access blocked. Please allow microphone permissions in your browser.');
        } else if (event.error === 'network') {
          setBackendError('Speech recognition network service unavailable. Use keyboard fallback below if needed.');
        }
      };

      recognition.onend = () => {
        // Automatically restart if examiner is listening and not currently submitting
        if (interviewerStatus === 'listening' && !isSubmittingRef.current && !isMicMuted) {
          try {
            recognition.start();
          } catch {
            // Already active
          }
        }
      };

      recognitionRef.current = recognition;
    } catch {
      setSpeechApiSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // aborted
        }
      }
    };
  }, [interviewerStatus, isMicMuted, resetSilenceTimeout]);

  // Start interview session on mount via real backend API (guaranteed single run)
  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      if (sessionInitializedRef.current) return;
      sessionInitializedRef.current = true;

      if (!config.sessionId) {
        try {
          const newSession = await api.createInterview({
            topic: config.topic,
            category: config.category,
            subject: config.subject,
            difficulty: config.difficulty,
            duration_minutes: config.duration,
            document_id: config.documentId,
          });
          config.sessionId = newSession.id;
        } catch (err: unknown) {
          if (isMounted) {
            setBackendError(err instanceof Error ? err.message : 'Could not create interview session');
          }
          return;
        }
      }

      try {
        setInterviewerStatus('evaluating');
        const startRes = await api.startInterview(config.sessionId!);
        if (!isMounted) return;

        setCurrentQuestion(startRes.question_text);
        activeQuestionTextRef.current = startRes.question_text;
        setQuestionNumber(startRes.question_number);
        setSupportingPageRef(startRes.supporting_page_ref || null);

        setTranscript([
          {
            speaker: 'Dr. Prabhat Sharma',
            text: startRes.question_text,
            time: '00:05',
            pageRef: startRes.supporting_page_ref,
          },
        ]);

        // Synthesize and play initial question speech via active audio route
        if (playInterviewerAudioRef.current) {
          playInterviewerAudioRef.current(startRes.question_text);
        } else {
          fallbackPlayAudio(startRes.question_text);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setInterviewerStatus('listening');
        setBackendError(err instanceof Error ? err.message : 'Failed to retrieve first question from AI provider.');
        startSpeechRecognition();
      }
    }

    initializeSession();

    return () => {
      isMounted = false;
      if (ttsAudioPlayerRef.current) {
        ttsAudioPlayerRef.current.pause();
      }
      clearSilenceTimers();
      stopSpeechRecognition();
    };
  }, [config, fallbackPlayAudio, startSpeechRecognition, clearSilenceTimers, stopSpeechRecognition]);

  // Manual submission via "Finish Answer" button
  const handleManualFinish = () => {
    const answer = (recognizedVoiceText + ' ' + interimVoiceText).trim() || candidateAnswerInput.trim();
    if (answer) {
      executeSubmitAnswer(answer);
    }
  };

  // Keep Speaking (extend silence timer by 5s)
  const handleKeepSpeaking = () => {
    clearSilenceTimers();
    setSilenceSecondsRemaining(null);
  };

  // Clear recognized speech and restart turn
  const handleClearSpeech = () => {
    clearSilenceTimers();
    setRecognizedVoiceText('');
    setInterimVoiceText('');
    setCandidateAnswerInput('');
  };

  // Replay question audio
  const handleReplayQuestion = () => {
    if (activeQuestionTextRef.current) {
      playInterviewerAudio(activeQuestionTextRef.current);
    }
  };

  // Interrupt examiner audio
  const handleInterruptExaminer = () => {
    if (avatarSpeakingTimerRef.current) {
      clearTimeout(avatarSpeakingTimerRef.current);
    }
    if (avatarSessionIdRef.current) {
      api.interruptAvatar(avatarSessionIdRef.current);
    }
    if (ttsAudioPlayerRef.current) {
      ttsAudioPlayerRef.current.pause();
    }
    setIsInterviewerSpeaking(false);
    setInterviewerStatus('listening');
    startSpeechRecognition();
  };

  // Keyboard fallback form submission
  const handleKeyboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (candidateAnswerInput.trim()) {
      executeSubmitAnswer(candidateAnswerInput.trim());
    }
  };

  // Toggle candidate microphone
  const toggleCandidateMic = () => {
    if (candidateStreamRef.current) {
      const aTrack = candidateStreamRef.current.getAudioTracks()[0];
      if (aTrack) {
        aTrack.enabled = isMicMuted;
      }
    }
    if (!isMicMuted) {
      stopSpeechRecognition();
    } else if (interviewerStatus === 'listening') {
      startSpeechRecognition();
    }
    setIsMicMuted(!isMicMuted);
  };

  // Toggle speaker audio
  const toggleAudioOutput = () => {
    const nextMuted = !isAudioMuted;
    if (avatarVideoRef.current) {
      avatarVideoRef.current.muted = nextMuted;
    }
    if (avatarAudioRef.current) {
      avatarAudioRef.current.muted = nextMuted;
    }
    if (!isAudioMuted && ttsAudioPlayerRef.current) {
      ttsAudioPlayerRef.current.pause();
    }
    setIsAudioMuted(nextMuted);
  };

  // Hardware and stream teardown function
  const performMediaTeardown = useCallback(() => {
    stopSpeechRecognition();
    clearSilenceTimers();
    if (avatarSpeakingTimerRef.current) {
      clearTimeout(avatarSpeakingTimerRef.current);
      avatarSpeakingTimerRef.current = null;
    }
    if (ttsAudioPlayerRef.current) {
      ttsAudioPlayerRef.current.pause();
      ttsAudioPlayerRef.current = null;
    }
    if (avatarSessionIdRef.current) {
      api.interruptAvatar(avatarSessionIdRef.current);
    }
    if (candidateStreamRef.current) {
      candidateStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      candidateStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }
  }, [stopSpeechRecognition, clearSilenceTimers]);

  // Conclude interview and generate score report
  const handleConcludeAndScore = async () => {
    if (isEndingSession || !config.sessionId) return;
    setIsEndingSession(true);
    performMediaTeardown();
    try {
      await api.endInterview(config.sessionId);
    } catch (err) {
      console.warn('Conclude interview request failed, proceeding to results:', err);
    }
    onEndInterview();
  };

  // Cancel / Discard interview early (no score report)
  const handleCancelAndDiscard = async () => {
    if (isEndingSession || !config.sessionId) return;
    setIsEndingSession(true);
    performMediaTeardown();
    try {
      await api.cancelInterview(config.sessionId);
    } catch (err) {
      console.warn('Cancel interview request failed:', err);
    }
    onEndInterview();
  };

  const fullLiveTranscript = (recognizedVoiceText + (interimVoiceText ? ` ${interimVoiceText}` : '')).trim();

  return (
    <div className={styles.roomContainer}>
      {/* Top Session Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <div className={styles.roomBadge}>
            <span className={styles.pulsingDot} />
            <span>LIVE VIVA &bull; VOICE INTERACTION</span>
          </div>
          <div className={styles.topicInfo}>
            <h2 className={styles.roomTitle}>{config.topic}</h2>
            <span className={styles.categoryTag}>
              {config.category === 'viva' ? 'Academic Viva' : config.category === 'job' ? 'Job Interview' : 'Custom Topic'} &bull; {config.difficulty}
            </span>
          </div>
        </div>

        <div className={styles.topBarRight}>
          <div className={styles.timerBadge}>
            <Clock size={16} />
            <span className={styles.timerText}>{formatTime(elapsedSeconds)}</span>
            <span className={styles.timerTotal}>/ {config.duration}:00</span>
          </div>

          <button 
            type="button" 
            onClick={() => setShowEndModal(true)} 
            className={styles.endCallHeaderBtn}
          >
            <PhoneOff size={16} />
            <span>End Session</span>
          </button>
        </div>
      </header>

      {/* Main Video Arena */}
      <main className={styles.arena}>
        {/* Main Stage: Male AI Interviewer (Dr. Prabhat Sharma) */}
        <div className={styles.interviewerStage}>
          <div className={styles.avatarWrapper}>
            {/* Live WebRTC Avatar Video (Permanently mounted in DOM) */}
            <video
              ref={avatarVideoRef}
              autoPlay
              playsInline
              muted={true}
              className={styles.avatarStreamVideo}
              style={{ display: isAvatarLive ? 'block' : 'none' }}
              onLoadedMetadata={() => {
                avatarVideoRef.current?.play().catch(() => {});
              }}
            />
            {/* Live WebRTC Avatar Audio (Dedicated track playback) */}
            <audio
              ref={avatarAudioRef}
              autoPlay
              muted={isAudioMuted}
            />
            {/* Autoplay blocked manual unlock overlay */}
            {autoplayBlocked && (
              <button
                type="button"
                onClick={unlockAudio}
                className={styles.unmuteOverlayBtn}
                title="Click to enable Dr. Prabhat Sharma's voice"
              >
                <Volume2 size={16} />
                <span>Click to Enable Examiner Voice</span>
              </button>
            )}
            {/* Static High-Resolution Fallback Portrait */}
            <div style={{ display: isAvatarLive ? 'none' : 'block', width: '100%', height: '100%' }}>
              <Image
                src="/interviewer_male.jpg"
                alt="Professional Male AI Interviewer"
                width={720}
                height={540}
                priority
                className={styles.avatarImage}
              />
            </div>

            {/* Live WebRTC Badge or Fallback Indicator */}
            <div className={styles.avatarLiveBadge}>
              <span 
                className={styles.avatarLivePulse} 
                style={{ 
                  background: isAvatarLive ? '#10b981' : '#f59e0b',
                  boxShadow: isAvatarLive ? '0 0 6px #10b981' : '0 0 6px #f59e0b'
                }} 
              />
              <span>{isAvatarLive ? 'LIVE AVATAR' : 'HD PORTRAIT'}</span>
            </div>

            {/* Speaking audio wave overlay */}
            {interviewerStatus === 'speaking' && (
              <div className={styles.speakingWaveOverlay}>
                <div className={styles.waveBar} style={{ animationDelay: '0ms' }} />
                <div className={styles.waveBar} style={{ animationDelay: '150ms' }} />
                <div className={styles.waveBar} style={{ animationDelay: '300ms' }} />
                <div className={styles.waveBar} style={{ animationDelay: '450ms' }} />
                <div className={styles.waveBar} style={{ animationDelay: '600ms' }} />
              </div>
            )}

            {/* Status Pill on Stage */}
            <div className={styles.interviewerStatusPill}>
              <span className={`${styles.statusDot} ${styles[interviewerStatus]}`} />
              <span className={styles.statusLabel}>
                {interviewerStatus === 'speaking' && 'Dr. Prabhat is speaking...'}
                {interviewerStatus === 'listening' && 'Dr. Prabhat is listening to you...'}
                {interviewerStatus === 'evaluating' && 'Dr. Prabhat is evaluating response...'}
              </span>
            </div>

            {/* Interviewer Persona Card */}
            <div className={styles.interviewerBioCard}>
              <div className={styles.bioAvatar}>
                <ShieldCheck size={18} className={styles.verifiedIcon} />
              </div>
              <div className={styles.bioInfo}>
                <span className={styles.bioName}>Dr. Prabhat Sharma</span>
                <span className={styles.bioRole}>
                  Senior AI Viva Examiner &bull; {isAvatarLive ? 'Wav2Lip Lip-Sync' : 'Voice: en-IN-Prabhat'}
                </span>
              </div>
            </div>
          </div>

          {/* Candidate Self Video PiP with Live Webcam */}
          <div className={styles.candidatePiP}>
            {hasCandidateVideo ? (
              <video 
                ref={candidateVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={styles.realCandidateVideo} 
              />
            ) : (
              <div className={styles.pipVideoMock}>
                <div className={styles.candidateHead} />
                <div className={styles.candidateShoulders} />
              </div>
            )}
            <div className={styles.pipTag}>
              <span className={styles.pipName}>You (Candidate)</span>
              {isMicMuted ? (
                <MicOff size={12} className={styles.pipMicMuted} />
              ) : (
                <div 
                  className={styles.pipMicLive} 
                  style={{ transform: `scale(${1 + candidateMicLevel / 80})` }}
                  title={`Mic Active: ${candidateMicLevel}%`} 
                />
              )}
            </div>
          </div>

          {/* Question / Live Speech Interaction Card */}
          <div className={styles.questionCard}>
            <div className={styles.questionCardHeader}>
              <div className={styles.questionBadge}>
                <Sparkles size={14} />
                <span>Question {questionNumber}</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {supportingPageRef && (
                  <div className={styles.pdfSourceBadge}>
                    <FileText size={13} />
                    <span>Syllabus: {supportingPageRef}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleReplayQuestion}
                  disabled={isInterviewerSpeaking || isEvaluating}
                  className={styles.replayAudioBtn}
                  title="Replay Dr. Prabhat's speech"
                >
                  <Volume1 size={14} />
                  <span>Replay Audio</span>
                </button>
              </div>
            </div>

            {/* Current Question Text */}
            <p className={styles.questionText}>
              &ldquo;{currentQuestion}&rdquo;
            </p>

            {/* Real-time Subtitle & Voice Capture Box */}
            <div className={styles.voicePipelineBar}>
              <div className={styles.liveSpeechSubtitleBox}>
                <div className={styles.subtitleHeader}>
                  <div className={styles.listeningTag}>
                    <Mic size={13} className={candidateMicLevel > 8 ? styles.livePulse : ''} />
                    <span>
                      {interviewerStatus === 'listening' ? 'Candidate Speech (en-IN):' : 'Awaiting Next Question...'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span 
                      className={styles.speechPrivacyIndicator}
                      title="Speech recognition is provided by the browser's Web Speech API. Audio transcription may be processed through browser vendor speech services according to your browser's privacy policy, and is not guaranteed to be fully local or offline."
                    >
                      Web Speech API &bull; Vendor Cloud-Assisted
                    </span>
                    {candidateMicLevel > 0 && !isMicMuted && (
                      <span style={{ fontSize: '0.7rem', color: '#10b981', fontFamily: 'monospace' }}>
                        VU: {candidateMicLevel}%
                      </span>
                    )}
                  </div>
                </div>

                <p className={`${styles.speechRecognizedText} ${!fullLiveTranscript ? styles.placeholder : ''}`}>
                  {fullLiveTranscript || (interviewerStatus === 'listening' ? 'Speak clearly into your microphone... your words will appear here in real-time.' : 'Listening paused while examiner speaks.')}
                </p>
              </div>

              {/* Turn-Taking Silence Countdown Bar */}
              {silenceSecondsRemaining !== null && fullLiveTranscript && (
                <div className={styles.silenceCountdownBox}>
                  <div className={styles.countdownPill}>
                    <Clock size={13} />
                    <span>Silence detected: submitting in {silenceSecondsRemaining}s</span>
                  </div>
                  <div className={styles.countdownActions}>
                    <button type="button" onClick={handleManualFinish} className={styles.countdownBtn}>
                      Finish Now
                    </button>
                    <button type="button" onClick={handleKeepSpeaking} className={styles.countdownBtn}>
                      Keep Speaking
                    </button>
                  </div>
                </div>
              )}

              {/* Voice Primary Controls */}
              <div className={styles.voiceActionBar}>
                <div className={styles.voicePrimaryActions}>
                  <button
                    type="button"
                    onClick={handleManualFinish}
                    disabled={isEvaluating || !fullLiveTranscript}
                    className={styles.finishSpeechBtn}
                  >
                    {isEvaluating ? <RefreshCw size={14} className={styles.spinning} /> : <Send size={14} />}
                    <span>Finish Answer</span>
                  </button>

                  {fullLiveTranscript && (
                    <button
                      type="button"
                      onClick={handleClearSpeech}
                      disabled={isEvaluating}
                      className={styles.clearSpeechBtn}
                      title="Clear recognized words and speak again"
                    >
                      <RotateCcw size={13} />
                      <span>Re-speak</span>
                    </button>
                  )}

                  {interviewerStatus === 'speaking' && (
                    <button
                      type="button"
                      onClick={handleInterruptExaminer}
                      className={styles.clearSpeechBtn}
                      style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
                    >
                      <Square size={13} />
                      <span>Answer Now (Interrupt)</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowKeyboardFallback(!showKeyboardFallback)}
                  className={styles.keyboardToggleBtn}
                >
                  <Keyboard size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  {showKeyboardFallback ? 'Hide Keyboard Input' : 'Keyboard Fallback (Testing)'}
                </button>
              </div>

              {/* Optional Collapsible Keyboard Fallback Form */}
              {showKeyboardFallback && (
                <form onSubmit={handleKeyboardSubmit} style={{ marginTop: '8px' }}>
                  <div className={styles.responseInputWrapper}>
                    <input
                      type="text"
                      value={candidateAnswerInput}
                      onChange={(e) => setCandidateAnswerInput(e.target.value)}
                      placeholder="Type your answer if microphone recognition is unavailable..."
                      disabled={isEvaluating}
                      className={styles.responseInput}
                    />
                    <button
                      type="submit"
                      disabled={isEvaluating || !candidateAnswerInput.trim()}
                      className={styles.submitAnswerBtn}
                    >
                      <span>Submit</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Previous feedback banner */}
            {lastFeedback && (
              <div className={styles.lastFeedbackBanner}>
                <CheckCircle2 size={14} className={styles.feedbackCheck} />
                <span>Score: {lastFeedback.score}% &bull; {lastFeedback.feedback}</span>
              </div>
            )}

            {/* Backend error banner */}
            {backendError && (
              <div className={styles.errorBanner}>
                <AlertCircle size={14} />
                <span>{backendError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Conversation Transcript Sidebar Drawer */}
        {showTranscript && (
          <aside className={styles.transcriptSidebar}>
            <div className={styles.transcriptHeader}>
              <div className={styles.transcriptTitle}>
                <MessageSquare size={16} />
                <span>Live Viva Transcript</span>
              </div>
              <button 
                onClick={() => setShowTranscript(false)}
                className={styles.closeDrawerBtn}
                aria-label="Close transcript"
              >
                &times;
              </button>
            </div>

            <div className={styles.transcriptList}>
              {transcript.map((item, idx) => (
                <div key={idx} className={styles.transcriptEntry}>
                  <div className={styles.entryHeaderRow}>
                    <span className={styles.entrySpeaker}>{item.speaker}</span>
                    <span className={styles.entryTime}>{item.time}</span>
                  </div>
                  <p className={styles.entryText}>{item.text}</p>
                  {item.pageRef && (
                    <span className={styles.entryCitation}>Page: {item.pageRef}</span>
                  )}
                  {item.score !== undefined && (
                    <div className={styles.transcriptFeedbackBadge}>
                      <strong>Evaluation: {item.score}/100</strong> &bull; {item.feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
      </main>

      {/* Floating Bottom Control Bar */}
      <footer className={styles.bottomControls}>
        <div className={styles.controlGroup}>
          <button
            type="button"
            onClick={toggleCandidateMic}
            className={`${styles.circleBtn} ${isMicMuted ? styles.btnMuted : ''}`}
            title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            type="button"
            onClick={toggleAudioOutput}
            className={`${styles.circleBtn} ${isAudioMuted ? styles.btnMuted : ''}`}
            title={isAudioMuted ? 'Unmute Speaker Audio' : 'Mute Speaker Audio'}
          >
            {isAudioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        <div className={styles.controlGroup}>
          <button
            type="button"
            onClick={() => setShowTranscript(!showTranscript)}
            className={`${styles.textActionBtn} ${showTranscript ? styles.btnActive : ''}`}
          >
            <MessageSquare size={16} />
            <span>Transcript ({transcript.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEndModal(true)}
            className={styles.endCallCircleBtn}
            title="End Viva Early"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      </footer>

      {/* End Viva Early Confirmation Modal */}
      {showEndModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalIconWrap}>
              <PhoneOff size={24} />
            </div>
            <h3 className={styles.modalTitle}>End Interview Session?</h3>
            <p className={styles.modalDesc}>
              Choose how you would like to end this viva session:
            </p>
            <div className={styles.modalOptionGroup}>
              <button 
                type="button"
                onClick={handleConcludeAndScore}
                disabled={isEndingSession}
                className={styles.modalConcludeBtn}
              >
                {isEndingSession ? <RefreshCw size={15} className={styles.spinning} /> : <CheckCircle2 size={16} />}
                <span>{isEndingSession ? 'Finalizing Evaluation...' : 'Conclude & Generate Scorecard'}</span>
              </button>
              <button 
                type="button"
                onClick={handleCancelAndDiscard}
                disabled={isEndingSession}
                className={styles.modalDiscardBtn}
              >
                <PhoneOff size={15} />
                <span>Cancel Viva (No Scorecard)</span>
              </button>
            </div>
            <div className={styles.modalActions}>
              <button 
                type="button"
                onClick={() => setShowEndModal(false)}
                disabled={isEndingSession}
                className={styles.modalCancelBtn}
              >
                Return to Viva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
