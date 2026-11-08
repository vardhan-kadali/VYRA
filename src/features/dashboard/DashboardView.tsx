'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Play, 
  Clock, 
  Award, 
  TrendingUp, 
  BookOpen, 
  FileCheck2, 
  ArrowRight, 
  Sparkles,
  BarChart3,
  FolderOpen
} from 'lucide-react';
import { api, ApiDashboardStats } from '@/lib/api';
import styles from './DashboardView.module.css';

export const DashboardView: React.FC = () => {
  const [showSampleData, setShowSampleData] = useState(false);
  const [stats, setStats] = useState<ApiDashboardStats | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const data = await api.getDashboardStats();
        if (isMounted) setStats(data);
      } catch {
        // Handled silently
      }
    }
    loadStats();
    return () => { isMounted = false; };
  }, []);

  const hasRealData = stats && stats.completed_count > 0;
  const isDisplayingSample = showSampleData || (!hasRealData && showSampleData);

  const completedCount = isDisplayingSample ? '12' : stats ? String(stats.completed_count) : '0';
  const practiceHours = isDisplayingSample ? '3.5 hrs' : stats ? `${stats.practice_hours} hrs` : '0 hrs';
  const averageScore = isDisplayingSample ? '86%' : stats && stats.average_score !== null ? `${stats.average_score}%` : '—';
  const pdfTestsCount = isDisplayingSample ? '4' : stats ? String(stats.pdf_tests_count) : '0';

  const recentList = isDisplayingSample ? [
    {
      id: 'mock-1',
      topic: 'C++ Object Oriented Programming & VTables',
      category: 'Academic Viva',
      duration: '15 mins',
      difficulty: 'Intermediate',
      score: 92,
      isPdf: false,
    },
    {
      id: 'mock-2',
      topic: 'Data Structures: Binary Trees & AVL Balancing',
      category: 'Academic Viva',
      duration: '15 mins',
      difficulty: 'Advanced',
      score: 84,
      isPdf: false,
    },
    {
      id: 'mock-3',
      topic: 'DBMS Normalization & Functional Dependencies',
      category: 'PDF Grounded',
      duration: '30 mins',
      difficulty: 'Intermediate',
      score: 88,
      isPdf: true,
    }
  ] : (stats?.recent_activity || []).map((s) => ({
    id: s.id,
    topic: s.topic,
    category: s.category === 'viva' ? 'Academic Viva' : s.category === 'job' ? 'Job Interview' : 'Custom',
    duration: `${s.duration_minutes} mins`,
    difficulty: s.difficulty,
    score: s.score,
    isPdf: Boolean(s.document_name),
  }));

  const subjClarity = isDisplayingSample ? '90%' : stats?.competency_averages.subject_knowledge ? `${stats.competency_averages.subject_knowledge}%` : 'Pending';
  const techPrecision = isDisplayingSample ? '85%' : stats?.competency_averages.technical_vocabulary ? `${stats.competency_averages.technical_vocabulary}%` : 'Pending';
  const verbalArt = isDisplayingSample ? '80%' : stats?.competency_averages.communication ? `${stats.competency_averages.communication}%` : 'Pending';
  const syllabusGrd = isDisplayingSample ? '95%' : stats?.competency_averages.syllabus_grounding ? `${stats.competency_averages.syllabus_grounding}%` : 'Pending';

  return (
    <div className={styles.container}>
      {/* Welcome Banner */}
      <section className={styles.welcomeBanner}>
        <div className={styles.welcomeContent}>
          <div className={styles.badge}>VYRA INTELLIGENCE PLATFORM</div>
          <h1 className={styles.title}>Welcome to Your Interview Workspace</h1>
          <p className={styles.tagline}>
            Your AI. Your Interview. Your Growth.
          </p>
          <p className={styles.description}>
            Engage in realistic voice-driven academic vivas and technical interviews evaluated by Dr. Prabhat Sharma.
          </p>
          <div className={styles.actions}>
            <Link href="/interview" className={styles.primaryCta}>
              <Play size={18} fill="currentColor" />
              <span>Start New Interview</span>
            </Link>
            <Link href="/reports" className={styles.secondaryCta}>
              <BarChart3 size={18} />
              <span>View Performance Analytics</span>
            </Link>
          </div>
        </div>

        <div className={styles.quickStatMini}>
          <div className={styles.miniCard}>
            <span className={styles.miniLabel}>Interviewer Persona</span>
            <span className={styles.miniValue}>Dr. Prabhat Sharma</span>
            <span className={styles.miniSub}>Senior Technical Examiner</span>
          </div>
          <div className={styles.miniCard}>
            <span className={styles.miniLabel}>Voice Engine</span>
            <span className={styles.miniValue}>Natural Indian English</span>
            <span className={styles.miniSub}>EdgeTTS en-IN-Prabhat</span>
          </div>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Completed Sessions</span>
            <div className={styles.metricIconBox}>
              <Award size={18} />
            </div>
          </div>
          <div className={styles.metricValue}>{completedCount}</div>
          <div className={styles.metricFooter}>
            <span className={styles.neutralTrend}>
              {hasRealData ? `${stats.completed_count} verified sessions` : isDisplayingSample ? '+3 this week' : 'No sessions completed'}
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Practice Duration</span>
            <div className={styles.metricIconBox}>
              <Clock size={18} />
            </div>
          </div>
          <div className={styles.metricValue}>{practiceHours}</div>
          <div className={styles.metricFooter}>
            <span className={styles.neutralTrend}>
              {hasRealData ? 'Cumulative practice time' : isDisplayingSample ? 'Average 15m/session' : 'Target: 15m/day'}
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Average Viva Score</span>
            <div className={styles.metricIconBox}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className={styles.metricValue}>{averageScore}</div>
          <div className={styles.metricFooter}>
            <span className={styles.neutralTrend}>
              {hasRealData ? 'Evaluated by Dr. Prabhat' : isDisplayingSample ? '+8% from last month' : 'Awaiting first test'}
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>PDF Grounded Tests</span>
            <div className={styles.metricIconBox}>
              <FileCheck2 size={18} />
            </div>
          </div>
          <div className={styles.metricValue}>{pdfTestsCount}</div>
          <div className={styles.metricFooter}>
            <span className={styles.neutralTrend}>
              {hasRealData ? 'Syllabus grounded tests' : isDisplayingSample ? 'Strict syllabus adherence' : 'Upload syllabus to test'}
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Split: Recent Activity & Progress Overview */}
      <div className={styles.contentSplit}>
        {/* Left: Recent Activity */}
        <section className={styles.activityCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Recent Interview Activity</h2>
              <p className={styles.sectionSubtitle}>Your latest viva sessions and AI evaluations</p>
            </div>
            <div className={styles.toggleGroup}>
              <button 
                type="button" 
                onClick={() => setShowSampleData(!showSampleData)}
                className={styles.toggleSampleBtn}
              >
                {showSampleData ? 'Show Real State' : 'Preview Sample Activity'}
              </button>
            </div>
          </div>

          {recentList.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconBox}>
                <FolderOpen size={36} />
              </div>
              <h3 className={styles.emptyTitle}>No Interviews Recorded Yet</h3>
              <p className={styles.emptyText}>
                You haven&apos;t completed any interview sessions yet. Configure your topic and start your first viva with Dr. Prabhat Sharma.
              </p>
              <Link href="/interview" className={styles.emptyCta}>
                <Play size={16} fill="currentColor" />
                <span>Launch Your First Interview</span>
              </Link>
            </div>
          ) : (
            <div className={styles.activityList}>
              {recentList.map((item) => (
                <div key={item.id} className={styles.activityItem}>
                  <div className={styles.activityIcon}>
                    {item.isPdf ? <FileCheck2 size={18} /> : <BookOpen size={18} />}
                  </div>
                  <div className={styles.activityDetails}>
                    <div className={styles.activityItemTitle}>{item.topic}</div>
                    <div className={styles.activityMeta}>
                      {item.category} &bull; {item.duration} &bull; {item.difficulty}
                    </div>
                  </div>
                  {item.score !== undefined && item.score !== null ? (
                    <div className={styles.activityScoreBadge}>{item.score}% Score</div>
                  ) : (
                    <div className={styles.activityScoreBadge}>In Progress</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className={styles.cardFooter}>
            <Link href="/history" className={styles.linkText}>
              <span>View Full Interview History</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* Right: Growth & Progress Highlights */}
        <section className={styles.progressCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Preparation Focus</h2>
              <p className={styles.sectionSubtitle}>Core competencies evaluated</p>
            </div>
          </div>

          <div className={styles.competencyList}>
            <div className={styles.competencyItem}>
              <div className={styles.competencyHeader}>
                <span className={styles.competencyName}>Conceptual Clarity</span>
                <span className={styles.competencyScore}>{subjClarity}</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: subjClarity !== 'Pending' ? subjClarity : '0%' }} 
                />
              </div>
            </div>

            <div className={styles.competencyItem}>
              <div className={styles.competencyHeader}>
                <span className={styles.competencyName}>Technical Precision & Terminology</span>
                <span className={styles.competencyScore}>{techPrecision}</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: techPrecision !== 'Pending' ? techPrecision : '0%' }} 
                />
              </div>
            </div>

            <div className={styles.competencyItem}>
              <div className={styles.competencyHeader}>
                <span className={styles.competencyName}>Verbal Articulation</span>
                <span className={styles.competencyScore}>{verbalArt}</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: verbalArt !== 'Pending' ? verbalArt : '0%' }} 
                />
              </div>
            </div>

            <div className={styles.competencyItem}>
              <div className={styles.competencyHeader}>
                <span className={styles.competencyName}>Strict Syllabus Grounding</span>
                <span className={styles.competencyScore}>{syllabusGrd}</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: syllabusGrd !== 'Pending' ? syllabusGrd : '0%' }} 
                />
              </div>
            </div>
          </div>

          <div className={styles.proTip}>
            <Sparkles size={16} className={styles.proTipIcon} />
            <p className={styles.proTipText}>
              <strong>Viva Tip:</strong> When Dr. Prabhat asks about a programming concept, begin with a 1-sentence formal definition followed by a concrete real-world use case.
            </p>
          </div>

          <div className={styles.cardFooter}>
            <Link href="/reports" className={styles.linkText}>
              <span>View Comprehensive Report</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};
