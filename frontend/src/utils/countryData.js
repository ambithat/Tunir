// src/utils/countryData.js
import worldCountries from 'world-countries';

/**
 * Standardized, sorted list of all world countries from 'world-countries' package
 */
export const ALL_COUNTRIES = worldCountries
  .map(c => ({
    value: c.name.common,
    label: `${c.flag ? c.flag + '  ' : ''}${c.name.common}`,
    name: c.name.common,
    officialName: c.name.official,
    code: c.cca2,
    cca3: c.cca3,
    flag: c.flag || ''
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Common / priority countries placed at top of selector if desired
 */
export const PRIORITY_COUNTRIES = [
  'India',
  'United Arab Emirates',
  'Saudi Arabia',
  'United States',
  'United Kingdom',
  'Singapore',
  'Germany',
  'Australia',
  'Canada',
  'Qatar',
  'Oman',
  'Kuwait',
  'Bahrain'
];

/**
 * Formatted country options with common countries first, followed by divider and alphabetical list
 */
export const COUNTRY_OPTIONS = [
  ...ALL_COUNTRIES.filter(c => PRIORITY_COUNTRIES.includes(c.name)),
  ...ALL_COUNTRIES.filter(c => !PRIORITY_COUNTRIES.includes(c.name))
];

/**
 * Helper to get country flag or fallback
 */
export function getCountryFlag(countryName) {
  if (!countryName) return '';
  const match = ALL_COUNTRIES.find(
    c => c.name.toLowerCase() === String(countryName).trim().toLowerCase() ||
      c.code.toLowerCase() === String(countryName).trim().toLowerCase() ||
      c.cca3.toLowerCase() === String(countryName).trim().toLowerCase()
  );
  return match?.flag || '';
}

/**
 * Helper to get formatted display name (Flag + Country Name)
 */
export function formatCountryDisplay(countryName) {
  if (!countryName) return '—';
  const flag = getCountryFlag(countryName);
  return flag ? `${flag}  ${countryName}` : countryName;
}

/**
 * Returns phone digit rules (minDigits, maxDigits, label) dynamically based on country
 */
export function getPhoneRulesForCountry(countryName = 'India') {
  if (!countryName) return { minDigits: 7, maxDigits: 15, label: '7-15 digits' };

  const c = String(countryName).trim().toLowerCase();

  if (c === 'india' || c === 'in') {
    return { minDigits: 10, maxDigits: 10, label: '10 digits' };
  }
  if (c === 'united states' || c === 'canada' || c === 'us' || c === 'ca' || c === 'usa') {
    return { minDigits: 10, maxDigits: 10, label: '10 digits' };
  }
  if (c === 'united arab emirates' || c === 'uae' || c === 'ae') {
    return { minDigits: 9, maxDigits: 9, label: '9 digits' };
  }
  if (c === 'saudi arabia' || c === 'sa') {
    return { minDigits: 9, maxDigits: 9, label: '9 digits' };
  }
  if (c === 'singapore' || c === 'sg' || c === 'qatar' || c === 'qa' || c === 'oman' || c === 'om' || c === 'kuwait' || c === 'kw' || c === 'bahrain' || c === 'bh') {
    return { minDigits: 8, maxDigits: 8, label: '8 digits' };
  }
  if (c === 'china' || c === 'cn') {
    return { minDigits: 11, maxDigits: 11, label: '11 digits' };
  }
  if (c === 'united kingdom' || c === 'uk' || c === 'gb' || c === 'great britain') {
    return { minDigits: 10, maxDigits: 11, label: '10-11 digits' };
  }
  if (c === 'australia' || c === 'au') {
    return { minDigits: 9, maxDigits: 10, label: '9-10 digits' };
  }
  if (c === 'germany' || c === 'de' || c === 'japan' || c === 'jp' || c === 'brazil' || c === 'br') {
    return { minDigits: 10, maxDigits: 11, label: '10-11 digits' };
  }
  if (c === 'france' || c === 'fr' || c === 'malaysia' || c === 'my' || c === 'south africa' || c === 'za') {
    return { minDigits: 9, maxDigits: 10, label: '9-10 digits' };
  }

  // Default fallback for any other country
  return { minDigits: 7, maxDigits: 15, label: '7-15 digits' };
}

/**
 * Validates a phone number against country-specific rules.
 * Returns error string if invalid, or null if valid.
 */
export function validatePhoneNumber(phone, countryName = 'India', fieldName = 'Phone number') {
  if (!phone || !String(phone).trim()) return null; // empty is allowed if field is optional

  const trimmed = String(phone).trim();

  // Alphabetic characters check
  if (/[a-zA-Z]/.test(trimmed)) {
    return `${fieldName} cannot contain letters or character values.`;
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  const rules = getPhoneRulesForCountry(countryName);

  if (rules.minDigits === rules.maxDigits) {
    if (digitsOnly.length !== rules.minDigits) {
      return `${fieldName} for ${countryName || 'selected country'} must be exactly ${rules.minDigits} digits (entered ${digitsOnly.length} digits).`;
    }
  } else {
    if (digitsOnly.length < rules.minDigits || digitsOnly.length > rules.maxDigits) {
      return `${fieldName} for ${countryName || 'selected country'} must be between ${rules.minDigits} and ${rules.maxDigits} digits (entered ${digitsOnly.length} digits).`;
    }
  }

  return null;
}

export default ALL_COUNTRIES;
