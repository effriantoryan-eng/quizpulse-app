// Copy + destination route for each of the nine feature-intro cards. Curated text only, per
// CLAUDE.md's Companion Layer non-negotiables (extended here to every intro card, not just the
// creature layer) — plain language, no jargon. See CEO review addendum §6.7.
const FEATURE_INTRO_CONTENT = {
  demo_intro: {
    headline: 'Try QuizPulse with a practice class',
    line: 'Send a quiz to 24 simulated students and see real results — no setup needed.',
    route: '/teacher/classes',
  },
  analytics_intro: {
    headline: 'Your first quiz results are in',
    line: 'See how your class answered — question by question.',
    route: '/teacher/results',
  },
  community_intro: {
    headline: 'Need question ideas?',
    line: 'Browse questions other teachers have shared — copy any into your bank.',
    route: '/teacher/bank',
  },
  misconception_intro: {
    headline: 'Spot confident mistakes',
    line: 'See which questions students got wrong while feeling sure — the best place to reteach.',
    route: '/teacher/results',
  },
  population_intro: {
    headline: 'How does your class compare?',
    line: 'See your results next to other classes on the same topic.',
    route: '/teacher/population',
  },
  apst_intro: {
    headline: 'Turn your quizzes into registration evidence',
    line: "Export what you've already done as evidence toward full registration.",
    route: '/teacher/evidence',
  },
  mypd_intro: {
    headline: 'Your teaching log, written for you',
    line: 'A yearly summary of your quiz practice — ready for your PD records.',
    route: '/teacher/evidence',
  },
  ai_generation_intro: {
    headline: 'Turn your notes into a quiz',
    line: 'Upload a document and get a draft quiz to review — you approve every question.',
    route: '/teacher/generate',
  },
}

export default FEATURE_INTRO_CONTENT
