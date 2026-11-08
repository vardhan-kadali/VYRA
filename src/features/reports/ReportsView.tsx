'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  FileText, 
  Sparkles,
  ShieldCheck,
  Info
} from 'lucide-react';
import { api, ApiEvaluation, ApiInterviewSession } from '@/lib/api';
import styles from './ReportsView.module.css';

export const ReportsView: React.FC = () => {
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('session_id');

  const [showSample, setShowSample] = useState(false);
  const [realReport, setRealReport] = useState<ApiEvaluation | null>(null);
  const [interruptedSession, setInterruptedSession] = useState<ApiInterviewSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadReport() {
      setLoading(true);
      setInterruptedSession(null);
      try {
        if (sessionIdParam) {
          try {
            const rep = await api.getInterviewReport(sessionIdParam);
            if (isMounted) setRealReport(rep);
          } catch {
            // Report not available (e.g. session was cancelled or interrupted)
            try {
              const sessionInfo = await api.getInterview(sessionIdParam);
              if (isMounted) setInterruptedSession(sessionInfo);
            } catch {
              // Session not found
            }
          }
        } else {
          const reps = await api.listReports();
          if (isMounted && reps.length > 0) {
            setRealReport(reps[0]);
          }
        }
      } catch {
        // Handled silently
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadReport();
    return () => { isMounted = false; };
  }, [sessionIdParam]);

  const hasRealReport = Boolean(realReport);
  const isDisplayingSample = showSample || (!hasRealReport && showSample);

  // Active display data
  const overallScore = isDisplayingSample ? 88 : realReport ? realReport.overall_score : 85;
  const grade = isDisplayingSample ? 'A' : realReport ? realReport.grade : 'A';
  const topic = isDisplayingSample ? 'C++ Object Oriented Programming & Memory Management' : realReport ? realReport.topic : 'Viva Session';
  const category = isDisplayingSample ? 'Academic Viva' : realReport ? (realReport.category === 'viva' ? 'Academic Viva' : 'Interview') : 'Academic Viva';
  const duration = isDisplayingSample ? 15 : realReport ? realReport.duration_minutes : 15;
  const docName = isDisplayingSample ? null : realReport?.document_name;

  const subjectKnowledge = isDisplayingSample ? 92 : realReport ? realReport.subject_knowledge : 90;
  const techVocab = isDisplayingSample ? 88 : realReport ? realReport.technical_vocabulary : 85;
  const communication = isDisplayingSample ? 84 : realReport ? realReport.communication : 82;
  const codeApplication = isDisplayingSample ? 82 : realReport ? realReport.code_application : 80;
  const syllabusGrounding = isDisplayingSample ? 95 : realReport ? realReport.syllabus_grounding : 90;

  const strengths = isDisplayingSample ? [
    'Clear verbal explanation of virtual tables (vtable) and runtime dynamic dispatch.',
    'Instant recall of memory allocation differences between stack frames and process heap.',
    'Proper identification of RAII principles and automatic cleanup with unique_ptr.'
  ] : realReport?.strengths || [
    'Strong foundational grasp of core principles',
    'Articulate and structured response structure',
    'Disciplined use of academic terminology'
  ];

  const improvementAreas = isDisplayingSample ? [
    'Practice explaining cyclic reference memory leaks with std::shared_ptr and the solution using std::weak_ptr.',
    'State time complexity guarantees when discussing custom allocator overheads.'
  ] : realReport?.improvement_areas || [
    'Elaborate with deeper implementation edge cases',
    'Expand on architectural trade-offs during verbal analysis'
  ];

  const feedback = isDisplayingSample ? (
    '“The candidate exhibited superior technical rigor and structured explanations throughout this 15-minute viva. Answers were concise and free of unnecessary fluff. Well prepared for college university practical vivas and senior technical screening rounds.”'
  ) : realReport ? (
    `“${realReport.examiner_feedback}”`
  ) : '';

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.badge}>ANALYTICS & RUBRIC</div>
          <h1 className={styles.title}>Progress & Reports</h1>
          <p className={styles.subtitle}>
            In-depth evaluation scorecards, syllabus grounding metrics, and examiner feedback.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button 
            type="button" 
            onClick={() => setShowSample(!showSample)}
            className={styles.toggleBtn}
          >
            {showSample ? 'Show Real State' : 'Preview Sample Evaluation Report'}
          </button>
          <Link href="/interview" className={styles.startBtn}>
            <Play size={16} fill="currentColor" />
            <span>New Interview</span>
          </Link>
        </div>
      </div>

      {/* Main Content: Interrupted Session vs Empty State vs Evaluation Report */}
      {interruptedSession && !hasRealReport && !showSample ? (
        <div className={styles.interruptedContainer}>
          <div className={styles.interruptedHero}>
            <div className={styles.interruptedBadge}>
              <AlertTriangle size={15} />
              <span>SESSION INTERRUPTED &bull; {interruptedSession.status.toUpperCase()}</span>
            </div>
            <h2 className={styles.interruptedTitle}>{interruptedSession.topic}</h2>
            <div className={styles.interruptedMetaRow}>
              <span>Category: {interruptedSession.category === 'viva' ? 'Academic Viva' : 'Interview'}</span>
              <span>&bull;</span>
              <span>Scheduled: {interruptedSession.duration_minutes} mins</span>
              <span>&bull;</span>
              <span>Difficulty: {interruptedSession.difficulty}</span>
              {interruptedSession.document_name && (
                <>
                  <span>&bull;</span>
                  <span>Syllabus: {interruptedSession.document_name}</span>
                </>
              )}
            </div>
          </div>

          <div className={styles.interruptedNoticeCard}>
            <div className={styles.interruptedNoticeHeader}>
              <Info size={18} className={styles.noticeIcon} />
              <strong>Official Examination Policy Notice</strong>
            </div>
            <p className={styles.interruptedNoticeText}>
              This viva session was ended before completing all required examination rounds. In accordance with university academic viva guidelines, an official 5-dimensional rubric scorecard and final letter grade are not fabricated or generated for incomplete sessions.
            </p>
            <p className={styles.interruptedNoticeSub}>
              All questions asked and answers submitted during this session have been preserved in the system database and can be reviewed in your Interview History.
            </p>
          </div>

          {interruptedSession.exchanges && interruptedSession.exchanges.length > 0 && (
            <div className={styles.interruptedExchangesSection}>
              <h3 className={styles.exchangesHeading}>
                <span>Questions Covered ({interruptedSession.exchanges.length})</span>
              </h3>
              <div className={styles.exchangesList}>
                {interruptedSession.exchanges.map((ex, i) => (
                  <div key={i} className={styles.exchangeCard}>
                    <div className={styles.exchangeHeader}>
                      <span className={styles.exchangeNum}>Question {ex.question_number}</span>
                      {ex.answer_score !== undefined && ex.answer_score !== null && (
                        <span className={styles.exchangeScore}>Score: {ex.answer_score}%</span>
                      )}
                    </div>
                    <p className={styles.exchangeQuestion}>&ldquo;{ex.question_text}&rdquo;</p>
                    {ex.candidate_answer ? (
                      <div className={styles.candidateAnswerBlock}>
                        <span className={styles.answerLabel}>Your Answer:</span>
                        <p className={styles.answerText}>{ex.candidate_answer}</p>
                      </div>
                    ) : (
                      <p className={styles.noAnswerGiven}>[Session ended before answer was submitted]</p>
                    )}
                    {ex.answer_feedback && (
                      <p className={styles.exchangeFeedback}>
                        <strong>Examiner Feedback:</strong> {ex.answer_feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.interruptedCtaRow}>
            <Link href="/interview" className={styles.primaryActionBtn}>
              <Play size={16} fill="currentColor" />
              <span>Start New Interview</span>
            </Link>
            <Link href="/history" className={styles.secondaryActionBtn}>
              <span>View Interview History</span>
            </Link>
          </div>
        </div>
      ) : !hasRealReport && !showSample ? (
        <div className={styles.emptyContainer}>
          <div className={styles.emptyIconCircle}>
            <BarChart3 size={40} />
          </div>
          <h3 className={styles.emptyTitle}>No Performance Reports Yet</h3>
          <p className={styles.emptyDescription}>
            You haven&apos;t completed any interview sessions yet. Complete your first viva with Dr. Prabhat Sharma to generate comprehensive 5-dimensional evaluation scorecards.
          </p>
          <div className={styles.emptyActions}>
            <Link href="/interview" className={styles.emptyPrimaryCta}>
              <Play size={16} fill="currentColor" />
              <span>Launch First Session</span>
            </Link>
            <button 
              type="button" 
              onClick={() => setShowSample(true)}
              className={styles.emptySecondaryCta}
            >
              Preview Sample Scorecard
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.reportContent}>
          {/* Top Scorecard Summary */}
          <div className={styles.scoreHero}>
            <div className={styles.scoreHeroLeft}>
              <div className={styles.scoreCircle}>
                <span className={styles.scoreNumber}>{overallScore}</span>
                <span className={styles.scoreMax}>/100</span>
              </div>
              <div className={styles.scoreMeta}>
                <div className={styles.scoreStatusBadge}>Grade: {grade} &bull; Proficient</div>
                <h2 className={styles.sessionTopic}>{topic}</h2>
                <div className={styles.sessionDetails}>
                  <span>Category: {category}</span>
                  <span>&bull;</span>
                  <span>Duration: {duration} mins</span>
                  <span>&bull;</span>
                  <span>Examiner: Dr. Prabhat Sharma</span>
                </div>
              </div>
            </div>

            <div className={styles.scoreHeroRight}>
              <div className={styles.badgeFidelity}>
                <ShieldCheck size={18} />
                <div>
                  <strong>{syllabusGrounding}% Syllabus Grounding</strong>
                  <p>
                    {docName ? `Questions strictly adhered to ${docName}.` : 'Evaluation grounded strictly in curriculum topic.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 5-Dimensional Competency Breakdown */}
          <div className={styles.rubricSection}>
            <h3 className={styles.rubricTitle}>Competency Rubric Breakdown</h3>
            <div className={styles.rubricGrid}>
              <div className={styles.rubricCard}>
                <div className={styles.rubricCardHeader}>
                  <span className={styles.rubricDimension}>1. Conceptual Accuracy</span>
                  <span className={styles.rubricScore}>{subjectKnowledge}%</span>
                </div>
                <div className={styles.rubricBar}>
                  <div className={styles.rubricFill} style={{ width: `${subjectKnowledge}%` }} />
                </div>
                <p className={styles.rubricNote}>Precision of definitions, theoretical accuracy, and conceptual depth.</p>
              </div>

              <div className={styles.rubricCard}>
                <div className={styles.rubricCardHeader}>
                  <span className={styles.rubricDimension}>2. Technical Vocabulary</span>
                  <span className={styles.rubricScore}>{techVocab}%</span>
                </div>
                <div className={styles.rubricBar}>
                  <div className={styles.rubricFill} style={{ width: `${techVocab}%` }} />
                </div>
                <p className={styles.rubricNote}>Accurate usage of formal academic terminology and syntax principles.</p>
              </div>

              <div className={styles.rubricCard}>
                <div className={styles.rubricCardHeader}>
                  <span className={styles.rubricDimension}>3. Response Structure & Speed</span>
                  <span className={styles.rubricScore}>{communication}%</span>
                </div>
                <div className={styles.rubricBar}>
                  <div className={styles.rubricFill} style={{ width: `${communication}%` }} />
                </div>
                <p className={styles.rubricNote}>Structured response delivery with clear logical progression.</p>
              </div>

              <div className={styles.rubricCard}>
                <div className={styles.rubricCardHeader}>
                  <span className={styles.rubricDimension}>4. Practical Code Walkthrough</span>
                  <span className={styles.rubricScore}>{codeApplication}%</span>
                </div>
                <div className={styles.rubricBar}>
                  <div className={styles.rubricFill} style={{ width: `${codeApplication}%` }} />
                </div>
                <p className={styles.rubricNote}>Ability to relate theoretical concepts to practical implementation.</p>
              </div>

              <div className={styles.rubricCard}>
                <div className={styles.rubricCardHeader}>
                  <span className={styles.rubricDimension}>5. Syllabus Depth & Grounding</span>
                  <span className={styles.rubricScore}>{syllabusGrounding}%</span>
                </div>
                <div className={styles.rubricBar}>
                  <div className={styles.rubricFill} style={{ width: `${syllabusGrounding}%` }} />
                </div>
                <p className={styles.rubricNote}>Adherence to the provided document checklist and core syllabus topics.</p>
              </div>
            </div>
          </div>

          {/* Strengths & Growth Areas Split */}
          <div className={styles.insightsSplit}>
            <div className={styles.strengthsCard}>
              <div className={styles.insightHeader}>
                <CheckCircle2 size={18} className={styles.strengthIcon} />
                <h4 className={styles.insightTitle}>Key Strengths</h4>
              </div>
              <ul className={styles.insightList}>
                {strengths.map((strItem, i) => (
                  <li key={i}>{strItem}</li>
                ))}
              </ul>
            </div>

            <div className={styles.growthCard}>
              <div className={styles.insightHeader}>
                <AlertTriangle size={18} className={styles.growthIcon} />
                <h4 className={styles.insightTitle}>Recommended Focus Areas</h4>
              </div>
              <ul className={styles.insightList}>
                {improvementAreas.map((impItem, i) => (
                  <li key={i}>{impItem}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Examiner Notes */}
          <div className={styles.examinerNotes}>
            <div className={styles.examinerHeader}>
              <Sparkles size={16} className={styles.notesSparkle} />
              <span className={styles.notesTitle}>Examiner Feedback &bull; Dr. Prabhat Sharma</span>
            </div>
            <p className={styles.notesBody}>
              {feedback}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
