'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Filter, 
  FileText, 
  Play, 
  ExternalLink, 
  FolderOpen
} from 'lucide-react';
import { api, ApiInterviewSummaryItem } from '@/lib/api';
import styles from './HistoryView.module.css';

interface HistoryRecord {
  id: string;
  topic: string;
  category: string;
  date: string;
  duration: string;
  score: number | null;
  pdfFile?: string;
  status?: string;
}

const SAMPLE_RECORDS: HistoryRecord[] = [
  {
    id: 'rec-01',
    topic: 'C++ Object Oriented Programming & Virtual Methods',
    category: 'Academic Viva',
    date: 'Oct 24, 2026 • 03:45 PM',
    duration: '15 mins',
    score: 92,
  },
  {
    id: 'rec-02',
    topic: 'Database Management Systems: Normal Forms & Acid Properties',
    category: 'Academic Viva',
    date: 'Oct 22, 2026 • 11:15 AM',
    duration: '30 mins',
    score: 88,
    pdfFile: 'dbms_unit_3_syllabus.pdf',
  },
  {
    id: 'rec-03',
    topic: 'Data Structures: AVL Trees & Graph Traversals (BFS/DFS)',
    category: 'Academic Viva',
    date: 'Oct 19, 2026 • 05:20 PM',
    duration: '15 mins',
    score: 84,
  },
  {
    id: 'rec-04',
    topic: 'Operating Systems: Virtual Memory & Page Replacement Algorithms',
    category: 'Academic Viva',
    date: 'Oct 15, 2026 • 02:00 PM',
    duration: '15 mins',
    score: 79,
  }
];

export const HistoryView: React.FC = () => {
  const [showSample, setShowSample] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [realRecords, setRealRecords] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      try {
        const items = await api.listInterviews(selectedCategory);
        if (!isMounted) return;

        const formatted: HistoryRecord[] = items.map((item) => ({
          id: item.id,
          topic: item.topic,
          category: item.category === 'viva' ? 'Academic Viva' : item.category === 'job' ? 'Job Interview' : 'Custom',
          date: new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          duration: `${item.duration_minutes} mins`,
          score: item.overall_score || null,
          pdfFile: item.document_name || undefined,
          status: item.status,
        }));
        setRealRecords(formatted);
      } catch {
        // Handled silently
      }
    }
    loadHistory();
    return () => { isMounted = false; };
  }, [selectedCategory]);

  const activeRecords = showSample ? SAMPLE_RECORDS : realRecords;

  const filteredRecords = activeRecords.filter((rec) => {
    const matchesSearch = rec.topic.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || rec.category === selectedCategory || (selectedCategory === 'Academic Viva' && rec.category.includes('Viva'));
    return matchesSearch && matchesCategory;
  });

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.badge}>RECORDS & ARCHIVE</div>
          <h1 className={styles.title}>Interview History</h1>
          <p className={styles.subtitle}>
            Review your past viva sessions, question transcripts, and examiner evaluations.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button 
            type="button" 
            onClick={() => setShowSample(!showSample)}
            className={styles.toggleBtn}
          >
            {showSample ? 'Show Real Records' : 'Preview Sample History'}
          </button>
          <Link href="/interview" className={styles.startBtn}>
            <Play size={16} fill="currentColor" />
            <span>New Interview</span>
          </Link>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search interviews by topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <Filter size={16} className={styles.filterIcon} />
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Categories</option>
            <option value="Academic Viva">Academic Viva</option>
            <option value="Job Interview">Job Interview</option>
            <option value="Custom">Custom Topic</option>
          </select>
        </div>
      </div>

      {/* Main Content: Empty State vs Records Table */}
      {filteredRecords.length === 0 ? (
        <div className={styles.emptyContainer}>
          <div className={styles.emptyIconCircle}>
            <FolderOpen size={40} />
          </div>
          <h3 className={styles.emptyTitle}>No Interview History Yet</h3>
          <p className={styles.emptyDescription}>
            You haven&apos;t conducted any interview sessions yet. After completing your first viva with Dr. Prabhat Sharma, your audio transcripts and scoring breakdown will appear here.
          </p>
          <div className={styles.emptyActions}>
            <Link href="/interview" className={styles.emptyPrimaryCta}>
              <Play size={16} fill="currentColor" />
              <span>Start Your First Interview</span>
            </Link>
            <button 
              type="button" 
              onClick={() => setShowSample(true)}
              className={styles.emptySecondaryCta}
            >
              Preview Sample Records
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Topic & Subject</th>
                  <th>Category</th>
                  <th>Date & Time</th>
                  <th>Duration</th>
                  <th>Viva Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((item) => (
                  <tr key={item.id} className={styles.tableRow}>
                    <td>
                      <div className={styles.topicCell}>
                        <span className={styles.topicName}>{item.topic}</span>
                        {item.pdfFile && (
                          <span className={styles.pdfBadge}>
                            <FileText size={12} />
                            <span>{item.pdfFile}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={styles.categoryPill}>{item.category}</span>
                    </td>
                    <td>
                      <span className={styles.dateCell}>{item.date}</span>
                    </td>
                    <td>
                      <span className={styles.durationCell}>{item.duration}</span>
                    </td>
                    <td>
                      {item.score !== null ? (
                        <span className={`${styles.scorePill} ${item.score >= 85 ? styles.scoreHigh : styles.scoreMid}`}>
                          {item.score}%
                        </span>
                      ) : item.status === 'cancelled' ? (
                        <span className={styles.scorePillCancelled}>
                          Interrupted
                        </span>
                      ) : (
                        <span className={styles.scorePill}>In Progress</span>
                      )}
                    </td>
                    <td>
                      <Link 
                        href={`/reports?session_id=${item.id}`}
                        className={styles.viewReportBtn}
                      >
                        <span>{item.score !== null ? 'Report' : 'Details'}</span>
                        <ExternalLink size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
