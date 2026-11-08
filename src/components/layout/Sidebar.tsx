'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Video, 
  History, 
  BarChart3, 
  UserCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      active: pathname === '/dashboard' || pathname === '/',
    },
    {
      label: 'Start Interview',
      href: '/interview',
      icon: Video,
      active: pathname.startsWith('/interview'),
    },
    {
      label: 'Interview History',
      href: '/history',
      icon: History,
      active: pathname.startsWith('/history'),
    },
    {
      label: 'Progress & Reports',
      href: '/reports',
      icon: BarChart3,
      active: pathname.startsWith('/reports'),
    },
    {
      label: 'My Account',
      href: '/account',
      icon: UserCircle,
      active: pathname.startsWith('/account'),
    },
  ];

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.navGroup}>
        <div className={styles.sectionTitle}>
          {!collapsed && <span>NAVIGATION</span>}
        </div>

        <nav className={styles.navList}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${item.active ? styles.active : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <div className={styles.iconWrapper}>
                  <Icon size={20} />
                </div>
                {!collapsed && <span className={styles.label}>{item.label}</span>}
                {item.active && <span className={styles.activeIndicator} />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.footer}>
        <button
          onClick={onToggle}
          className={styles.collapseToggle}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : (
            <>
              <ChevronLeft size={18} />
              <span className={styles.collapseText}>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
