// Pure helper functions for the v4.1.0 Evidence export — kept logic-free-data-module-free so
// they're trivially unit-testable without spinning up Cosmos or pdfkit.

const { PERSONALISE_MARKER } = require('./apstContent');

const HOURS_PER_QUIZ = 0.6; // setup ~15min + review ~20min, per the research brief's MyPD table

// Rounds to 1 decimal to avoid floating-point noise (e.g. 3 * 0.6 !== 1.8 in raw JS).
function calculateHours(quizCount) {
  return Math.round(quizCount * HOURS_PER_QUIZ * 10) / 10;
}

// True when the reflection still contains the literal, unpersonalised template marker.
function containsUnpersonalisedMarker(text) {
  return typeof text === 'string' && text.includes(PERSONALISE_MARKER);
}

const MAX_ANNUAL_LOG_RANGE_DAYS = 365;

// Validates an annual-log date range. Returns { valid: true } or { valid: false, error }.
function validateDateRange(fromStr, toStr) {
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return { valid: false, error: 'from and to must be valid dates' };
  }
  if (from.getTime() >= to.getTime()) {
    return { valid: false, error: 'from must be before to' };
  }
  const rangeDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (rangeDays > MAX_ANNUAL_LOG_RANGE_DAYS) {
    return { valid: false, error: `Date range must be ${MAX_ANNUAL_LOG_RANGE_DAYS} days or fewer` };
  }
  return { valid: true };
}

module.exports = { calculateHours, containsUnpersonalisedMarker, validateDateRange, HOURS_PER_QUIZ, MAX_ANNUAL_LOG_RANGE_DAYS };
