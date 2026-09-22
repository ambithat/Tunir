import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FiArrowRightCircle,
  FiBarChart2,
  FiCheckCircle,
  FiInfo,
  FiSend,
  FiTarget,
  FiTrendingUp,
  FiFilter,
  FiUsers,
  FiXCircle,
  FiChevronDown,
  FiPackage
} from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import { subscribeToSseEvent, refreshDashboardKpis, getLatestSalesKpis } from '../../api/notificationSse';
import { getLeadProductStatusDropdown } from '../../api/statusTypeApi';
import DashboardDrillDownDrawer from './DashboardDrillDownDrawer';
import SalesFunnelChart from './SalesFunnelChart';
import { useAuth } from '../../context/AuthContext';
import { isExecutive } from '../../utils/authRoles';

const LEADER_PALETTES = [
  {
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.8))',
    border: 'rgba(16, 185, 129, 0.55)',
    accent: '#10B981',
    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
    hoverShadow: '0 8px 24px rgba(16, 185, 129, 0.45)'
  },
  {
    bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.9), rgba(126, 34, 206, 0.8))',
    border: 'rgba(168, 85, 247, 0.55)',
    accent: '#A855F7',
    boxShadow: '0 4px 16px rgba(168, 85, 247, 0.25)',
    hoverShadow: '0 8px 24px rgba(168, 85, 247, 0.45)'
  },
  {
    bg: 'linear-gradient(135deg, rgba(249, 115, 22, 0.9), rgba(194, 65, 12, 0.8))',
    border: 'rgba(249, 115, 22, 0.55)',
    accent: '#F97316',
    boxShadow: '0 4px 16px rgba(249, 115, 22, 0.25)',
    hoverShadow: '0 8px 24px rgba(249, 115, 22, 0.45)'
  },
  {
    bg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.9), rgba(3, 105, 161, 0.8))',
    border: 'rgba(14, 165, 233, 0.55)',
    accent: '#0EA5E9',
    boxShadow: '0 4px 16px rgba(14, 165, 233, 0.25)',
    hoverShadow: '0 8px 24px rgba(14, 165, 233, 0.45)'
  },
  {
    bg: 'linear-gradient(135deg, rgba(14, 116, 144, 0.9), rgba(21, 94, 117, 0.8))',
    border: 'rgba(14, 116, 144, 0.55)',
    accent: '#06B6D4',
    boxShadow: '0 4px 16px rgba(14, 116, 144, 0.25)',
    hoverShadow: '0 8px 24px rgba(14, 116, 144, 0.45)'
  },
  {
    bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(109, 40, 217, 0.8))',
    border: 'rgba(139, 92, 246, 0.55)',
    accent: '#8B5CF6',
    boxShadow: '0 4px 16px rgba(139, 92, 246, 0.25)',
    hoverShadow: '0 8px 24px rgba(139, 92, 246, 0.45)'
  },
  {
    bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(67, 56, 202, 0.8))',
    border: 'rgba(99, 102, 241, 0.55)',
    accent: '#6366F1',
    boxShadow: '0 4px 16px rgba(99, 102, 241, 0.25)',
    hoverShadow: '0 8px 24px rgba(99, 102, 241, 0.45)'
  },
  {
    bg: 'linear-gradient(135deg, rgba(234, 179, 8, 0.9), rgba(161, 98, 7, 0.8))',
    border: 'rgba(234, 179, 8, 0.55)',
    accent: '#EAB308',
    boxShadow: '0 4px 16px rgba(234, 179, 8, 0.25)',
    hoverShadow: '0 8px 24px rgba(234, 179, 8, 0.45)'
  }
];

/**
 * Dynamic Proportional Treemap Layout Engine
 * Computes exact non-overlapping proportional rectangles ({ x, y, w, h } in %)
 * for any number of owners (1 to 20+) guaranteed to display all manager names, revenues,
 * and active lead counts without clipping, overflow, or missing tiles.
 */
function computeDynamicTreemapLayout(items) {
  if (!items || items.length === 0) return [];
  const n = items.length;
  if (n === 1) {
    return [{ ...items[0], rect: { x: 0, y: 0, w: 100, h: 100 } }];
  }

  const totalWeight = items.reduce((sum, it) => sum + Math.max(Number(it.weight) || 0.1, 0.1), 0);

  if (n === 2) {
    const w0 = Math.max(25, Math.min(75, ((items[0].weight || 1) / totalWeight) * 100));
    const w1 = 100 - w0;
    return [
      { ...items[0], rect: { x: 0, y: 0, w: w0, h: 100 } },
      { ...items[1], rect: { x: w0, y: 0, w: w1, h: 100 } }
    ];
  }

  if (n === 3) {
    const w0 = Math.max(35, Math.min(55, ((items[0].weight || 1) / totalWeight) * 100));
    const wRight = 100 - w0;
    const rightWeight = (items[1].weight || 1) + (items[2].weight || 1);
    const h1 = Math.max(30, Math.min(70, ((items[1].weight || 1) / rightWeight) * 100));
    const h2 = 100 - h1;
    return [
      { ...items[0], rect: { x: 0, y: 0, w: w0, h: 100 } },
      { ...items[1], rect: { x: w0, y: 0, w: wRight, h: h1 } },
      { ...items[2], rect: { x: w0, y: h1, w: wRight, h: h2 } }
    ];
  }

  if (n === 4) {
    const leftWeight = (items[0].weight || 1) + (items[1].weight || 1);
    const rightWeight = (items[2].weight || 1) + (items[3].weight || 1);
    const wLeft = Math.max(35, Math.min(65, (leftWeight / totalWeight) * 100));
    const wRight = 100 - wLeft;

    const h0 = Math.max(28, Math.min(72, ((items[0].weight || 1) / leftWeight) * 100));
    const h1 = 100 - h0;

    const h2 = Math.max(28, Math.min(72, ((items[2].weight || 1) / rightWeight) * 100));
    const h3 = 100 - h2;

    return [
      { ...items[0], rect: { x: 0, y: 0, w: wLeft, h: h0 } },
      { ...items[1], rect: { x: 0, y: h0, w: wLeft, h: h1 } },
      { ...items[2], rect: { x: wLeft, y: 0, w: wRight, h: h2 } },
      { ...items[3], rect: { x: wLeft, y: h2, w: wRight, h: h3 } }
    ];
  }

  if (n === 5) {
    const w0 = Math.max(32, Math.min(48, ((items[0].weight || 1) / totalWeight) * 100));
    const wRight = 100 - w0;

    const topWeight = (items[1].weight || 1) + (items[2].weight || 1);
    const btmWeight = (items[3].weight || 1) + (items[4].weight || 1);
    const hTop = Math.max(38, Math.min(62, (topWeight / (topWeight + btmWeight)) * 100));
    const hBtm = 100 - hTop;

    const w1 = ((items[1].weight || 1) / topWeight) * wRight;
    const w2 = wRight - w1;

    const w3 = ((items[3].weight || 1) / btmWeight) * wRight;
    const w4 = wRight - w3;

    return [
      { ...items[0], rect: { x: 0, y: 0, w: w0, h: 100 } },
      { ...items[1], rect: { x: w0, y: 0, w: w1, h: hTop } },
      { ...items[2], rect: { x: w0 + w1, y: 0, w: w2, h: hTop } },
      { ...items[3], rect: { x: w0, y: hTop, w: w3, h: hBtm } },
      { ...items[4], rect: { x: w0 + w3, y: hTop, w: w4, h: hBtm } }
    ];
  }

  if (n === 6) {
    const w0 = Math.max(34, Math.min(46, ((items[0].weight || 1) / totalWeight) * 100));
    const wRight = 100 - w0;

    const topWeight = (items[1].weight || 1) + (items[2].weight || 1);
    const btmWeight = (items[3].weight || 1) + (items[4].weight || 1) + (items[5].weight || 1);
    const hTop = Math.max(46, Math.min(60, (topWeight / (topWeight + btmWeight)) * 100));
    const hBtm = 100 - hTop;

    const w1 = Math.max(wRight * 0.35, Math.min(wRight * 0.7, ((items[1].weight || 1) / topWeight) * wRight));
    const w2 = wRight - w1;

    const w3 = ((items[3].weight || 1) / btmWeight) * wRight;
    const w4 = ((items[4].weight || 1) / btmWeight) * wRight;
    const w5 = wRight - (w3 + w4);

    return [
      { ...items[0], rect: { x: 0, y: 0, w: w0, h: 100 } },
      { ...items[1], rect: { x: w0, y: 0, w: w1, h: hTop } },
      { ...items[2], rect: { x: w0 + w1, y: 0, w: w2, h: hTop } },
      { ...items[3], rect: { x: w0, y: hTop, w: w3, h: hBtm } },
      { ...items[4], rect: { x: w0 + w3, y: hTop, w: w4, h: hBtm } },
      { ...items[5], rect: { x: w0 + w3 + w4, y: hTop, w: w5, h: hBtm } }
    ];
  }

  // Generalized for N >= 7: Hero left column + 2-row right multi-column grid
  const heroCount = items[0].weight >= (totalWeight * 0.3) ? 1 : 2;
  const heroItems = items.slice(0, heroCount);
  const remainingItems = items.slice(heroCount);

  const heroWeight = heroItems.reduce((s, it) => s + (it.weight || 1), 0);
  const remWeight = remainingItems.reduce((s, it) => s + (it.weight || 1), 0);

  const wHero = Math.max(30, Math.min(46, (heroWeight / totalWeight) * 100));
  const wRight = 100 - wHero;

  const result = [];

  // Place Hero items in left column
  if (heroCount === 1) {
    result.push({ ...heroItems[0], rect: { x: 0, y: 0, w: wHero, h: 100 } });
  } else {
    const h0 = ((heroItems[0].weight || 1) / heroWeight) * 100;
    result.push({ ...heroItems[0], rect: { x: 0, y: 0, w: wHero, h: h0 } });
    result.push({ ...heroItems[1], rect: { x: 0, y: h0, w: wHero, h: 100 - h0 } });
  }

  // Split remaining into top row (larger) and bottom row (smaller)
  const halfRem = Math.ceil(remainingItems.length / 2);
  const topGroup = remainingItems.slice(0, halfRem);
  const btmGroup = remainingItems.slice(halfRem);

  const topWeight = topGroup.reduce((s, it) => s + (it.weight || 1), 0);
  const btmWeight = btmGroup.reduce((s, it) => s + (it.weight || 1), 0);
  const hTop = Math.max(40, Math.min(60, (topWeight / (topWeight + btmWeight)) * 100));
  const hBtm = 100 - hTop;

  let xOffsetTop = 0;
  topGroup.forEach((it, i) => {
    const itemWidth = i === topGroup.length - 1
      ? (wRight - xOffsetTop)
      : ((it.weight || 1) / topWeight) * wRight;
    result.push({
      ...it,
      rect: {
        x: wHero + xOffsetTop,
        y: 0,
        w: itemWidth,
        h: hTop
      }
    });
    xOffsetTop += itemWidth;
  });

  let xOffsetBtm = 0;
  btmGroup.forEach((it, i) => {
    const itemWidth = i === btmGroup.length - 1
      ? (wRight - xOffsetBtm)
      : ((it.weight || 1) / btmWeight) * wRight;
    result.push({
      ...it,
      rect: {
        x: wHero + xOffsetBtm,
        y: hTop,
        w: itemWidth,
        h: hBtm
      }
    });
    xOffsetBtm += itemWidth;
  });

  return result;
}

