// Client-side legal document content + versions. The VERSIONS here must match
// api/shared/legalVersions.js exactly (same client/server duplication convention as
// apstContent.js / topicTags.js — the server validates the version a client sends, the client
// owns the rendered text).
//
// NO LEGAL WORDING IS WRITTEN BY THE BUILD. Every text field below is the literal marker
// LEGAL_PENDING until the reviewer supplies approved wording. `grep -r "LEGAL TEXT PENDING" src/`
// returning anything blocks the rc1 tag (see the sprint Gate). isLegalPending() lets the UI
// refuse to render a placeholder as if it were real text, and refuse to record acceptance of a
// document that has none — acceptance of a placeholder must be impossible by construction, not
// just caught by a CI grep (design review finding 1).

export const LEGAL_PENDING = '[LEGAL TEXT PENDING]'

// Keep in sync with api/shared/legalVersions.js.
export const TERMS_VERSION = null // ponytail: null until legal wording is finalised — termsCurrent always true
export const COLLECTION_NOTICE_VERSION = '2026-09-18'
export const ATTESTATION_VERSION = '2026-09-18'

// A section, a short-text doc, or a whole document is "pending" if any user-facing string in it is
// still the placeholder marker. Used to gate rendering and to disable every accept action.
export function isLegalPending(doc) {
  if (!doc) return true
  if (typeof doc.text === 'string') {
    if (doc.text === LEGAL_PENDING || doc.text.trim() === '') return true
  }
  if (Array.isArray(doc.sections)) {
    if (doc.sections.length === 0) return true
    for (const s of doc.sections) {
      if (!s || s.heading === LEGAL_PENDING || s.body === LEGAL_PENDING) return true
    }
  }
  return false
}

// Full documents rendered by src/pages/LegalPage.jsx. sections stay as the placeholder marker
// until the reviewer supplies real headings + bodies.
export const PRIVACY_POLICY = {
  version: '2026-09-18',
  updated: '2026-09-18',
  title: 'Privacy Policy',
  sections: [{ heading: LEGAL_PENDING, body: LEGAL_PENDING }],
}

export const COLLECTION_NOTICE = {
  version: COLLECTION_NOTICE_VERSION,
  updated: '2026-09-18',
  title: 'Collection Notice',
  sections: [{ heading: LEGAL_PENDING, body: LEGAL_PENDING }],
}

export const TERMS = {
  version: TERMS_VERSION,
  updated: '2026-09-18',
  title: 'Terms of Use',
  sections: [{ heading: LEGAL_PENDING, body: LEGAL_PENDING }],
}

// Short strings shown inline (not on their own page).
// JOIN_NOTICE_SHORT: ≤2 sentences on the /join form (child-facing — plain words, no jargon).
export const JOIN_NOTICE_SHORT = {
  version: COLLECTION_NOTICE_VERSION,
  text: LEGAL_PENDING,
}

// CLASS_ATTESTATION: the teacher's checkbox label at class creation.
export const CLASS_ATTESTATION = {
  version: ATTESTATION_VERSION,
  text: LEGAL_PENDING,
}
