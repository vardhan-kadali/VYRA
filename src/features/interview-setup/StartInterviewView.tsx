'use client';

import React, { useState, useRef } from 'react';
import { 
  GraduationCap, 
  Briefcase, 
  Sparkles, 
  UploadCloud, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Gauge,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { InterviewCategory, InterviewDifficulty, InterviewDuration, InterviewConfig } from '@/types/interview';
import { api } from '@/lib/api';
import styles from './StartInterviewView.module.css';

interface StartInterviewViewProps {
  onContinue: (config: InterviewConfig) => void;
  initialConfig?: Partial<InterviewConfig>;
}

export const StartInterviewView: React.FC<StartInterviewViewProps> = ({ 
  onContinue, 
  initialConfig 
}) => {
  const [topic, setTopic] = useState(initialConfig?.topic || 'Data Structures & Algorithms');
  const [category, setCategory] = useState<InterviewCategory>(initialConfig?.category || 'viva');
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>(initialConfig?.difficulty || 'intermediate');
  const [duration, setDuration] = useState<InterviewDuration>(initialConfig?.duration || 15);
  
  const [pdfFile, setPdfFile] = useState<File | null>(initialConfig?.pdfFile || null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const academicSubjects = [
    'C',
    'C++',
    'Java',
    'Python',
    'Data Structures',
    'DBMS',
    'Operating Systems',
    'Other subjects'
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setPdfError('Invalid file type. Only PDF documents (.pdf) are supported.');
      setPdfFile(null);
      setUploadedDocId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPdfError(null);
    setPdfFile(file);
    setUploadedDocId(null);
  };

  const handleRemoveFile = () => {
    setPdfFile(null);
    setPdfError(null);
    setUploadedDocId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubjectClick = (subj: string) => {
    if (subj === 'Other subjects') {
      setTopic('');
    } else {
      setTopic(subj);
    }
    setTopicError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setTopicError('Please specify an interview topic to proceed.');
      return;
    }

    setTopicError(null);
    setPdfError(null);
    setIsSubmitting(true);

    let docId = uploadedDocId;

    try {
      // 1. If PDF is selected but not yet uploaded to backend, upload it now
      if (pdfFile && !docId) {
        const docRes = await api.uploadDocument(pdfFile);
        docId = docRes.id;
        setUploadedDocId(docId);
      }

      // 2. Create the real session in the backend SQLite database
      const sessionRes = await api.createInterview({
        topic: topic.trim(),
        category,
        subject: category === 'viva' ? topic.trim() : undefined,
        difficulty,
        duration_minutes: duration,
        document_id: docId || undefined,
      });

      setIsSubmitting(false);
      onContinue({
        topic: topic.trim(),
        category,
        difficulty,
        duration,
        pdfFile,
        pdfFileName: pdfFile ? pdfFile.name : undefined,
        documentId: docId || undefined,
        sessionId: sessionRes.id,
      });
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to connect to backend server.';
      if (pdfFile && (msg.includes('OCR') || msg.includes('PDF') || msg.includes('extract'))) {
        setPdfError(msg);
      } else {
        setTopicError(`Backend Error: ${msg}. Make sure backend is running.`);
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerArea}>
        <div className={styles.badge}>INTERVIEW CONFIGURATION</div>
        <h1 className={styles.title}>Start Interview</h1>
        <p className={styles.subtitle}>
          Configure your practice session. Choose a domain, customize parameters, or attach your study material.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* A. TOPIC INPUT */}
        <section className={styles.section}>
          <label htmlFor="topicInput" className={styles.sectionLabel}>
            What topic do you want to be interviewed about?
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="topicInput"
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                if (e.target.value.trim()) setTopicError(null);
              }}
              placeholder="e.g. Data Structures & Algorithms, React Performance, SQL Indexing..."
              className={`${styles.textInput} ${topicError ? styles.inputError : ''}`}
            />
          </div>
          {topicError && (
            <div className={styles.errorMessage}>
              <AlertCircle size={15} />
              <span>{topicError}</span>
            </div>
          )}
        </section>

        {/* B. CATEGORY SELECTION */}
        <section className={styles.section}>
          <span className={styles.sectionSubLabel}>Select Category</span>
          <div className={styles.categoryGrid}>
            {/* 1. Academic Viva */}
            <div
              className={`${styles.categoryCard} ${category === 'viva' ? styles.categorySelected : ''}`}
              onClick={() => setCategory('viva')}
              role="button"
              tabIndex={0}
            >
              <div className={styles.cardHeader}>
                <div className={`${styles.categoryIcon} ${styles.iconViva}`}>
                  <GraduationCap size={22} />
                </div>
                {category === 'viva' && <CheckCircle2 size={18} className={styles.checkIcon} />}
              </div>
              <h3 className={styles.categoryTitle}>Academic Viva</h3>
              <p className={styles.categoryDesc}>
                Programming languages, academic subjects and concepts.
              </p>
            </div>

            {/* 2. Job Interview */}
            <div
              className={`${styles.categoryCard} ${category === 'job' ? styles.categorySelected : ''}`}
              onClick={() => setCategory('job')}
              role="button"
              tabIndex={0}
            >
              <div className={styles.cardHeader}>
                <div className={`${styles.categoryIcon} ${styles.iconJob}`}>
                  <Briefcase size={22} />
                </div>
                {category === 'job' && <CheckCircle2 size={18} className={styles.checkIcon} />}
              </div>
              <h3 className={styles.categoryTitle}>Job Interview</h3>
              <p className={styles.categoryDesc}>
                Technical and HR interviews.
              </p>
            </div>

            {/* 3. Any Other Topic */}
            <div
              className={`${styles.categoryCard} ${category === 'custom' ? styles.categorySelected : ''}`}
              onClick={() => setCategory('custom')}
              role="button"
              tabIndex={0}
            >
              <div className={styles.cardHeader}>
                <div className={`${styles.categoryIcon} ${styles.iconCustom}`}>
                  <Sparkles size={22} />
                </div>
                {category === 'custom' && <CheckCircle2 size={18} className={styles.checkIcon} />}
              </div>
              <h3 className={styles.categoryTitle}>Any Other Topic</h3>
              <p className={styles.categoryDesc}>
                Practise any custom topic.
              </p>
            </div>
          </div>
        </section>

        {/* C. ACADEMIC VIVA OPTIONS */}
        {category === 'viva' && (
          <section className={styles.sectionPills}>
            <span className={styles.pillsLabel}>Recommended Academic Viva Subjects:</span>
            <div className={styles.pillList}>
              {academicSubjects.map((subj) => (
                <button
                  type="button"
                  key={subj}
                  onClick={() => handleSubjectClick(subj)}
                  className={`${styles.subjectPill} ${topic === subj ? styles.pillActive : ''}`}
                >
                  {subj}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* D. OPTIONAL STUDY MATERIAL UPLOAD (PDF ONLY) */}
        <section className={styles.section}>
          <div className={styles.uploadHeader}>
            <span className={styles.sectionSubLabel}>Optional Study Material (PDF Only)</span>
            <span className={styles.optionalTag}>Optional</span>
          </div>

          {!pdfFile ? (
            <div
              className={`${styles.uploadBox} ${pdfError ? styles.uploadBoxError : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="pdfUploadInput"
              />
              <div className={styles.uploadIconCircle}>
                <UploadCloud size={24} />
              </div>
              <div className={styles.uploadPrompt}>
                <span className={styles.uploadPrimaryText}>Click to upload or drag & drop</span>
                <span className={styles.uploadSecondaryText}>PDF documents only (Syllabus, notes, question banks)</span>
              </div>
            </div>
          ) : (
            <div className={styles.fileSelectedCard}>
              <div className={styles.fileInfo}>
                <div className={styles.pdfBadge}>
                  <FileText size={20} />
                </div>
                <div>
                  <span className={styles.fileName}>{pdfFile.name}</span>
                  <span className={styles.fileSize}>
                    {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Strict document grounding active
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className={styles.removeFileBtn}
                title="Remove uploaded document"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {pdfError && (
            <div className={styles.errorMessage}>
              <AlertCircle size={15} />
              <span>{pdfError}</span>
            </div>
          )}

          <div className={styles.strictRuleNotice}>
            <span className={styles.noticeIcon}>ℹ</span>
            <span>
              <strong>Strict Grounding:</strong> When a PDF is provided, all interview questions and follow-ups will be grounded strictly in your uploaded document.
            </span>
          </div>
        </section>

        {/* E & F. DIFFICULTY & DURATION */}
        <div className={styles.twoColumnGrid}>
          {/* Difficulty */}
          <section className={styles.section}>
            <div className={styles.columnHeader}>
              <Gauge size={16} className={styles.colIcon} />
              <span className={styles.sectionSubLabel}>Difficulty Level</span>
            </div>
            <div className={styles.choiceGroup}>
              {(['beginner', 'intermediate', 'advanced'] as InterviewDifficulty[]).map((level) => (
                <button
                  type="button"
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`${styles.choicePill} ${difficulty === level ? styles.choiceSelected : ''}`}
                >
                  <span className={styles.choiceText}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Duration */}
          <section className={styles.section}>
            <div className={styles.columnHeader}>
              <Clock size={16} className={styles.colIcon} />
              <span className={styles.sectionSubLabel}>Interview Duration</span>
            </div>
            <div className={styles.choiceGroup}>
              {([5, 15, 30] as InterviewDuration[]).map((dur) => (
                <button
                  type="button"
                  key={dur}
                  onClick={() => setDuration(dur)}
                  className={`${styles.choicePill} ${duration === dur ? styles.choiceSelected : ''}`}
                >
                  <span className={styles.choiceText}>{dur} minutes</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* G. CONTINUE BUTTON */}
        <div className={styles.actionRow}>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`${styles.continueButton} ${isSubmitting ? styles.btnDisabled : ''}`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={18} className={styles.spinning} />
                <span>Initializing Interview Session...</span>
              </>
            ) : (
              <>
                <span>Continue to Device Check</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
