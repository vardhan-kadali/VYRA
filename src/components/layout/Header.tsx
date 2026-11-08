'use client';

import React from 'react';
import Link from 'next/link';
import { User, Bell } from 'lucide-react';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logoBadge}>V</span>
          <span className={styles.logoText}>VYRA</span>
        </Link>
        <div className={styles.divider} />
        <span className={styles.tagline}>Your AI. Your Interview. Your Growth.</span>
      </div>

      <div className={styles.right}>
        <div className={styles.sessionStatus}>
          <span className={styles.statusDot} />
          <span className={styles.statusText}>AI Interviewer Ready</span>
        </div>

        <button className={styles.iconButton} title="Notifications" aria-label="Notifications">
          <Bell size={18} />
        </button>

        <Link href="/account" className={styles.userProfile} title="My Account" aria-label="My Account">
          <div className={styles.avatarCircle}>
            <User size={18} />
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>Candidate</span>
            <span className={styles.userRole}>Software Engineer</span>
          </div>
        </Link>
      </div>
    </header>
  );
};
