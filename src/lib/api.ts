const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export interface ApiProfile {
  id: number;
  full_name: string;
  email: string;
  department?: string;
  target_goal?: string;
  default_category: string;
  default_difficulty: string;
  default_duration: number;
  strict_pdf_grounding: boolean;
  theme_mode: string;
  font_scale: string;
}

export interface ApiDocument {
  id: string;
  original_filename: string;
  file_size_bytes: number;
  page_count: number;
  total_chunks: number;
  created_at: string;
}

export interface ApiInterviewExchange {
  id: number;
  question_number: number;
  question_text: string;
  supporting_page_ref?: string;
  candidate_answer?: string;
  answer_timestamp?: string;
  answer_score?: number;
  answer_feedback?: string;
}

export interface ApiInterviewSession {
  id: string;
  topic: string;
  category: string;
  subject?: string;
  difficulty: string;
  duration_minutes: number;
  document_id?: string;
  document_name?: string;
  status: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  exchanges: ApiInterviewExchange[];
}

export interface ApiInterviewSummaryItem {
  id: string;
  topic: string;
  category: string;
  subject?: string;
  difficulty: string;
  duration_minutes: number;
  document_name?: string;
  status: string;
  created_at: string;
  overall_score?: number;
}

export interface ApiEvaluation {
  session_id: string;
  overall_score: number;
  grade: string;
  subject_knowledge: number;
  technical_vocabulary: number;
  communication: number;
  code_application: number;
  syllabus_grounding: number;
  strengths: string[];
  improvement_areas: string[];
  examiner_feedback: string;
  topic: string;
  category: string;
  duration_minutes: number;
  document_name?: string;
  created_at: string;
}

export interface ApiDashboardStats {
  completed_count: number;
  practice_hours: number;
  average_score: number | null;
  pdf_tests_count: number;
  competency_averages: {
    subject_knowledge: number | null;
    technical_vocabulary: number | null;
    communication: number | null;
    syllabus_grounding: number | null;
  };
  recent_activity: Array<{
    id: string;
    topic: string;
    category: string;
    subject?: string;
    difficulty: string;
    duration_minutes: number;
    document_name?: string;
    status: string;
    created_at: string;
    score?: number;
  }>;
}

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.json();
  },

  async getAiHealth() {
    const res = await fetch(`${API_BASE_URL}/ai/health`);
    return res.json();
  },

  async getProfile(): Promise<ApiProfile> {
    const res = await fetch(`${API_BASE_URL}/profile`);
    if (!res.ok) throw new Error('Failed to load profile');
    return res.json();
  },

  async updateProfile(data: Partial<ApiProfile>): Promise<ApiProfile> {
    const res = await fetch(`${API_BASE_URL}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  async uploadDocument(file: File): Promise<ApiDocument> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  async createInterview(config: {
    topic: string;
    category: string;
    subject?: string;
    difficulty: string;
    duration_minutes: number;
    document_id?: string;
  }): Promise<ApiInterviewSession> {
    const res = await fetch(`${API_BASE_URL}/interviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create session' }));
      throw new Error(err.detail || 'Failed to create session');
    }
    return res.json();
  },

  async startInterview(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/start`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to start interview' }));
      throw new Error(err.detail || 'Failed to start interview');
    }
    return res.json();
  },

  async submitAnswer(sessionId: string, answer: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to submit answer' }));
      throw new Error(err.detail || 'Failed to submit answer');
    }
    return res.json();
  },

  async endInterview(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/end`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to conclude interview' }));
      throw new Error(err.detail || 'Failed to conclude interview');
    }
    return res.json();
  },

  async cancelInterview(sessionId: string): Promise<{ session_id: string; status: string }> {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to cancel interview' }));
      throw new Error(err.detail || 'Failed to cancel interview');
    }
    return res.json();
  },

  async getInterview(sessionId: string): Promise<ApiInterviewSession> {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}`);
    if (!res.ok) throw new Error('Interview not found');
    return res.json();
  },

  async listInterviews(category?: string): Promise<ApiInterviewSummaryItem[]> {
    const url = category && category !== 'all'
      ? `${API_BASE_URL}/interviews?category=${encodeURIComponent(category)}`
      : `${API_BASE_URL}/interviews`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load interview records');
    return res.json();
  },

  async getInterviewReport(sessionId: string): Promise<ApiEvaluation> {
    const res = await fetch(`${API_BASE_URL}/interviews/${sessionId}/report`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Report not found' }));
      throw new Error(err.detail || 'Report not found');
    }
    return res.json();
  },

  async listReports(): Promise<ApiEvaluation[]> {
    const res = await fetch(`${API_BASE_URL}/reports`);
    if (!res.ok) throw new Error('Failed to load reports');
    return res.json();
  },

  async getDashboardStats(): Promise<ApiDashboardStats> {
    const res = await fetch(`${API_BASE_URL}/dashboard/stats`);
    if (!res.ok) throw new Error('Failed to load dashboard telemetry');
    return res.json();
  },

  getTTSAudioUrl(text: string, voice?: string): string {
    const params = new URLSearchParams({ text });
    if (voice) params.append('voice', voice);
    return `${API_BASE_URL}/audio/tts?${params.toString()}`;
  },

  async fetchTTSAudio(text: string, voice?: string): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/audio/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to synthesize speech' }));
      throw new Error(err.detail || 'Failed to synthesize speech');
    }
    return res.blob();
  },

  async getVoices() {
    const res = await fetch(`${API_BASE_URL}/audio/voices`);
    return res.json();
  },

  async getAvatarStatus(): Promise<{
    available: boolean;
    status: string;
    avatar_id: string;
    persona?: string;
    voice?: string;
    transport?: string;
    fallback?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE_URL}/avatar/status`);
      return res.json();
    } catch {
      return {
        available: false,
        status: 'offline',
        avatar_id: 'wav2lip_avatar_glass_man',
        fallback: 'high_res_portrait_with_edgetts',
      };
    }
  },

  async sendAvatarOffer(sdp: string, type: string, avatar = 'wav2lip_avatar_glass_man'): Promise<{
    sdp: string;
    type: string;
    sessionid: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/avatar/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp, type, avatar }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'WebRTC offer failed' }));
      throw new Error(err.detail || 'WebRTC offer failed');
    }
    return res.json();
  },

  async triggerAvatarSpeak(sessionid: string, text: string, interrupt = true): Promise<{
    status: string;
    detail: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/avatar/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionid, text, interrupt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to trigger avatar speech' }));
      throw new Error(err.detail || 'Failed to trigger avatar speech');
    }
    return res.json();
  },

  async interruptAvatar(sessionid: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/avatar/interrupt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionid }),
      });
    } catch {
      // ignore
    }
  },
};
