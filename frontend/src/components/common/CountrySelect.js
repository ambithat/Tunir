// src/components/common/CountrySelect.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FiSearch, FiChevronDown, FiGlobe, FiCheck, FiX } from 'react-icons/fi';
import { COUNTRY_OPTIONS, getCountryFlag } from '../../utils/countryData';

/**
 * Reusable Searchable Country Select Dropdown
 * Displays national flags, supports live search by country name or ISO code,
 * and handles smart auto-placement (upward/downward) to prevent clipping.
 */
export default function CountrySelect({
  value = 'India',
  onChange,
  placeholder = 'Select Country...',
  height = '42px',
  disabled = false,
  placement = 'auto' // 'auto' | 'top' | 'bottom'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Determine opening direction
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (placement === 'top') {
        setOpenUpwards(true);
      } else if (placement === 'bottom') {
        setOpenUpwards(false);
      } else {
        // Auto detection: check space below button in viewport
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 250 && spaceAbove > 200) {
          setOpenUpwards(true);
        } else {
          setOpenUpwards(false);
        }
      }

      // Auto-focus search input when opened
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
    }
  }, [isOpen, placement]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Current selected country metadata
  const selectedCountry = useMemo(() => {
    if (!value) return null;
    return (
      COUNTRY_OPTIONS.find(
        c =>
          c.name.toLowerCase() === String(value).trim().toLowerCase() ||
          c.code.toLowerCase() === String(value).trim().toLowerCase()
      ) || {
        name: value,
        label: `${getCountryFlag(value) ? getCountryFlag(value) + '  ' : ''}${value}`,
        code: ''
      }
    );
  }, [value]);

  // Filter countries by search query (supports name, code, official name)
  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.officialName && c.officialName.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const handleSelect = (countryName) => {
    if (onChange) onChange(countryName);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        style={{
          width: '100%',
          height: height,
          padding: '0 14px',
          borderRadius: '8px',
          border: isOpen ? '1px solid var(--t-teal, #00D4AA)' : '1px solid var(--t-border, rgba(49, 151, 149, 0.35))',
          background: disabled ? 'var(--t-surface-alt, rgba(5, 8, 14, 0.6))' : 'var(--t-surface-solid, rgba(5, 8, 14, 0.95))',
          color: selectedCountry ? 'var(--t-fg, #FFFFFF)' : 'var(--t-fg-muted, #64748B)',
          fontSize: '13.5px',
          fontFamily: "'Inter', sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 14px rgba(0, 212, 170, 0.25)' : 'none',
          transition: 'all 0.16s ease',
          boxSizing: 'border-box',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: selectedCountry ? 'var(--t-fg, #FFFFFF)' : 'var(--t-fg-muted, #64748B)',
              fontWeight: selectedCountry ? 600 : 400
            }}
          >
            {selectedCountry ? selectedCountry.label : placeholder}
          </span>
          {selectedCountry?.code && (
            <span
              style={{
                fontSize: '10.5px',
                fontFamily: "'Helvetica'",
                color: 'var(--t-fg-subtle, #8CA0B8)',
                background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.06))',
                border: '1px solid var(--t-border, rgba(255, 255, 255, 0.1))',
                padding: '1px 5px',
                borderRadius: '4px',
                flexShrink: 0
              }}
            >
              {selectedCountry.code}
            </span>
          )}
        </div>

        <FiChevronDown
          style={{
            fontSize: '15px',
            color: isOpen ? 'var(--t-teal, #00D4AA)' : 'var(--t-fg-muted, #8CA0B8)',
            transform: isOpen ? (openUpwards ? 'rotate(0deg)' : 'rotate(180deg)') : (openUpwards ? 'rotate(180deg)' : 'rotate(0deg)'),
            transition: 'transform 0.18s ease',
            flexShrink: 0
          }}
        />
      </button>

      {/* Searchable Dropdown Popup Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            ...(openUpwards
              ? { bottom: 'calc(100% + 5px)', transformOrigin: 'bottom center' }
              : { top: 'calc(100% + 5px)', transformOrigin: 'top center' }),
            left: 0,
            right: 0,
            zIndex: 100050,
            background: 'var(--t-surface-solid, #0a1019)',
            border: '1px solid var(--t-border, rgba(0, 212, 170, 0.4))',
            borderRadius: '10px',
            boxShadow: 'var(--t-card-shadow, 0 20px 45px rgba(0, 0, 0, 0.95))',
            overflow: 'hidden',
            backdropFilter: 'blur(16px)'
          }}
        >
          {/* Top Search Bar */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))',
              background: 'var(--t-surface-alt, rgba(0, 0, 0, 0.4))'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--t-surface-alt, rgba(0, 0, 0, 0.6))',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid var(--t-border, rgba(0, 212, 170, 0.35))',
                height: '32px'
              }}
            >
              <FiSearch style={{ color: 'var(--t-teal, #00D4AA)', fontSize: '13px', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search country by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--t-fg, #FFFFFF)',
                  fontSize: '12.5px',
                  width: '100%',
                  outline: 'none',
                  fontFamily: "'Inter', sans-serif"
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--t-fg-muted, #8CA0B8)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  <FiX style={{ fontSize: '13px' }} />
                </button>
              )}
            </div>
          </div>

          {/* Countries Scroll List */}
          <div
            style={{
              maxHeight: '190px',
              overflowY: 'auto',
              padding: '4px'
            }}
          >
            {filteredCountries.length === 0 ? (
              <div style={{ padding: '16px 12px', color: 'var(--t-fg-muted, #64748B)', fontSize: '12.5px', textAlign: 'center' }}>
                No matching countries found for "{searchQuery}"
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected =
                  String(c.name).toLowerCase() === String(value || '').toLowerCase() ||
                  String(c.code).toLowerCase() === String(value || '').toLowerCase();

                return (
                  <div
                    key={c.code || c.name}
                    onClick={() => handleSelect(c.name)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: isSelected ? 'var(--t-teal-tint, rgba(0, 212, 170, 0.15))' : 'transparent',
                      color: isSelected ? 'var(--t-teal, #00D4AA)' : 'var(--t-fg, #E2E8F0)',
                      fontSize: '13px',
                      fontWeight: isSelected ? 700 : 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--t-row-hover, rgba(255, 255, 255, 0.05))';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                      <span style={{ fontSize: '15px', flexShrink: 0 }}>{c.flag}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontFamily: "'Helvetica'",
                          color: isSelected ? '#00D4AA' : '#8CA0B8',
                          background: isSelected ? 'rgba(0, 212, 170, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}
                      >
                        {c.code}
                      </span>
                      {isSelected && <FiCheck style={{ color: '#00D4AA', fontSize: '14px' }} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
