// Curated pool of plausible first+last name pairs for simulated demo classes (v3.3.0).
//
// A demo class lets a teacher explore the full Send → Analytics loop without recruiting real
// students. When a demo class is created, selectDemoStudents() shuffles this pool and takes 24
// distinct names, each assigned a fresh device UUID. These names are NEVER shown to or matched
// against real students — they exist only to populate simulated responses (api/shared/runSimulation.js).
//
// Curated text only (CLAUDE.md non-negotiable): this list is human-authored, deliberately generic
// and culturally varied, with no real-person references. Keep it that way — no AI-generated or
// user-submitted entries.

const crypto = require('crypto');

// The one canonical demo-class roster size. Imported by classes.js (POST /api/classes demo branch)
// and shared/firstRun.js so the number can't drift between the two demo-class creation paths.
const DEMO_STUDENT_COUNT = 24;

const DEMO_NAMES = [
  'Ava Thompson', 'Liam Nguyen', 'Sophia Patel', 'Noah Williams', 'Isabella Garcia',
  'Ethan Chen', 'Mia Johnson', 'Lucas Martin', 'Charlotte Lee', 'Mason Brown',
  'Amelia Wilson', 'Oliver Davis', 'Harper Singh', 'Elijah Taylor', 'Evelyn Moore',
  'James Anderson', 'Abigail Thomas', 'Benjamin White', 'Emily Jackson', 'Henry Harris',
  'Ella Martinez', 'Alexander Clark', 'Scarlett Lewis', 'Daniel Walker', 'Grace Hall',
  'Matthew Allen', 'Chloe Young', 'Sebastian King', 'Zoe Wright', 'Jack Scott',
  'Lily Green', 'Owen Adams', 'Hannah Baker', 'Samuel Nelson', 'Aria Carter',
  'David Mitchell', 'Layla Perez', 'Joseph Roberts', 'Nora Turner', 'Leo Phillips',
  'Hazel Campbell', 'Gabriel Parker', 'Violet Evans', 'Julian Edwards', 'Aurora Collins',
  'Wyatt Stewart', 'Stella Sanchez', 'Levi Morris', 'Penelope Rogers', 'Isaac Reed',
  'Maya Cook', 'Anthony Morgan', 'Willow Bell', 'Andrew Murphy', 'Ruby Bailey',
  'Joshua Rivera', 'Eleanor Cooper', 'Christopher Richardson', 'Naomi Cox', 'Dylan Howard',
  'Savannah Ward', 'Nathan Torres', 'Audrey Peterson', 'Aaron Gray', 'Bella Ramirez',
  'Caleb James', 'Claire Watson', 'Adrian Brooks', 'Lucy Kelly', 'Hunter Sanders',
  'Eva Price', 'Connor Bennett', 'Sadie Wood', 'Eli Barnes', 'Genesis Ross',
  'Asher Henderson', 'Skylar Coleman', 'Theodore Jenkins', 'Paisley Perry', 'Miles Powell',
];

// Selects 24 distinct demo students for a new demo class. Each call shuffles the pool
// (Fisher–Yates) and takes the first 24, assigning each a fresh device UUID so the studentId
// shape matches real students (quizpulse_device_id UUIDs). Returns
// [{ studentId, name }, ...] — never the same name twice within one class.
function selectDemoStudents(count = DEMO_STUDENT_COUNT) {
  const pool = DEMO_NAMES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).map(name => ({ studentId: crypto.randomUUID(), name }));
}

module.exports = { DEMO_NAMES, DEMO_STUDENT_COUNT, selectDemoStudents };