// Full Page Dashboard Skeleton Loader
function DashboardSkeleton() {
  const glassCard = {
    background: 'var(--t-surface)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid var(--t-border)',
    borderRadius: '14px',
    boxShadow: 'var(--t-card-shadow)',
    transition: 'all 220ms ease'
  };

  return (
    <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '20px 20px 10px', position: 'relative', zIndex: 1 }}>

      {/* 1. TOP KPI ROW SKELETON */}
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', marginBottom: '28px' }}>
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="kpi-card"
            style={{
              position: 'relative',
              background: 'var(--t-surface)',
              border: '1px solid var(--t-border)',
              borderRadius: '14px',
              overflow: 'hidden',
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '110px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div className="skeleton-box" style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="skeleton-box" style={{ width: '65%', height: '11px', marginBottom: '8px' }} />
                <div className="skeleton-box" style={{ width: '85%', height: '22px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <div className="skeleton-box" style={{ width: '45%', height: '12px' }} />
              <div className="skeleton-box" style={{ width: '35%', height: '12px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* 2. ROW 1: PIPELINE STAGE LEVELS (LEFT) + LEAD STATUS & SALES FUNNEL (RIGHT) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '28px' }}>

        {/* Pipeline Stage Levels Card Skeleton */}
        <div style={{ ...glassCard, padding: '20px 22px', display: 'flex', flexDirection: 'column', minHeight: '620px' }}>
          {/* Card Header Skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div className="skeleton-box" style={{ width: '220px', height: '26px', marginBottom: '6px' }} />
              <div className="skeleton-box" style={{ width: '280px', height: '14px' }} />
            </div>
            <div className="skeleton-box" style={{ width: '110px', height: '34px', borderRadius: '999px' }} />
          </div>

          {/* Legend Skeleton */}
          <div style={{ display: 'flex', gap: '18px', marginBottom: '22px', marginTop: '14px' }}>
            {[80, 70, 110].map((w, idx) => (
              <div key={idx} className="skeleton-box" style={{ width: `${w}px`, height: '16px', borderRadius: '4px' }} />
            ))}
          </div>

          {/* Chart Area Skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr', flex: 1, minHeight: '340px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: '10px', paddingBottom: '4px' }}>
              {['2.5K', '2K', '1.5K', '1K', '500', '0'].map(l => (
                <span key={l} style={{ fontSize: '12px', color: 'var(--t-fg-muted)', fontWeight: 700 }}>{l}</span>
              ))}
            </div>
            <div style={{ position: 'relative', borderLeft: '1px solid var(--t-border)', borderBottom: '1px solid var(--t-border)' }}>
              {[20, 40, 60, 80, 100].map(pct => (
                <div key={pct} style={{ position: 'absolute', left: 0, right: 0, bottom: `${pct}%`, height: '1px', background: 'var(--t-border)' }} />
              ))}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 16px 0 12px', gap: '14px' }}>
                {[65, 80, 50, 72].map((h, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                    <div className="skeleton-box" style={{ width: '28px', height: '14px', borderRadius: '4px' }} />
                    <div className="skeleton-box" style={{ width: '100%', maxWidth: '48px', height: `${h}%`, borderRadius: '6px 6px 0 0' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* X-axis labels skeleton */}
          <div style={{ display: 'flex', justifyContent: 'space-around', paddingLeft: '48px', paddingRight: '12px', marginTop: '12px', gap: '14px' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton-box" style={{ flex: 1, height: '14px', maxWidth: '65px', borderRadius: '4px' }} />
            ))}
          </div>

          {/* Bottom stats summary skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', borderTop: '1px solid var(--t-border)', paddingTop: '18px', marginTop: '20px' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ background: 'var(--t-surface-alt)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--t-border)' }}>
                <div className="skeleton-box" style={{ width: '70%', height: '12px', marginBottom: '8px' }} />
                <div className="skeleton-box" style={{ width: '45%', height: '24px', marginBottom: '6px' }} />
                <div className="skeleton-box" style={{ width: '40%', height: '12px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Right Stacked Column (Lead Status + Funnel) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>

          {/* Lead Status Distribution Skeleton */}
          <div style={{ ...glassCard, padding: '22px 24px', display: 'flex', flexDirection: 'column', minHeight: '300px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div className="skeleton-box" style={{ width: '200px', height: '24px', marginBottom: '6px' }} />
                <div className="skeleton-box" style={{ width: '240px', height: '13px' }} />
              </div>
              <div className="skeleton-box" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
            </div>
            <div style={{ padding: '12px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', height: '190px', alignItems: 'flex-end', borderBottom: '1px solid var(--t-border)', paddingBottom: '2px' }}>
                {[45, 60, 30, 75, 40].map((h, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '6px' }}>
                    <div className="skeleton-box" style={{ width: '20px', height: '12px' }} />
                    <div className="skeleton-box" style={{ width: '100%', maxWidth: '38px', height: `${h}%`, borderRadius: '6px 6px 0 0' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginTop: '10px' }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton-box" style={{ height: '12px', borderRadius: '3px' }} />
                ))}
              </div>
            </div>
          </div>

          {/* Sales Funnel Conversion Skeleton */}
          <div style={{ ...glassCard, padding: '22px 24px', display: 'flex', flexDirection: 'column', minHeight: '320px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div className="skeleton-box" style={{ width: '210px', height: '24px', marginBottom: '6px' }} />
                <div className="skeleton-box" style={{ width: '250px', height: '13px' }} />
              </div>
              <div className="skeleton-box" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '10px', flex: 1, justifyContent: 'space-between' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="skeleton-box" style={{ width: '75px', height: '14px' }} />
                  <div className="skeleton-box" style={{ flex: 1, height: '22px', borderRadius: '4px' }} />
                  <div className="skeleton-box" style={{ width: '24px', height: '14px' }} />
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* 3. ROW 2: LEADS BY OWNER & DEAL STATUS SKELETON */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '28px' }}>

        {/* Leads By Owner Performance Skeleton */}
        <div style={{ ...glassCard, padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div className="skeleton-box" style={{ width: '260px', height: '26px', marginBottom: '6px' }} />
              <div className="skeleton-box" style={{ width: '240px', height: '14px' }} />
            </div>
            <div className="skeleton-box" style={{ width: '110px', height: '24px', borderRadius: '6px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', height: '248px' }}>
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--t-surface-alt)',
                  borderRadius: '16px',
                  padding: '24px',
                  border: '1px solid var(--t-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div className="skeleton-box" style={{ width: '80px', height: '12px', marginBottom: '8px' }} />
                  <div className="skeleton-box" style={{ width: '55%', height: '24px', marginBottom: '6px' }} />
                  <div className="skeleton-box" style={{ width: '40%', height: '12px' }} />
                </div>
                <div>
                  <div className="skeleton-box" style={{ width: '50%', height: '28px', marginBottom: '6px' }} />
                  <div className="skeleton-box" style={{ width: '65%', height: '14px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deal Status & Value Split Skeleton */}
        <div style={{ ...glassCard, padding: '24px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div className="skeleton-box" style={{ width: '200px', height: '24px', marginBottom: '6px' }} />
              <div className="skeleton-box" style={{ width: '220px', height: '13px' }} />
            </div>
            <div className="skeleton-box" style={{ width: '90px', height: '18px', borderRadius: '4px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px 0' }}>
            <div className="skeleton-box" style={{ width: '160px', height: '105px', borderRadius: '50%' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', paddingTop: '14px', borderTop: '1px solid var(--t-border)' }}>
            <div className="skeleton-box" style={{ width: '130px', height: '14px', borderRadius: '4px' }} />
            <div className="skeleton-box" style={{ width: '90px', height: '14px', borderRadius: '4px' }} />
          </div>
        </div>

      </div>

    </div>
  );
}

const formatCurrencyCompact = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  const num = Number(val) || 0;
  if (num >= 10000000) {
    const crVal = num / 10000000;
    return `₹${crVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
  }
  if (num >= 100000) {
    const lakhVal = num / 100000;
    return `₹${lakhVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
  }
  return `₹${Math.round(num).toLocaleString('en-IN')}`;
};

function render3DPieChart(winRatioPct, totalClosedValue = 1) {
  if (totalClosedValue === 0) {
    return (
      <svg width="210" height="140" viewBox="0 0 210 140" fill="none">
        <ellipse cx="105" cy="84" rx="80" ry="32" fill="#030712" opacity="0.6" />
        <ellipse cx="105" cy="66" rx="85" ry="36" fill="none" stroke="rgba(148, 163, 184, 0.35)" strokeWidth="2" strokeDasharray="6 6" />
        <ellipse cx="105" cy="66" rx="45" ry="20" fill="none" stroke="rgba(148, 163, 184, 0.2)" strokeWidth="1.5" strokeDasharray="4 4" />
        <text x="105" y="70" textAnchor="middle" fill="#64748B" fontSize="12" fontFamily="'Inter', sans-serif" fontWeight="600">
          No Closed Deals
        </text>
      </svg>
    );
  }

  const wonFrac = Math.max(0, Math.min(1, (winRatioPct || 0) / 100));
  const cx = 105;
  const cy = 66;
  const rx = 92;
  const ry = 40;
  const depth = 18;

  if (wonFrac >= 0.999) {
    // 100% Won (All Emerald Green)
    return (
      <svg width="210" height="140" viewBox="0 0 210 140" fill="none">
        <ellipse cx={cx} cy={cy + depth} rx={rx} ry={ry} fill="#02151F" opacity="0.85" />
        <path
          d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy} L ${cx + rx} ${cy + depth} A ${rx} ${ry} 0 0 1 ${cx - rx} ${cy + depth} Z`}
          fill="url(#pieWonSideGradient)"
        />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#pieWonGradient)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1={cx} y1={cy - ry} x2={cx} y2={cy} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <defs>
          <linearGradient id="pieWonGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D4AA" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="pieWonSideGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#022B22" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (wonFrac <= 0.001) {
    // 100% Lost (All Slate Grey)
    return (
      <svg width="210" height="140" viewBox="0 0 210 140" fill="none">
        <ellipse cx={cx} cy={cy + depth} rx={rx} ry={ry} fill="#111827" opacity="0.85" />
        <path
          d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy} L ${cx + rx} ${cy + depth} A ${rx} ${ry} 0 0 1 ${cx - rx} ${cy + depth} Z`}
          fill="url(#pieLostSideGradient)"
        />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#pieLostGradient)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1={cx} y1={cy - ry} x2={cx} y2={cy} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <defs>
          <linearGradient id="pieLostGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="pieLostSideGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  // Dynamic Split (e.g. 50% Won / 50% Lost)
  const startAngle = -Math.PI / 2; // 12 o'clock
  const splitAngle = startAngle + wonFrac * 2 * Math.PI;

  const x0 = cx + rx * Math.cos(startAngle);
  const y0 = cy + ry * Math.sin(startAngle);

  const x1 = cx + rx * Math.cos(splitAngle);
  const y1 = cy + ry * Math.sin(splitAngle);

  const wonLarge = wonFrac > 0.5 ? 1 : 0;
  const lostLarge = (1 - wonFrac) > 0.5 ? 1 : 0;

  const wonTopPath = `M ${cx} ${cy} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${rx} ${ry} 0 ${wonLarge} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
  const lostTopPath = `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rx} ${ry} 0 ${lostLarge} 1 ${x0.toFixed(1)} ${y0.toFixed(1)} Z`;

  return (
    <svg width="210" height="140" viewBox="0 0 210 140" fill="none">
      <defs>
        <linearGradient id="pieWonGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00D4AA" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="pieWonSideGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#047857" />
          <stop offset="100%" stopColor="#022B22" />
        </linearGradient>

        <linearGradient id="pieLostGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="pieLostSideGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>

      {/* 3D Base Shadow */}
      <ellipse cx={cx} cy={cy + depth} rx={rx} ry={ry} fill="#02151F" opacity="0.85" />

      {/* 3D Side Walls for Won and Lost */}
      <path
        d={`M ${cx + rx} ${cy} L ${cx + rx} ${cy + depth} A ${rx} ${ry} 0 0 1 ${x1.toFixed(1)} ${(y1 + depth).toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy} Z`}
        fill="url(#pieWonSideGradient)"
      />
      <path
        d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x1.toFixed(1)} ${(y1 + depth).toFixed(1)} A ${rx} ${ry} 0 0 1 ${cx - rx} ${cy + depth} L ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`}
        fill="url(#pieLostSideGradient)"
      />

      {/* Top Won Slice */}
      <path d={wonTopPath} fill="url(#pieWonGradient)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />

      {/* Top Lost Slice */}
      <path d={lostTopPath} fill="url(#pieLostGradient)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />

      {/* Divider lines from center */}
      <line x1={cx} y1={cy} x2={x0.toFixed(1)} y2={y0.toFixed(1)} stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
      <line x1={cx} y1={cy} x2={x1.toFixed(1)} y2={y1.toFixed(1)} stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
    </svg>
  );
}

const STAGE_COLOR_MAP = {
  'won': '#00D4AA',
  'negotiation': '#E69819',
  'high': '#949cecff',
  'medium': '#B45309',
  'low': '#38BDF8',
  'qualification': '#818CF8',
  'qualified': '#818CF8',
  'proposal': '#818CF8',
  'proposal sent': '#818CF8',
  'lost': '#64748B',
  'new': '#38BDF8',
  'contacted': '#0EA5E9',
  'unqualified': '#94A3B8'
};

const PALETTE_FALLBACKS = [
  '#00D4AA', '#00C6FF', '#FFAA00', '#818CF8', '#38BDF8', '#10B981', '#64748B'
];

const getStageColor = (stageName, index = 0) => {
  if (!stageName) return PALETTE_FALLBACKS[index % PALETTE_FALLBACKS.length];
  const key = String(stageName).trim().toLowerCase();
  if (STAGE_COLOR_MAP[key]) return STAGE_COLOR_MAP[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIdx = Math.abs(hash) % PALETTE_FALLBACKS.length;
  return PALETTE_FALLBACKS[colorIdx];
};

export default function DashboardView({
  leads,
  wonLeads,
  activities,
  onNavigateToLeads,
  onNavigateToActivity,
  onOpenLeadDetails
}) {
  // User & Role Context for Leader KPI filtering
  const { user: currentUser } = useAuth();
  const isExecUser = isExecutive(currentUser);

  // Real-time SSE State (initialized immediately from persistent cache if available)
  const [sseData, setSseData] = useState(() => getLatestSalesKpis());
  const [statusMasterList, setStatusMasterList] = useState([]);

  // Fetch status dropdown master on mount to map status names to IDs
  useEffect(() => {
    getLeadProductStatusDropdown(false).then(res => {
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setStatusMasterList(list);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    const handleIncoming = (data) => {
      console.log('[DashboardView] 📊 Live SSE event received:', data);
      if (!data || typeof data !== 'object') return;

      const payload = data.data !== undefined ? data.data : data;

      setSseData(prev => {
        if (!prev) return payload;

        return {
          ...prev,
          ...payload,
          summary: {
            ...(prev.summary || (prev.total_leads !== undefined ? prev : {})),
            ...(payload.summary || (payload.total_leads !== undefined ? payload : {}))
          },
          by_status: (payload.by_status && Object.keys(payload.by_status).length > 0) ? payload.by_status : prev.by_status,
          by_stage: (payload.by_stage && Object.keys(payload.by_stage).length > 0) ? payload.by_stage : prev.by_stage,
          by_leader: (Array.isArray(payload.by_leader) && payload.by_leader.length > 0) ? payload.by_leader : prev.by_leader,
          by_product: (payload.by_product && Object.keys(payload.by_product).length > 0) ? payload.by_product : prev.by_product,
          by_stage_by_product: (payload.by_stage_by_product && Object.keys(payload.by_stage_by_product).length > 0)
            ? payload.by_stage_by_product
            : prev.by_stage_by_product,
          by_status_by_product: (payload.by_status_by_product && Object.keys(payload.by_status_by_product).length > 0)
            ? payload.by_status_by_product
            : prev.by_status_by_product,
          won_count_by_product: payload.won_count_by_product || prev.won_count_by_product,
          lost_count_by_product: payload.lost_count_by_product || prev.lost_count_by_product,
          won_revenue_by_product: payload.won_revenue_by_product || prev.won_revenue_by_product,
          stage_distribution_by_pipeline: (Array.isArray(payload.stage_distribution_by_pipeline) && payload.stage_distribution_by_pipeline.length > 0)
            ? payload.stage_distribution_by_pipeline
            : prev.stage_distribution_by_pipeline,
          total_won_count: payload.total_won_count !== undefined ? payload.total_won_count : prev.total_won_count,
          total_lost_count: payload.total_lost_count !== undefined ? payload.total_lost_count : prev.total_lost_count
        };
      });
    };

    // 1. Subscribe to named sales_dashboard_kpis SSE event
    const unsubSalesKpis = subscribeToSseEvent('sales_dashboard_kpis', handleIncoming);

    // 2. Subscribe to dashboard_metrics SSE event
    const unsubDashboardMetrics = subscribeToSseEvent('dashboard_metrics', handleIncoming);

    // 3. Subscribe to notifications and lead SSE event stream
    const unsubNotif = subscribeToSseEvent('sales_notification', (data) => handleIncoming(data));
    const unsubNotifications = subscribeToSseEvent('notifications', (data) => handleIncoming(data));

    // 4. Subscribe to generic stream messages for all real-time events
    const unsubGeneric = subscribeToSseEvent('*', ({ type, payload }) => {
      console.log('[DashboardView] ⚡ Stream wildcard event:', type, payload);
      if (payload) {
        handleIncoming(payload);
      }
    });

    // 5. Initial KPI sync once on mount
    refreshDashboardKpis();

    return () => {
      unsubSalesKpis();
      unsubDashboardMetrics();
      unsubNotif();
      unsubNotifications();
      unsubGeneric();
    };
  }, []);

  // Tooltip state for chart hover interactions
  const [tooltip, setTooltip] = useState(null);
  const [selectedDrillDownKpi, setSelectedDrillDownKpi] = useState(null);

  // Product Filter states for the 3 fields: Lead Status, Sales Funnel, Deal Status
  const [statusProductFilter, setStatusProductFilter] = useState('all');
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const statusFilterRef = useRef(null);

  const [funnelProductFilter, setFunnelProductFilter] = useState('all');
  const [funnelFilterOpen, setFunnelFilterOpen] = useState(false);
  const funnelFilterRef = useRef(null);

  const [dealProductFilter, setDealProductFilter] = useState('all');
  const [dealFilterOpen, setDealFilterOpen] = useState(false);
  const dealFilterRef = useRef(null);

  useEffect(() => {
    const handleFilterOutsideClick = (e) => {
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target)) {
        setStatusFilterOpen(false);
      }
      if (funnelFilterRef.current && !funnelFilterRef.current.contains(e.target)) {
        setFunnelFilterOpen(false);
      }
      if (dealFilterRef.current && !dealFilterRef.current.contains(e.target)) {
        setDealFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleFilterOutsideClick);
    return () => document.removeEventListener('mousedown', handleFilterOutsideClick);
  }, []);

  const handleMouseMove = (e, title, subtitle, items) => {
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      title,
      subtitle,
      items
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  // Derive metrics: prioritize live SSE broadcast, fallback to mock leads/wonLeads
  const summary = sseData?.summary || sseData;
  const byStatus = sseData?.by_status;
  const byStage = sseData?.by_stage;

  const formatFullCurrency = (amount) => `₹ ${Math.round(amount || 0).toLocaleString('en-IN')}`;
  const isLoading = !sseData;

  // Leaders list derived from live SSE payload
  const rawLeaders = useMemo(() => {
    return (Array.isArray(sseData?.by_leader) && sseData.by_leader.length > 0)
      ? sseData.by_leader
      : (Array.isArray(sseData?.by_leaders) && sseData.by_leaders.length > 0)
        ? sseData.by_leaders
        : [];
  }, [sseData]);

  // Match active leader record based on logged in user (or company aggregate for executives)
  const activeLeaderRecord = useMemo(() => {
    if (!rawLeaders || rawLeaders.length === 0) return null;
    if (isExecUser) return null; // Executive users see overall company totals

    const uId = (currentUser?.leader_id || currentUser?.emp_id || currentUser?.id || '').toString();
    const uEmail = (currentUser?.email || '').toLowerCase().trim();
    const uName = (currentUser?.name || `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`).toLowerCase().trim();

    return rawLeaders.find(l => {
      const lId = (l.lead_owner_id || l.leader_id || l.id || '').toString();
      const lEmail = (l.lead_owner_email || l.email || '').toLowerCase().trim();
      const lName = (l.lead_owner_name || l.name || l.leader_name || '').toLowerCase().trim();

      return (uId && lId === uId) ||
        (uEmail && lEmail === uEmail) ||
        (uName && lName && (lName.includes(uName) || uName.includes(lName)));
    }) || rawLeaders[0] || null;
  }, [rawLeaders, isExecUser, currentUser]);

  // Dynamically computed metrics for KPI top row (common company data for main dashboard)
  const openLeadsCount = summary?.total_leads !== undefined ? summary.total_leads : leads.length;

  const qualifiedCount = summary?.total_qualified !== undefined ? summary.total_qualified : (byStatus?.Qualified !== undefined ? byStatus.Qualified : leads.filter(l => l.stageKey === 'qualified').length);

  const qualifiedPct = summary?.qualified_percentage ?? 0;

  const qualifiedProjVal = summary?.qualified_project_value ?? 0;

  const negotiationsCount = summary?.total_leads_in_negotiations !== undefined ? summary.total_leads_in_negotiations : (byStage?.Negotiation !== undefined ? byStage.Negotiation : leads.filter(l => l.confidence === 'Negotiation' || l.stageKey === 'negotiation').length);

  const negotiationsPct = summary?.negotiations_percentage ?? 0;

  const negotiationsProjVal = summary?.negotiation_project_value ?? 0;

  const proposalCount = summary?.total_proposals_sent !== undefined ? summary.total_proposals_sent : (byStatus?.['Proposal Sent'] !== undefined ? byStatus['Proposal Sent'] : leads.filter(l => l.stageKey === 'proposal').length);

  const proposalPct = summary?.proposals_sent_percentage ?? 0;

  const proposalProjVal = summary?.proposal_sent_project_value ?? 0;

  const weightedPipelineValue = summary?.total_pipeline_amount !== undefined ? summary.total_pipeline_amount : leads.reduce((sum, lead) => sum + ((lead.value || 0) * (lead.probVal || 0)), 0);

  const pipelinePct = summary?.pipeline_amount_percentage ?? 0;

  const lostProjectsCount = summary?.lost_projects !== undefined ? summary.lost_projects : (sseData?.total_lost_count !== undefined ? sseData.total_lost_count : (byStage?.Lost !== undefined ? byStage.Lost : leads.filter(l => l.stageKey === 'lost').length));

  const lostPct = summary?.lost_percentage ?? 0;

  const lostProjectVal = summary?.lost_project_value ?? 0;

  const totalProjectVal = summary?.total_project_value ?? 0;

  const wonRevenueValue = summary?.total_won_revenue !== undefined ? summary.total_won_revenue : wonLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);

  const wonRevenuePct = summary?.won_revenue_percentage ?? 0;

  const leadersList = rawLeaders.map((leader, index) => {
    const rawName = (leader.lead_owner_name || leader.name || leader.leader_name || 'Lead Manager').trim();
    const formattedName = rawName
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const ownerLeads = leads.filter(l => {
      const lOwner = (l.lead_owner_name || l.owner || '').trim().toLowerCase();
      return lOwner === rawName.toLowerCase() || lOwner === formattedName.toLowerCase();
    });

    const pipelineVal = leader.total_pipeline_amount !== undefined ? leader.total_pipeline_amount
      : (leader.pipeline_amount !== undefined ? leader.pipeline_amount
        : (leader.value !== undefined ? leader.value
          : (leader.amount !== undefined ? leader.amount
            : ownerLeads.reduce((sum, l) => sum + (l.value || 0), 0))));

    const totalLeadsCount = leader.total_leads !== undefined ? leader.total_leads
      : (leader.leads_count !== undefined ? leader.leads_count
        : (leader.count !== undefined ? leader.count : ownerLeads.length));

    const totalOverallLeads = summary?.total_leads || (leads.length || 1);
    const sharePct = totalOverallLeads > 0 ? (((totalLeadsCount) / totalOverallLeads) * 100).toFixed(1) : '0';

    // Dynamic stage breakdown map based directly on actual backend stage/status values
    const stageMap = {};

    // 1. If backend payload provides leader.by_stage or leader.stages, populate directly
    if (leader.by_stage && typeof leader.by_stage === 'object') {
      Object.entries(leader.by_stage).forEach(([stg, count]) => {
        const num = Number(count) || 0;
        if (num > 0) stageMap[stg] = (stageMap[stg] || 0) + num;
      });
    } else if (Array.isArray(leader.stages)) {
      leader.stages.forEach(stgObj => {
        const stgName = stgObj.stage_name || stgObj.name || stgObj.stage;
        const num = Number(stgObj.count || stgObj.total_leads) || 0;
        if (stgName && num > 0) stageMap[stgName] = (stageMap[stgName] || 0) + num;
      });
    }

    // 2. Group ownerLeads by their ACTUAL backend stage/status string
    if (Object.keys(stageMap).length === 0 && ownerLeads.length > 0) {
      ownerLeads.forEach(l => {
        const actualStage = (
          l.stage_name ||
          l.confidence ||
          l.stage ||
          l.status_name ||
          l.status ||
          'Active'
        ).trim();

        const formattedStage = actualStage.charAt(0).toUpperCase() + actualStage.slice(1);
        stageMap[formattedStage] = (stageMap[formattedStage] || 0) + 1;
      });
    }

    // Color mapper based on stage keyword
    const getStageColor = (stageName) => {
      const lower = stageName.toLowerCase();
      if (lower.includes('low')) return '#38BDF8';
      if (lower.includes('medium') || lower.includes('med')) return '#B45309';
      if (lower.includes('high')) return '#818CF8';
      if (lower.includes('qualif')) return '#818CF8';
      if (lower.includes('negot')) return '#E69819';
      if (lower.includes('proposal')) return '#818CF8';
      if (lower.includes('won')) return '#10B981';
      if (lower.includes('lost')) return '#64748B';
      if (lower.includes('new')) return '#38BDF8';
      if (lower.includes('contact')) return '#818CF8';
      if (lower.includes('unqualif')) return '#94A3B8';
      return '#38BDF8';
    };

    const stageBreakdown = Object.entries(stageMap).map(([stageName, count]) => {
      const lower = stageName.toLowerCase();
      const isDeal = lower.includes('negot') || lower.includes('won') || lower.includes('lost');
      const unit = isDeal ? (count === 1 ? 'Deal' : 'Deals') : (count === 1 ? 'Lead' : 'Leads');
      return {
        label: stageName,
        value: `${count} ${unit}`,
        color: getStageColor(stageName)
      };
    });
    // Individual stage metric counts
    const qualifiedCount = leader.total_qualified !== undefined ? leader.total_qualified
      : (leader.qualified !== undefined ? leader.qualified
        : (leader.qualified_count !== undefined ? leader.qualified_count
          : ownerLeads.filter(l => (l.stage_name || l.stage || '').toLowerCase().includes('qualif')).length));

    const negotiationsCount = leader.total_leads_in_negotiations !== undefined ? leader.total_leads_in_negotiations
      : (leader.negotiation !== undefined ? leader.negotiation
        : (leader.negotiations !== undefined ? leader.negotiations
          : (leader.negotiation_count !== undefined ? leader.negotiation_count
            : ownerLeads.filter(l => (l.stage_name || l.stage || l.confidence || '').toLowerCase().includes('negot')).length)));

    const proposalsCount = leader.total_proposals_sent !== undefined ? leader.total_proposals_sent
      : (leader.proposals_sent !== undefined ? leader.proposals_sent
        : (leader.proposal_sent !== undefined ? leader.proposal_sent
          : (leader.proposals !== undefined ? leader.proposals
            : ownerLeads.filter(l => (l.stage_name || l.stage || l.status_name || '').toLowerCase().includes('proposal')).length)));

    const lostCount = leader.lost_projects !== undefined ? leader.lost_projects
      : (leader.lost !== undefined ? leader.lost
        : (leader.lost_count !== undefined ? leader.lost_count
          : ownerLeads.filter(l => (l.stage_name || l.stage || '').toLowerCase().includes('lost')).length));

    const wonRevenue = leader.total_won_revenue !== undefined ? leader.total_won_revenue
      : (leader.won_revenue !== undefined ? leader.won_revenue
        : ownerLeads.reduce((sum, l) => sum + (l.wonValue || 0), 0));

    return {
      id: leader.lead_owner_id || leader.id || index + 1,
      name: formattedName,
      email: leader.lead_owner_email || leader.email || '',
      value: pipelineVal,
      valueFormatted: formatCurrencyCompact(pipelineVal),
      leadsCount: totalLeadsCount,
      qualifiedCount,
      negotiationsCount,
      proposalsCount,
      lostCount,
      wonRevenue,
      stageBreakdown,
      sharePct
    };
  });

  const activeOwnersCount = leadersList.length;

  // Stage distribution by pipeline: live SSE payload or derived from by_product
  const stageDistributionData = useMemo(() => {
    if (Array.isArray(sseData?.stage_distribution_by_pipeline) && sseData.stage_distribution_by_pipeline.length > 0) {
      return sseData.stage_distribution_by_pipeline.map((item, idx) => {
        const rawName = item.product_name || `Product ${idx + 1}`;
        const shortName = rawName.length > 9 ? rawName.slice(0, 8) + '…' : rawName;

        let segments = [];
        let totalCountFromStages = 0;

        if (Array.isArray(item.stages) && item.stages.length > 0) {
          const stageMap = {};
          item.stages.forEach(st => {
            const sName = st.stage_name || 'Stage';
            const count = Number(st.lead_count) || 0;
            const val = Number(st.pipeline_amount || st.total_value) || 0;
            if (!stageMap[sName]) {
              stageMap[sName] = { name: sName, count: 0, val: 0 };
            }
            stageMap[sName].count += count;
            stageMap[sName].val += val;
            totalCountFromStages += count;
          });

          const totalLeads = item.total_leads !== undefined ? item.total_leads : totalCountFromStages;
          const denom = totalLeads > 0 ? totalLeads : (totalCountFromStages || 1);

          segments = Object.values(stageMap).map((st, sIdx) => ({
            name: st.name,
            count: st.count,
            percentage: Math.round((st.count / denom) * 100),
            pipelineAmount: formatFullCurrency(st.val),
            color: getStageColor(st.name, sIdx)
          }));
        } else if (Array.isArray(item.statuses) && item.statuses.length > 0) {
          const statusMap = {};
          item.statuses.forEach(st => {
            const sName = st.status_name || 'Status';
            const count = Number(st.lead_count) || 0;
            const val = Number(st.pipeline_amount) || 0;
            if (!statusMap[sName]) {
              statusMap[sName] = { name: sName, count: 0, val: 0 };
            }
            statusMap[sName].count += count;
            statusMap[sName].val += val;
            totalCountFromStages += count;
          });

          const totalLeads = item.total_leads !== undefined ? item.total_leads : totalCountFromStages;
          const denom = totalLeads > 0 ? totalLeads : (totalCountFromStages || 1);

          segments = Object.values(statusMap).map((st, sIdx) => ({
            name: st.name,
            count: st.count,
            percentage: Math.round((st.count / denom) * 100),
            pipelineAmount: formatFullCurrency(st.val),
            color: getStageColor(st.name, sIdx)
          }));
        } else {
          const totalLeads = Number(item.total_leads) || 0;
          segments = [{
            name: 'Active',
            count: totalLeads,
            percentage: 100,
            pipelineAmount: formatFullCurrency(item.total_pipeline_amount || 0),
            color: '#00D4AA'
          }];
        }

        const totalLeads = item.total_leads !== undefined ? item.total_leads : totalCountFromStages;
        const totalPipeline = item.total_pipeline_amount !== undefined ? item.total_pipeline_amount : 0;

        return {
          label: shortName,
          fullName: rawName,
          totalLeads,
          totalPipeline: formatFullCurrency(totalPipeline),
          segments
        };
      });
    } else if (sseData?.by_product && typeof sseData.by_product === 'object' && Object.keys(sseData.by_product).length > 0) {
      const productEntries = Object.entries(sseData.by_product);
      return productEntries.map(([productName, count], idx) => {
        const shortName = productName.length > 9 ? productName.slice(0, 8) + '…' : productName;
        const leadsCount = Number(count) || 0;

        return {
          label: shortName,
          fullName: productName,
          totalLeads: leadsCount,
          totalPipeline: '₹ 0',
          segments: [{
            name: 'Active',
            count: leadsCount,
            percentage: 100,
            pipelineAmount: '₹ 0',
            color: getStageColor('active', idx)
          }]
        };
      });
    }

    return [];
  }, [sseData]);

  // Dynamic list of unique stages present across all products in stageDistributionData
  const activePipelineStages = useMemo(() => {
    const stageMap = new Map();
    stageDistributionData.forEach(bar => {
      (bar.segments || []).forEach(seg => {
        if (!stageMap.has(seg.name)) {
          stageMap.set(seg.name, seg.color);
        }
      });
    });
    return Array.from(stageMap.entries()).map(([label, color]) => ({ label, color }));
  }, [stageDistributionData]);

  // Dynamic Y-axis scale and tick calculation for Pipeline Stage Levels
  const formatAxisTick = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(val);
  };

  const maxPipelineLeads = Math.max(1, ...(stageDistributionData.map(x => x.totalLeads || 0)));
  const maxPipelineTick = maxPipelineLeads <= 4
    ? Math.max(2, maxPipelineLeads + 1)
    : (maxPipelineLeads <= 10 ? Math.ceil(maxPipelineLeads * 1.2) : Math.ceil(maxPipelineLeads / 5) * 5);

  const pipelineTicks = [];
  const pipelineTickStep = Math.max(1, Math.round(maxPipelineTick / 4));
  for (let val = maxPipelineTick; val >= 0; val -= pipelineTickStep) {
    pipelineTicks.push(val);
  }
  if (!pipelineTicks.includes(0)) pipelineTicks.push(0);
  const cleanPipelineTicks = Array.from(new Set(pipelineTicks)).sort((a, b) => b - a);

  const totalSkusCount = Object.keys(sseData?.by_product || {}).length || stageDistributionData.length;

  const totalWon = sseData?.total_won_count !== undefined ? sseData.total_won_count : (byStage?.Won !== undefined ? byStage.Won : (summary?.total_won_revenue ? 1 : 0));
  const totalLost = sseData?.total_lost_count !== undefined ? sseData.total_lost_count : (byStage?.Lost !== undefined ? byStage.Lost : (summary?.lost_projects !== undefined ? summary.lost_projects : 1));
  const totalClosed = totalWon + totalLost;
  const winRatioPct = totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : (totalWon > 0 ? 100 : 50);

  const pipelineKpis = [
    {
      label: 'Total Leads',
      value: openLeadsCount,
      trend: `${openLeadsCount} Leads`,
      accent: '#00C6FF',
      icon: <FiUsers style={{ fontSize: 'clamp(14px, 1.4vw, 20px)' }} />,
      is_active: true,
      filter: { stage: 'all' }
    },
    {
      label: 'Qualified Leads',
      value: qualifiedCount,
      trend: `${qualifiedPct}%`,
      subText: qualifiedProjVal > 0 ? `Proj: ₹${Math.round(qualifiedProjVal).toLocaleString('en-IN')}` : null,
      accent: '#00D4AA',
      icon: <FiTarget style={{ fontSize: 'clamp(14px, 1.4vw, 20px)' }} />,
      status_id: 3, // Lead Product Status = Qualified (#3)
      filter: { stage: 'qualified' }
    },
    {
      label: 'Negotiations',
      value: negotiationsCount,
      trend: `${negotiationsPct}%`,
      subText: negotiationsProjVal > 0 ? `Proj: ₹${Math.round(negotiationsProjVal).toLocaleString('en-IN')}` : null,
      accent: '#F59E0B',
      icon: <FiTrendingUp style={{ fontSize: 'clamp(14px, 1.4vw, 20px)' }} />,
      stage_id: 4, // Leader Stage = Negotiation (#4)
      filter: { stage: 'proposal' }
    },
    {
      label: 'Proposal Sent',
      value: proposalCount,
      trend: `${proposalPct}%`,
      subText: proposalProjVal > 0 ? `Proj: ₹${Math.round(proposalProjVal).toLocaleString('en-IN')}` : null,
      accent: '#818CF8',
      icon: <FiSend style={{ fontSize: 'clamp(14px, 1.4vw, 20px)' }} />,
      status_id: 5, // Lead Product Status = Proposal Sent (#5)
      filter: { stage: 'proposal' }
    },
    {
      label: 'Weighted Pipeline',
      value: formatFullCurrency(weightedPipelineValue),
      trend: `${pipelinePct}% Share`,
      accent: '#0EA5E9',
      icon: <FaIndianRupeeSign style={{ fontSize: 'clamp(14px, 1.4vw, 20px)' }} />,
      is_active: true,
      filter: { stage: 'all' }
    },
    {
      label: 'Lost Projects',
      value: lostProjectsCount,
      trend: `${lostPct}%`,
      subText: `Lost: ₹${Math.round(lostProjectVal).toLocaleString('en-IN')} / Proj: ₹${Math.round(totalProjectVal).toLocaleString('en-IN')}`,
      accent: '#64748B',
      icon: <FiXCircle style={{ fontSize: 'clamp(14px, 1.4vw, 20px)' }} />,
      stage_id: 6, // Leader Stage = Lost (#6)
      filter: { stage: 'lost' }
    },
    {
      label: 'Won Revenue',
      value: formatFullCurrency(wonRevenueValue),
      trend: `${wonRevenuePct}% Share`,
      accent: '#FF7E27',
      icon: <FiCheckCircle style={{ fontSize: 'clamp(14px, 1.4vw, 20px)' }} />,
      stage_id: 5, // Leader Stage = Won (#5)
      filter: { stage: 'won' }
    }
  ];

  // Available product list from live dataset
  const availableProductList = useMemo(() => {
    const pSet = new Set();
    if (sseData?.by_product && typeof sseData.by_product === 'object') {
      Object.keys(sseData.by_product).forEach(p => pSet.add(p));
    }
    if (Array.isArray(sseData?.stage_distribution_by_pipeline)) {
      sseData.stage_distribution_by_pipeline.forEach(item => {
        const name = item.product_name || item.product || item.name;
        if (name) pSet.add(name);
      });
    }
    if (sseData?.by_stage_by_product && typeof sseData.by_stage_by_product === 'object') {
      Object.values(sseData.by_stage_by_product).forEach(pm => {
        if (pm && typeof pm === 'object') {
          Object.keys(pm).forEach(p => pSet.add(p));
        }
      });
    }
    if (Array.isArray(leads)) {
      leads.forEach(l => {
        if (l.product_name) pSet.add(l.product_name);
        if (Array.isArray(l.products)) {
          l.products.forEach(p => {
            const pname = p.product_name || p.product;
            if (pname) pSet.add(pname);
          });
        }
      });
    }
    return Array.from(pSet).filter(Boolean);
  }, [sseData, leads]);

  // Lead status data dynamically derived from SSE/API payload & filtered by statusProductFilter
  const leadStatusData = useMemo(() => {
    const byStatus = sseData?.by_status || {};
    const byStatusByProduct = sseData?.by_status_by_product || {};

    const backendStatusKeys = Object.keys(byStatus);
    const defaultStatuses = ['Fresh', 'Contacted', 'Follow Up', 'Meeting Scheduled', 'Converted', 'Dropped'];

    let allStatuses = backendStatusKeys.length > 0 ? backendStatusKeys : defaultStatuses;

    const productLeads = statusProductFilter === 'all'
      ? leads
      : leads.filter(l => {
        const pname = (l.product_name || '').toLowerCase();
        const target = statusProductFilter.toLowerCase();
        if (pname === target) return true;
        if (Array.isArray(l.products)) {
          return l.products.some(p => (p.product_name || p.product || '').toLowerCase() === target);
        }
        return false;
      });

    if (statusProductFilter !== 'all') {
      const activeProdStatuses = new Set();
      Object.entries(byStatusByProduct).forEach(([st, prodMap]) => {
        if (prodMap && prodMap[statusProductFilter] !== undefined && Number(prodMap[statusProductFilter]) > 0) {
          activeProdStatuses.add(st);
        }
      });
      productLeads.forEach(l => {
        const st = l.status_name || l.status;
        if (st) activeProdStatuses.add(st);
      });
      if (activeProdStatuses.size > 0) {
        allStatuses = Array.from(activeProdStatuses);
      }
    }

    return allStatuses.map((statusName, idx) => {
      let count = 0;
      if (statusProductFilter === 'all') {
        if (byStatus[statusName] !== undefined) {
          count = Number(byStatus[statusName]) || 0;
        } else {
          count = leads.filter(l => (l.status_name || l.status || '').toLowerCase() === statusName.toLowerCase()).length;
        }
      } else {
        const prodMap = byStatusByProduct[statusName] || {};
        if (prodMap[statusProductFilter] !== undefined) {
          count = Number(prodMap[statusProductFilter]) || 0;
        } else {
          count = productLeads.filter(l => (l.status_name || l.status || '').toLowerCase() === statusName.toLowerCase()).length;
        }
      }

      const match = statusMasterList.find(s =>
        (s.status || s.status_name || s.name || '').toLowerCase() === statusName.toLowerCase()
      );
      const statusId = match?.id || match?.status_id || idx + 1;

      return {
        label: statusName,
        count,
        color: '#1E6888',
        status_id: statusId
      };
    });
  }, [sseData, statusProductFilter, statusMasterList, leads]);

  // Dynamic Y-axis scale and columns for Lead Status Distribution
  const maxStatusCount = Math.max(...leadStatusData.map(d => d.count), 0);
  const maxStatusTick = maxStatusCount <= 5 ? 5 : (maxStatusCount <= 10 ? 10 : Math.ceil(maxStatusCount / 5) * 5);
  const statusTicks = [];
  const tickStep = Math.max(1, Math.round(maxStatusTick / 5));
  for (let val = maxStatusTick; val >= 0; val -= tickStep) {
    statusTicks.push(val);
  }
  const cleanStatusTicks = Array.from(new Set(statusTicks));
  const numStatusCols = Math.max(leadStatusData.length, 1);

  // Sales funnel data for the horizontal bar chart & filtered by funnelProductFilter
  const salesFunnelData = useMemo(() => {
    const byStage = sseData?.by_stage || {};
    const byStageByProduct = sseData?.by_stage_by_product || {};

    // Standard 6 stages in exact order matching sales funnel pipeline sequence (High -> Medium -> Low -> Negotiation -> Won -> Lost)
    const standardOrder = ['High', 'Medium', 'Low', 'Negotiation', 'Won', 'Lost'];

    const productLeads = funnelProductFilter === 'all'
      ? leads
      : leads.filter(l => {
        const pname = (l.product_name || '').toLowerCase();
        const target = funnelProductFilter.toLowerCase();
        if (pname === target) return true;
        if (Array.isArray(l.products)) {
          return l.products.some(p => (p.product_name || p.product || '').toLowerCase() === target);
        }
        return false;
      });

    const rawData = standardOrder.map((stName, idx) => {
      let count = 0;
      if (funnelProductFilter === 'all') {
        if (stName === 'Won') {
          count = sseData?.total_won_count !== undefined
            ? Number(sseData.total_won_count)
            : (byStage['Won'] !== undefined ? Number(byStage['Won']) : leads.filter(l => (l.stage_name || l.stage || '').toLowerCase().includes('won')).length);
        } else if (stName === 'Lost') {
          count = sseData?.total_lost_count !== undefined
            ? Number(sseData.total_lost_count)
            : (byStage['Lost'] !== undefined ? Number(byStage['Lost']) : leads.filter(l => (l.stage_name || l.stage || '').toLowerCase().includes('lost')).length);
        } else if (byStage[stName] !== undefined) {
          count = Number(byStage[stName]) || 0;
        } else {
          count = leads.filter(l => (l.stage_name || l.confidence || l.stage || '').toLowerCase().includes(stName.toLowerCase())).length;
        }
      } else {
        if (stName === 'Won') {
          count = sseData?.won_count_by_product?.[funnelProductFilter] !== undefined
            ? Number(sseData.won_count_by_product[funnelProductFilter])
            : productLeads.filter(l => (l.stage_name || l.stage || '').toLowerCase().includes('won')).length;
        } else if (stName === 'Lost') {
          count = sseData?.lost_count_by_product?.[funnelProductFilter] !== undefined
            ? Number(sseData.lost_count_by_product[funnelProductFilter])
            : productLeads.filter(l => (l.stage_name || l.stage || '').toLowerCase().includes('lost')).length;
        } else {
          const prodMap = byStageByProduct[stName] || {};
          if (prodMap[funnelProductFilter] !== undefined) {
            count = Number(prodMap[funnelProductFilter]) || 0;
          } else {
            count = productLeads.filter(l => (l.stage_name || l.confidence || l.stage || '').toLowerCase().includes(stName.toLowerCase())).length;
          }
        }
      }

      let prob = '50%';
      let stageId = idx + 1;
      let colorGradient = 'linear-gradient(90deg, #0EA5E9, #00C6FF)';
      let glowColor = 'rgba(0, 198, 255, 0.4)';
      const lower = stName.toLowerCase();
      if (lower.includes('high')) {
        prob = '75%';
        stageId = 1;
        colorGradient = 'linear-gradient(90deg, #6366F1, #818CF8)';
        glowColor = 'rgba(129, 140, 248, 0.35)';
      } else if (lower.includes('med')) {
        prob = '50%';
        stageId = 2;
        colorGradient = 'linear-gradient(90deg, #151D2A, #1E293B)';
        glowColor = 'rgba(30, 41, 59, 0.4)';
      } else if (lower.includes('low')) {
        prob = '25%';
        stageId = 3;
        colorGradient = 'linear-gradient(90deg, #0284C7, #38BDF8)';
        glowColor = 'rgba(56, 189, 248, 0.4)';
      } else if (lower.includes('negot')) {
        prob = '90%';
        stageId = 4;
        colorGradient = 'linear-gradient(90deg, #D97706, #E69819)';
        glowColor = 'rgba(230, 152, 25, 0.4)';
      } else if (lower.includes('won')) {
        prob = '100%';
        stageId = 5;
        colorGradient = 'linear-gradient(90deg, #059669, #10B981)';
        glowColor = 'rgba(16, 185, 129, 0.4)';
      } else if (lower.includes('lost')) {
        prob = '0%';
        stageId = 6;
        colorGradient = 'linear-gradient(90deg, #475569, #64748B)';
        glowColor = 'rgba(100, 116, 139, 0.3)';
      }

      return {
        label: stName,
        count: Number(count) || 0,
        colorGradient,
        glowColor,
        prob,
        stage_id: stageId
      };
    });

    const totalRawCount = rawData.reduce((sum, item) => sum + item.count, 0);

    // Fallback demo values only if totalRawCount is 0 AND no leads exist at all in system
    if (totalRawCount === 0 && (!leads || leads.length === 0) && funnelProductFilter === 'all') {
      const defaultFallbackCounts = { High: 3, Medium: 3, Negotiation: 2, Won: 5, Lost: 4, Low: 1 };
      return rawData.map(item => ({ ...item, count: defaultFallbackCounts[item.label] || 0 }));
    }

    return rawData;
  }, [sseData, funnelProductFilter, leads]);

  const maxFunnel = Math.max(...salesFunnelData.map(d => d.count), 1);

  // Deal status & value split stats filtered by dealProductFilter
  const dealStats = useMemo(() => {
    let won = 0;
    let lost = 0;
    let wonRevenue = 0;
    let lostRevenue = 0;

    if (dealProductFilter === 'all') {
      won = sseData?.total_won_count !== undefined
        ? sseData.total_won_count
        : (sseData?.by_stage?.Won !== undefined ? sseData.by_stage.Won : (sseData?.summary?.total_won_revenue ? 1 : 0));
      lost = sseData?.total_lost_count !== undefined
        ? sseData.total_lost_count
        : (sseData?.by_stage?.Lost !== undefined ? sseData.by_stage.Lost : (sseData?.summary?.lost_projects !== undefined ? sseData.summary.lost_projects : 1));
      wonRevenue = summary?.total_won_revenue !== undefined ? summary.total_won_revenue : wonLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
      lostRevenue = summary?.lost_project_value !== undefined
        ? summary.lost_project_value
        : (leads || []).filter(l => (l.stage_name || l.stage || l.stageKey || '').toLowerCase().includes('lost')).reduce((sum, lead) => sum + (lead.value || 0), 0);
    } else {
      won = Number(sseData?.won_count_by_product?.[dealProductFilter]) || 0;
      lost = Number(sseData?.lost_count_by_product?.[dealProductFilter]) || 0;

      const prodPipeline = (sseData?.stage_distribution_by_pipeline || []).find(
        p => (p.product_name || '').toLowerCase() === dealProductFilter.toLowerCase()
      );
      if (prodPipeline && Array.isArray(prodPipeline.stages)) {
        const wonStage = prodPipeline.stages.find(s => (s.stage_name || '').toLowerCase() === 'won');
        if (wonStage) {
          wonRevenue = Number(wonStage.total_value || wonStage.pipeline_amount) || 0;
        }
        const lostStage = prodPipeline.stages.find(s => (s.stage_name || '').toLowerCase() === 'lost');
        if (lostStage) {
          lostRevenue = Number(lostStage.total_value || lostStage.pipeline_amount) || 0;
        }
      }
    }

    const wonCount = won;
    const lostCount = lost;
    const closedCount = wonCount + lostCount;
    const countWinRatio = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
    const countLostRatio = closedCount > 0 ? 100 - countWinRatio : 0;

    const wonValue = wonRevenue;
    const lostValue = lostRevenue;
    const totalClosedValue = wonValue + lostValue;
    const valueWinRatio = totalClosedValue > 0 ? Math.round((wonValue / totalClosedValue) * 100) : 0;
    const valueLostRatio = totalClosedValue > 0 ? 100 - valueWinRatio : 0;

    return {
      wonCount,
      lostCount,
      closedCount,
      countWinRatio,
      countLostRatio,

      wonValue,
      lostValue,
      totalClosedValue,
      valueWinRatio,
      valueLostRatio
    };
  }, [sseData, summary, wonLeads, leads, dealProductFilter]);

  // Reusable glass card style
  const glassCard = {
    background: 'var(--t-surface)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid var(--t-border)',
    borderRadius: '8px',
    boxShadow: 'var(--t-card-shadow)',
    transition: 'all 220ms ease'
  };

  // If data is loading, render the complete full-page Skeleton loader
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-main-container" style={{ flex: 1, height: '100%', overflowY: 'auto', padding: 'clamp(12px, 1.2vw, 20px)', position: 'relative', zIndex: 1 }}>

      {/* TOP KPI METRICS ROW */}
      <div className="kpi-row">
        {pipelineKpis.map((item) => (
          <div
            key={item.label}
            className="kpi-card"
            onClick={() => setSelectedDrillDownKpi(item)}
            title={`Click to open ${item.label} drill-down analysis`}
            style={{
              cursor: 'pointer',
              position: 'relative',
              background: 'var(--t-surface)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid var(--t-border)',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: 'var(--t-card-shadow)',
              transition: 'all 220ms ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = item.accent;
              e.currentTarget.style.boxShadow = `0 12px 30px rgba(0, 0, 0, 0.2), 0 0 18px ${item.accent}33`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.borderColor = 'var(--t-border)';
              e.currentTarget.style.boxShadow = 'var(--t-card-shadow)';
            }}
          >
            {/* Top Accent Line */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: item.accent,
              boxShadow: `0 0 10px ${item.accent}`
            }} />

            <div className="kpi-card-main" style={{ padding: '10px 10px 8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                className="kpi-icon-box"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  fontSize: '17px',
                  flexShrink: 0,
                  background: `${item.accent}1A`,
                  border: `1px solid ${item.accent}44`,
                  color: item.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 12px ${item.accent}25`
                }}
              >
                {item.icon}
              </div>
              <div className="kpi-info" style={{ minWidth: 0, flex: 1 }}>
                <span className="kpi-label" style={{ fontSize: 'clamp(10.5px, 0.72vw, 11px)', color: 'var(--t-fg-muted)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', lineHeight: '1.2' }}>
                  {item.label}
                </span>
                <span className="kpi-value" style={{ fontSize: typeof item.value === 'string' ? (item.value.length > 12 ? '13.5px' : item.value.length > 9 ? '15px' : '17px') : '20px', fontWeight: 900, fontFamily: "'Helvetica'", color: 'var(--t-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', letterSpacing: '-0.02em', margin: '1px 0' }}>
                  {typeof item.value === 'number' ? item.value.toLocaleString('en-IN') : item.value}
                </span>
                <span style={{ fontSize: '10px', fontFamily: "'Inter', sans-serif", color: item.accent, fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.trend}
                </span>
              </div>
            </div>

            <div
              className="kpi-more-info"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDrillDownKpi(item);
              }}
              style={{
                padding: '5px 8px',
                borderTop: '1px solid var(--t-border)',
                background: 'transparent',
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--t-fg-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                transition: 'all 160ms ease',
                marginTop: 'auto',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${item.accent}14`;
                e.currentTarget.style.color = item.accent;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--t-fg-muted)';
              }}
            >
              More info <FiArrowRightCircle style={{ fontSize: '12px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* ROW 1: PIPELINE STAGE LEVELS (LEFT) + LEAD STATUS & SALES FUNNEL STACKED (RIGHT) */}
      <div className="dashboard-row-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'clamp(12px, 1.2vw, 20px)', marginBottom: 'clamp(12px, 1.2vw, 20px)' }}>

        {/* Column 1: Pipeline Stage Levels — Stacked Bar Chart */}
        <div style={{ ...glassCard, padding: '20px 22px', display: 'flex', flexDirection: 'column', minHeight: '520px', flex: 1, minWidth: 0 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: "'Helvetica'", fontSize: 'clamp(18px, 1.35vw, 22px)', fontWeight: 600, color: 'var(--t-fg)', letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Pipeline Stage Levels
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--t-fg-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Product-wise stage distribution across pipeline
              </div>
            </div>
          </div>

          {stageDistributionData.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '360px', color: 'var(--t-fg-muted)' }}>
              <FiBarChart2 style={{ fontSize: '36px', opacity: 0.4, marginBottom: '10px' }} />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>No pipeline product distribution data available</span>
            </div>
          ) : (
            <>
              {/* Dynamic Legend */}
              <div style={{ display: 'flex', gap: '18px', fontSize: '13px', fontFamily: "'Inter', sans-serif", marginBottom: '16px', marginTop: '12px', fontWeight: 700, flexWrap: 'wrap' }}>
                {activePipelineStages.map(item => (
                  <span key={item.label} style={{ color: item.color, display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: item.color, boxShadow: `0 0 8px ${item.color}` }}></span>
                    {item.label}
                  </span>
                ))}
              </div>

              {/* Chart area — height 380px dynamic */}
              <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: '0', flex: 1, minHeight: '380px' }}>

                {/* Y-axis labels dynamically generated from pipelineTicks */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: '10px', paddingBottom: '4px', fontSize: '12px', color: 'var(--t-fg-muted)', fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>
                  {cleanPipelineTicks.map(l => <span key={l}>{formatAxisTick(l)}</span>)}
                </div>

                {/* Bars + grid */}
                <div style={{ position: 'relative', borderLeft: '1px solid var(--t-border)', borderBottom: '1px solid var(--t-border)' }}>
                  {/* Dynamic horizontal grid lines matching cleanPipelineTicks */}
                  {cleanPipelineTicks.filter(n => n > 0).map(tickVal => (
                    <div key={tickVal} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(tickVal / maxPipelineTick) * 100}%`, height: '1px', background: 'var(--t-border)', opacity: 0.7 }} />
                  ))}

                  {/* Bars */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 16px 0 12px', gap: '10px' }}>
                    {stageDistributionData.map((bar, i) => {
                      const heightPct = Math.min(100, Math.max(bar.totalLeads > 0 ? 6 : 0, Math.round((bar.totalLeads / maxPipelineTick) * 100)));
                      return (
                        <div
                          key={bar.fullName || i}
                          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}
                        >
                          {/* Total lead count badge */}
                          {/* <div style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: '12px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: bar.totalLeads > 0 ? 'rgba(0, 212, 170, 0.15)' : 'transparent',
                            color: bar.totalLeads > 0 ? '#00D4AA' : 'var(--t-fg-muted)',
                            border: bar.totalLeads > 0 ? '1px solid rgba(0, 212, 170, 0.3)' : 'none',
                            boxShadow: bar.totalLeads > 0 ? '0 0 10px rgba(0, 212, 170, 0.2)' : 'none'
                          }}>
                            {bar.totalLeads}
                          </div> */}

                          {/* Stacked bar */}
                          <div
                            style={{
                              width: '100%',
                              maxWidth: '60px',
                              height: `${heightPct}%`,
                              display: 'flex',
                              flexDirection: 'column-reverse',
                              gap: '2px',
                              borderRadius: '8px 8px 0 0',
                              overflow: 'hidden',
                              position: 'relative',
                              cursor: 'pointer',
                              transition: 'transform 160ms ease, boxShadow 160ms ease'
                            }}
                            onMouseMove={(e) => handleMouseMove(e, bar.fullName, 'Pipeline Stage Distribution', [
                              { label: 'Total Leads', value: `${bar.totalLeads} ${bar.totalLeads === 1 ? 'Lead' : 'Leads'}`, color: 'var(--t-fg)' },
                              ...(bar.segments || []).map(seg => ({
                                label: `${seg.name} Stage`,
                                value: `${seg.count} (${seg.percentage}%) - ${seg.pipelineAmount}`,
                                color: seg.color
                              })),
                              { label: 'Total Pipeline', value: bar.totalPipeline, color: '#00C6FF' }
                            ])}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scaleY(1.02)';
                              e.currentTarget.style.boxShadow = '0 0 18px rgba(0, 212, 170, 0.45)';
                            }}
                            onMouseLeave={(e) => {
                              handleMouseLeave();
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            {(bar.segments || []).map((seg, sIdx) => (
                              seg.percentage > 0 && (
                                <div
                                  key={seg.name || sIdx}
                                  style={{
                                    height: `${seg.percentage}%`,
                                    background: seg.color,
                                    position: 'relative',
                                    minHeight: '3px'
                                  }}
                                  title={`${seg.name}: ${seg.count} leads (${seg.percentage}%)`}
                                />
                              )
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* X-axis product labels */}
              <div style={{ display: 'flex', justifyContent: 'space-around', paddingLeft: '48px', paddingRight: '12px', marginTop: '10px', gap: '10px' }}>
                {stageDistributionData.map(bar => (
                  <span
                    key={bar.fullName}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--t-fg-muted)',
                      fontFamily: "'Inter', sans-serif",
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={bar.fullName}
                  >
                    {bar.label}
                  </span>
                ))}
              </div>

              {/* Summary stats row */}
              {/* <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', borderTop: '1px solid var(--t-border)', paddingTop: '18px', marginTop: '20px' }}>
                {[
                  { label: 'Above Target', value: proposalCount, color: '#00D4AA', trend: '↑ 9.4%' },
                  { label: 'At Target', value: qualifiedCount, color: '#00C6FF', trend: '↑ 3.1%' },
                  { label: 'Below Target', value: newCount + contactedCount, color: '#FF4B2B', trend: '↓ 12.8%' },
                  { label: 'Total SKUs', value: totalSkusCount, color: '#818CF8', trend: '↑ 6.3%' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'var(--t-surface-alt)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--t-border)' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--t-fg-muted)', fontFamily: "'Inter', sans-serif", textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>{stat.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--t-fg)', fontFamily: "'Helvetica'", lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: '12px', color: stat.color, fontWeight: 700, marginTop: '5px' }}>{stat.trend}</div>
                  </div>
                ))}
              </div> */}
            </>
          )}
        </div>

        {/* Column 2: STACKED (1) LEAD STATUS + (2) SALES FUNNEL (EXPANDED HEIGHT) */}
        <div className="stacked-cards-column" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.2vw, 20px)', height: '100%', minWidth: 0 }}>

          {/* 1. LEAD STATUS - Vertical Bar Chart */}
          <div style={{ ...glassCard, padding: '20px 22px', display: 'flex', flexDirection: 'column', minHeight: '300px', flex: 1, minWidth: 0, overflow: 'visible' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: "'Helvetica'", fontSize: 'clamp(18px, 1.35vw, 22px)', fontWeight: 600, color: 'var(--t-fg)', letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Lead Status Distribution
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--t-fg-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Live counts across lead pipeline categories
                </div>
              </div>

              {/* By Product Filter Dropdown for Lead Status */}
              <div ref={statusFilterRef} style={{ position: 'relative', flexShrink: 0, marginTop: '-4px', marginRight: '-4px' }}>
                <button
                  type="button"
                  onClick={() => setStatusFilterOpen(prev => !prev)}
                  style={{
                    background: statusProductFilter !== 'all' ? 'rgba(0, 212, 170, 0.16)' : 'rgba(0, 212, 170, 0.06)',
                    border: '1.5px solid #00D4AA',
                    borderRadius: '999px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#00D4AA',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 160ms ease',
                    boxShadow: '0 0 10px rgba(0, 212, 170, 0.15)',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#00D4AA'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#00D4AA'}
                >
                  <FiFilter style={{ fontSize: '11px' }} />
                  <span>{statusProductFilter === 'all' ? 'By Product' : statusProductFilter}</span>
                  <FiChevronDown style={{ fontSize: '11px', transform: statusFilterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                </button>

                {statusFilterOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 9999,
                    background: '#0B131F',
                    border: '1px solid rgba(0, 212, 170, 0.3)',
                    borderRadius: '8px',
                    padding: '4px',
                    minWidth: '160px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <div
                      onClick={() => {
                        setStatusProductFilter('all');
                        setStatusFilterOpen(false);
                      }}
                      style={{
                        padding: '7px 11px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: statusProductFilter === 'all' ? '#00D4AA' : '#E2E8F0',
                        background: statusProductFilter === 'all' ? 'rgba(0, 212, 170, 0.12)' : 'transparent',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      All Products
                    </div>
                    {availableProductList.map(pName => (
                      <div
                        key={pName}
                        onClick={() => {
                          setStatusProductFilter(pName);
                          setStatusFilterOpen(false);
                        }}
                        style={{
                          padding: '7px 11px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: statusProductFilter === pName ? '#00D4AA' : '#CBD5E1',
                          background: statusProductFilter === pName ? 'rgba(0, 212, 170, 0.12)' : 'transparent',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        {pName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chart Area — dynamic height & scaling */}
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '0', height: '230px', marginTop: '12px', flex: 1 }}>
              {/* Y-axis labels */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: '8px', paddingBottom: '2px', fontSize: '12px', fontWeight: 700, color: 'var(--t-fg-muted)', fontFamily: "'Inter', sans-serif" }}>
                {cleanStatusTicks.map(n => <span key={n}>{n}</span>)}
              </div>

              {/* Grid + Bars */}
              <div style={{ position: 'relative', borderLeft: '1px solid var(--t-border)', borderBottom: '1px solid var(--t-border)' }}>
                {cleanStatusTicks.filter(n => n > 0).map(n => (
                  <div key={n} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(n / maxStatusTick) * 100}%`, height: '1px', background: 'var(--t-border)' }} />
                ))}
                <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${numStatusCols}, 1fr)` }}>
                  {leadStatusData.map((d, i) => (
                    <div
                      key={d.label || i}
                      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}
                    >
                      {d.count > 0 && (
                        <div
                          onMouseMove={(e) => handleMouseMove(e, `Lead Status: ${d.label}`, statusProductFilter !== 'all' ? `${statusProductFilter} Accounts` : 'Active Defense Accounts', [
                            { label: 'Account Count', value: `${d.count} ${d.count === 1 ? 'Account' : 'Accounts'}`, color: '#00C6FF' },
                            { label: 'Percentage', value: `${((d.count / (openLeadsCount || 1)) * 100).toFixed(1)}%`, color: '#00D4AA' }
                          ])}
                          style={{
                            width: numStatusCols > 6 ? '24px' : '36px',
                            maxWidth: '75%',
                            height: `${Math.min(100, Math.max(4, (d.count / maxStatusTick) * 100))}%`,
                            background: 'linear-gradient(180deg, #00C6FF, #0070CC)',
                            borderRadius: '6px 6px 0 0',
                            cursor: 'default',
                            boxShadow: '0 0 14px rgba(0, 198, 255, 0.45)',
                            transition: 'all 200ms ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(180deg, #00D4AA, #00C6FF)';
                            e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 212, 170, 0.65)';
                            e.currentTarget.style.transform = 'scaleY(1.02)';
                          }}
                          onMouseLeave={(e) => {
                            handleMouseLeave();
                            e.currentTarget.style.background = 'linear-gradient(180deg, #00C6FF, #0070CC)';
                            e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 198, 255, 0.45)';
                            e.currentTarget.style.transform = 'none';
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* X-axis status labels matching exact dynamic chart grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '0', marginTop: '10px' }}>
              <div />
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numStatusCols}, 1fr)`, alignItems: 'center' }}>
                {leadStatusData.map(d => (
                  <div
                    key={d.label}
                    style={{
                      textAlign: 'center',
                      fontSize: numStatusCols > 6 ? '10.5px' : '12px',
                      fontWeight: d.count > 0 ? 800 : 600,
                      color: d.count > 0 ? 'var(--t-fg)' : 'var(--t-fg-muted)',
                      fontFamily: "'Inter', sans-serif",
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      padding: '0 2px'
                    }}
                    title={`${d.label} (${d.count} accounts)`}
                  >
                    {d.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Deal Status & Value Split 3D Pie Chart */}
          <div style={{ ...glassCard, padding: '20px 22px', display: 'flex', flexDirection: 'column', minHeight: '320px', flex: 1, justifyContent: 'space-between', overflow: 'visible' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontFamily: "'Helvetica'", fontSize: 'clamp(18px, 1.35vw, 22px)', fontWeight: 600, color: 'var(--t-fg)', letterSpacing: '0.01em' }}>
                  Deal Status & Value Split
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--t-fg-muted)', marginTop: '3px' }}>
                  Win/loss share of closed deals, by value
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '-4px', marginRight: '-4px' }}>
                {/* By Product Filter Dropdown for Deal Status */}
                <div ref={dealFilterRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setDealFilterOpen(prev => !prev)}
                    style={{
                      background: dealProductFilter !== 'all' ? 'rgba(0, 212, 170, 0.16)' : 'rgba(0, 212, 170, 0.06)',
                      border: '1.5px solid #00D4AA',
                      borderRadius: '999px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#00D4AA',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontFamily: "'Inter', sans-serif",
                      transition: 'all 160ms ease',
                      boxShadow: '0 0 10px rgba(0, 212, 170, 0.15)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#00D4AA'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#00D4AA'}
                  >
                    <FiFilter style={{ fontSize: '11px' }} />
                    <span>{dealProductFilter === 'all' ? 'By Product' : dealProductFilter}</span>
                    <FiChevronDown style={{ fontSize: '11px', transform: dealFilterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                  </button>

                  {dealFilterOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      zIndex: 9999,
                      background: '#0B131F',
                      border: '1px solid rgba(0, 212, 170, 0.3)',
                      borderRadius: '8px',
                      padding: '4px',
                      minWidth: '160px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}>
                      <div
                        onClick={() => {
                          setDealProductFilter('all');
                          setDealFilterOpen(false);
                        }}
                        style={{
                          padding: '7px 11px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: dealProductFilter === 'all' ? '#00D4AA' : '#E2E8F0',
                          background: dealProductFilter === 'all' ? 'rgba(0, 212, 170, 0.12)' : 'transparent',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        All Products
                      </div>
                      {availableProductList.map(pName => (
                        <div
                          key={pName}
                          onClick={() => {
                            setDealProductFilter(pName);
                            setDealFilterOpen(false);
                          }}
                          style={{
                            padding: '7px 11px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: dealProductFilter === pName ? '#00D4AA' : '#CBD5E1',
                            background: dealProductFilter === pName ? 'rgba(0, 212, 170, 0.12)' : 'transparent',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                        >
                          {pName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              onMouseMove={(e) => handleMouseMove(e, 'Deal Conversion Status', dealProductFilter !== 'all' ? `${dealProductFilter} Conversion` : 'Overall Pipeline Conversion', [
                {
                  label: 'Won Deals',
                  color: '#00D4AA',
                  valueShare: `${formatFullCurrency(dealStats.wonValue)} (${dealStats.totalClosedValue > 0 ? dealStats.valueWinRatio : 0}% of closed value)`,
                  countShare: `${dealStats.wonCount} Deals (${dealStats.closedCount > 0 ? dealStats.countWinRatio : 0}% of closed deals)`
                },
                {
                  label: 'Lost Deals',
                  color: '#64748B',
                  valueShare: `${formatFullCurrency(dealStats.lostValue)} (${dealStats.totalClosedValue > 0 ? dealStats.valueLostRatio : 0}% of closed value)`,
                  countShare: `${dealStats.lostCount} Deals (${dealStats.closedCount > 0 ? dealStats.countLostRatio : 0}% of closed deals)`
                }
              ])}
              onMouseLeave={handleMouseLeave}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '10px 0', cursor: 'default' }}
            >
              <div style={{ position: 'relative', width: '210px', height: '140px', transition: 'transform 160ms ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                {render3DPieChart(dealStats.valueWinRatio, dealStats.totalClosedValue)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px', paddingTop: '12px', borderTop: '1px solid var(--t-border)', fontSize: '13px', fontFamily: "'Inter', sans-serif" }}>
              <span
                style={{ color: '#00D4AA', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, cursor: 'default' }}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#00D4AA' }}></span> Won: {dealStats.totalClosedValue > 0 ? dealStats.valueWinRatio : 0}% ({formatFullCurrency(dealStats.wonValue)})
              </span>
              <span
                style={{ color: 'var(--t-fg-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, cursor: 'default' }}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#64748B' }}></span> Lost: {dealStats.totalClosedValue > 0 ? dealStats.valueLostRatio : 0}% ({formatFullCurrency(dealStats.lostValue)})
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* ROW 2: LEADS BY OWNER PERFORMANCE & DEAL STATUS */}
      <div className="dashboard-row-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'clamp(12px, 1.2vw, 20px)' }}>

        {/* Leads By Owner Performance Treemap */}
        <div style={{ ...glassCard, padding: '20px 22px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexShrink: 0, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: "'Helvetica'", fontSize: 'clamp(18px, 1.35vw, 22px)', fontWeight: 600, color: 'var(--t-fg)', letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Leads By Owner Performance
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--t-fg-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Revenue & deal distribution by lead manager
              </div>
            </div>
            <span style={{ fontSize: '11.5px', fontFamily: "'Inter', sans-serif", color: 'var(--t-fg-muted)', background: 'var(--t-surface-alt)', border: '1px solid var(--t-border)', padding: '4px 8px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {activeOwnersCount} Active Owner{activeOwnersCount === 1 ? '' : 's'}
            </span>
          </div>

          {/* Dynamic Leads By Owner Performance Squarified Treemap */}
          {(() => {
            const sortedLeadersList = [...leadersList].sort((a, b) => {
              if (b.leadsCount !== a.leadsCount) {
                return b.leadsCount - a.leadsCount;
              }
              return b.value - a.value;
            });

            const totalActiveLeadsCount = sortedLeadersList.reduce((sum, l) => sum + (l.leadsCount || 0), 0) || 1;

            const treemapItems = sortedLeadersList.map((leader, idx) => {
              const activeSharePct = (((leader.leadsCount || 0) / totalActiveLeadsCount) * 100).toFixed(1);
              return {
                ...leader,
                sharePct: activeSharePct,
                weight: Math.max(Number(leader.leadsCount) || 0, 0.4),
                palIdx: idx
              };
            });

            const treemapLayout = computeDynamicTreemapLayout(treemapItems);

            if (treemapLayout.length === 0) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '310px', color: 'var(--t-fg-muted)' }}>
                  <FiUsers style={{ fontSize: '36px', opacity: 0.4, marginBottom: '10px' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>No lead manager performance data available</span>
                </div>
              );
            }

            return (
              <div style={{
                position: 'relative',
                width: '100%',
                flex: 1,
                minHeight: '340px',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                {treemapLayout.map((leader, idx) => {
                  if (!leader) return null;
                  const pal = LEADER_PALETTES[(leader.palIdx || 0) % LEADER_PALETTES.length];
                  const rect = leader.rect || { x: 0, y: 0, w: 0, h: 0 };
                  const isSingle = treemapLayout.length === 1;
                  const isHero = isSingle || (rect.w >= 35 && rect.h >= 60);
                  const isMedium = !isHero && ((rect.w >= 22 && rect.h >= 38) || (rect.w >= 38 && rect.h >= 28));
                  const isCompact = !isHero && !isMedium && (rect.h >= 24);
                  const isMicro = !isHero && !isMedium && !isCompact;

                  return (
                    <div
                      key={leader.id || leader.name || idx}
                      style={{
                        position: 'absolute',
                        left: `${rect.x}%`,
                        top: `${rect.y}%`,
                        width: `${rect.w}%`,
                        height: `${rect.h}%`,
                        padding: '3px',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div
                        onMouseMove={(e) => handleMouseMove(e, leader.name, 'Lead Manager Performance', [
                          { label: 'Total Pipeline', value: leader.valueFormatted, color: pal.accent },
                          { label: 'Active Leads', value: `${leader.leadsCount} Leads (${leader.sharePct}%)`, color: '#FFFFFF' },
                          ...(leader.stageBreakdown || []),
                          ...(leader.email ? [{ label: 'Email', value: leader.email, color: '#E2E8F0' }] : [])
                        ])}
                        style={{
                          width: '100%',
                          height: '100%',
                          background: pal.bg,
                          border: `1px solid ${pal.border}`,
                          borderRadius: '10px',
                          padding: isHero ? '16px 18px' : isMedium ? '10px 12px' : isCompact ? '6px 9px' : '4px 6px',
                          display: 'flex',
                          flexDirection: isSingle ? 'row' : 'column',
                          justifyContent: 'space-between',
                          alignItems: isSingle ? 'center' : 'stretch',
                          cursor: 'default',
                          boxShadow: pal.boxShadow,
                          transition: 'transform 180ms ease, box-shadow 180ms ease',
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.012)';
                          e.currentTarget.style.zIndex = '10';
                          e.currentTarget.style.boxShadow = pal.hoverShadow;
                        }}
                        onMouseLeave={(e) => {
                          handleMouseLeave();
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.zIndex = '1';
                          e.currentTarget.style.boxShadow = pal.boxShadow;
                        }}
                      >
                        {/* Manager Details Header */}
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          {!isMicro && !isSingle && (
                            <span style={{
                              fontSize: isHero ? '10px' : isMedium ? '9px' : '8px',
                              fontFamily: "'Inter', sans-serif",
                              color: 'rgba(255,255,255,0.85)',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              display: 'block',
                              marginBottom: '1px',
                              lineHeight: 1.1
                            }}>
                              LEAD MANAGER
                            </span>
                          )}
                          <div style={{
                            fontFamily: "'Helvetica'",
                            fontSize: isSingle ? '24px' : isHero ? '19px' : isMedium ? '14px' : isCompact ? '12px' : '11px',
                            fontWeight: 800,
                            color: '#FFFFFF',
                            marginTop: isSingle ? 0 : '1px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.15
                          }}>
                            {leader.name}
                          </div>
                          {leader.email && (isHero || (isMedium && rect.h >= 45)) && (
                            <div style={{
                              fontSize: '11px',
                              color: 'rgba(255,255,255,0.85)',
                              marginTop: '1px',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.2
                            }}>
                              {leader.email}
                            </div>
                          )}
                        </div>

                        {/* Revenue & Active Leads Count */}
                        <div style={{ textAlign: isSingle ? 'right' : 'left', marginTop: isSingle ? 0 : '3px', minWidth: 0 }}>
                          <div style={{
                            fontFamily: "'Helvetica'",
                            fontSize: isSingle ? '28px' : isHero ? '22px' : isMedium ? '16px' : isCompact ? '13px' : '11px',
                            fontWeight: 800,
                            color: '#FFFFFF',
                            lineHeight: 1.1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {leader.valueFormatted}
                          </div>
                          <div style={{
                            fontSize: isSingle ? '13px' : isHero ? '12px' : isMedium ? '10.5px' : isCompact ? '9.5px' : '8.5px',
                            fontWeight: 700,
                            color: 'rgba(255,255,255,0.95)',
                            marginTop: '1px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.1
                          }}>
                            {leader.leadsCount} Active Lead{leader.leadsCount === 1 ? '' : 's'} ({leader.sharePct}%)
                          </div>
                          {isSingle && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', padding: '3px 8px', borderRadius: '6px', color: '#FFFFFF', fontWeight: 700 }}>
                                Qualified: {leader.qualifiedCount || 0}
                              </span>
                              <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', padding: '3px 8px', borderRadius: '6px', color: '#FFFFFF', fontWeight: 700 }}>
                                Negotiation: {leader.negotiationsCount || 0}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Right Column: Sales Funnel Conversion Chart */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
          <SalesFunnelChart
            sseData={sseData}
            leads={leads}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </div>
      </div>

      {/* Floating Interactive Tooltip overlay */}
      {tooltip && tooltip.y != null && (
        <div style={{
          position: 'fixed',
          top: (tooltip.y + (tooltip.items ? tooltip.items.length * 26 + 90 : 220)) > window.innerHeight
            ? Math.max(10, tooltip.y - (tooltip.items ? tooltip.items.length * 26 + 90 : 220))
            : tooltip.y + 14,
          left: Math.min(tooltip.x + 14, window.innerWidth - 300),
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          zIndex: 1000,
          background: 'rgba(8, 14, 22, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(49, 151, 149, 0.4)',
          borderRadius: '10px',
          padding: '12px 16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.7), 0 0 15px rgba(0, 212, 170, 0.25)',
          pointerEvents: 'none',
          minWidth: '220px'
        }}>
          <div style={{ fontFamily: "'Helvetica'", fontSize: '14.5px', fontWeight: 800, color: '#FFFFFF' }}>
            {tooltip.title}
          </div>
          {tooltip.subtitle && (
            <div style={{ fontSize: '11px', fontFamily: "'Inter', sans-serif", color: '#8CA0B8', marginBottom: '8px' }}>
              {tooltip.subtitle}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {tooltip.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px', fontFamily: "'Inter', sans-serif" }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#CBD5E1', fontWeight: 700 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color || '#00D4AA', boxShadow: `0 0 6px ${item.color || '#00D4AA'}` }} />
                    {item.label}
                  </span>
                  {!item.valueShare && (
                    <span style={{ fontWeight: 800, color: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>
                      {item.value}
                    </span>
                  )}
                </div>
                {item.valueShare && item.countShare && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '14px', borderLeft: '2px solid rgba(255,255,255,0.1)', marginLeft: '3px' }}>
                    <div style={{ fontSize: '11.5px', color: '#E2E8F0' }}>
                      <span style={{ color: '#94A3B8', fontWeight: 500 }}>Value Share: </span>
                      <span style={{ fontWeight: 700, color: '#FFFFFF' }}>{item.valueShare}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#E2E8F0' }}>
                      <span style={{ color: '#94A3B8', fontWeight: 500 }}>Deal Count Share: </span>
                      <span style={{ fontWeight: 700, color: '#FFFFFF' }}>{item.countShare}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drill-Down Slide-Out Drawer */}
      <DashboardDrillDownDrawer
        isOpen={Boolean(selectedDrillDownKpi)}
        kpi={selectedDrillDownKpi}
        onClose={() => setSelectedDrillDownKpi(null)}
        onNavigateToLeads={onNavigateToLeads}
        onOpenLeadDetails={onOpenLeadDetails}
        dashboardSummary={isExecUser ? summary : (activeLeaderRecord || summary)}
        allLeads={leads}
        wonLeads={wonLeads}
      />

    </div>
  );
}
