export type InterviewCategory = 'viva' | 'job' | 'custom';
export type InterviewDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type InterviewDuration = 5 | 15 | 30;

export interface InterviewConfig {
  topic: string;
  category: InterviewCategory;
  subject?: string;
  subTopic?: string;
  pdfFile?: File | null;
  pdfFileName?: string;
  documentId?: string;
  sessionId?: string;
  difficulty: InterviewDifficulty;
  duration: InterviewDuration;
}

export type InterviewStage = 'setup' | 'device-check' | 'in-progress' | 'completed';

export interface DeviceStatus {
  cameraReady: boolean;
  microphoneReady: boolean;
  speakerReady: boolean;
  cameraPermissionGranted: boolean;
  microphonePermissionGranted: boolean;
}
