import { useAuth } from '../contexts/AuthContext'
import { signUpRequest } from '../authConfig'

// Reusable tier cards + footnote, shared by /pricing and the Home landing. Modernist token
// styling per DESIGN.md — light-only, --primary accent, 2px borders, radius 0, no emoji.
// School pricing is deliberately "TBC" until finalised. No billing is wired yet, so the paid
// CTAs route teachers into the normal free sign-up; School routes to email.
// ponytail: static presentational — tier data lives here once, both pages render it.

const SUPPORT_EMAIL = 'admin@quizpulse.app'

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    priceSub: 'Always free',
    positioning: 'Everything you need to run the loop.',
    cta: 'Start free',
    features: [
      'Send unlimited quizzes to your classes',
      'See results live as students answer',
      'Confidence and misconception insight on every quiz',
      'A guided demo class to try it all out',
      '3 AI-built quizzes a day',
    ],
  },
  {
    name: 'Pro',
    price: '$12',
    priceSub: 'per month · or $99 / year · AUD',
    positioning: 'For the individual teacher who lives in the data.',
    cta: 'Start free',
    featured: true,
    featuresLead: 'Everything in Free, plus',
    features: [
      'Unlimited AI-built quizzes',
      'Your complete results history, not just recent',
      'See how your class compares to the wider cohort',
      'Combine results across a class’s quizzes',
      'Export results to a spreadsheet',
      'Spaced practice and misconception follow-ups',
      'Registration evidence records (APST / VIT) — PDF and annual log',
      'Higher limits across classes, questions and quizzes',
    ],
  },
  {
    name: 'School',
    price: 'TBC',
    priceSub: 'Pricing being finalised',
    positioning: 'For a whole staff, on one plan.',
    cta: 'Get in touch',
    featuresLead: 'Everything in Pro, plus',
    features: [
      'Pro for every teacher on staff',
      'Invite your whole staff with a link',
      'School-admin roles and oversight',
      'A single invoice for the school',
    ],
  },
]

function Check() {
  return (
    <span aria-hidden="true" style={{ color: 'var(--primary)', fontWeight: 700, flexShrink: 0, lineHeight: '1.5' }}>✓</span>
  )
}

export default function PricingTiers() {
  const { login } = useAuth()

  function handleCta(tier) {
    if (tier.name === 'School') {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=QuizPulse for our school`
      return
    }
    // Free + Pro: no billing yet — send teachers into the normal free sign-up.
    login(signUpRequest)
  }

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        alignItems: 'start',
      }}>
        {TIERS.map((tier) => {
          const accent = tier.featured
          return (
            <div
              key={tier.name}
              data-testid={`tier-${tier.name.toLowerCase()}`}
              style={{
                position: 'relative',
                background: 'var(--surface)',
                border: `var(--bw) solid ${accent ? 'var(--primary)' : 'var(--border)'}`,
                padding: '30px 26px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {accent && (
                <span style={{
                  position: 'absolute', top: -1, right: -1,
                  background: 'var(--primary)', color: 'var(--primaryInk)',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                  padding: '5px 10px',
                }}>
                  Most popular
                </span>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text)' }}>
                {tier.name}
              </div>

              <div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  {tier.price}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{tier.priceSub}</div>
              </div>

              <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, lineHeight: 1.5, minHeight: 42 }}>
                {tier.positioning}
              </p>

              <button
                onClick={() => handleCta(tier)}
                className={accent ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ width: '100%' }}
              >
                {tier.cta}
              </button>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 2 }}>
                {tier.featuresLead && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {tier.featuresLead}
                  </div>
                )}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tier.features.map((f) => (
                    <li key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                      <Check />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 36, lineHeight: 1.6 }}>
        Prices in AUD. School pricing is being finalised — <a href={`mailto:${SUPPORT_EMAIL}?subject=QuizPulse for our school`} style={{ color: 'var(--primary)', fontWeight: 600 }}>get in touch</a> and
        we’ll sort a plan for your staff.
      </p>
    </>
  )
}
