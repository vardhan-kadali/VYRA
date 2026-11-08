'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StartInterviewView } from '@/features/interview-setup/StartInterviewView';
import { DeviceCheckView } from '@/features/interview-setup/DeviceCheckView';
import { InterviewRoomView } from '@/features/interview-setup/InterviewRoomView';
import { InterviewConfig } from '@/types/interview';

export default function InterviewPage() {
  const router = useRouter();
  const [stage, setStage] = useState<'setup' | 'device-check' | 'room'>('setup');
  const [config, setConfig] = useState<InterviewConfig>({
    topic: 'C++ Object Oriented Programming and Memory Management',
    category: 'viva',
    subject: 'C++',
    difficulty: 'intermediate',
    duration: 15,
  });

  const handleStartContinue = (newConfig: InterviewConfig) => {
    setConfig(newConfig);
    setStage('device-check');
  };

  const handleDeviceCheckBack = () => {
    setStage('setup');
  };

  const handleDeviceCheckProceed = () => {
    setStage('room');
  };

  const handleEndInterview = () => {
    if (config.sessionId) {
      router.push(`/reports?session_id=${config.sessionId}`);
    } else {
      router.push('/reports');
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100%' }}>
      {stage === 'setup' && (
        <StartInterviewView onContinue={handleStartContinue} />
      )}

      {stage === 'device-check' && (
        <DeviceCheckView
          config={config}
          onBack={handleDeviceCheckBack}
          onProceed={handleDeviceCheckProceed}
        />
      )}

      {stage === 'room' && (
        <InterviewRoomView
          config={config}
          onEndInterview={handleEndInterview}
        />
      )}
    </div>
  );
}
