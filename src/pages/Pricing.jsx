import PricingTiers from '../components/PricingTiers'

// Dedicated public tier-information page. The cards themselves live in <PricingTiers/> so Home
// and /pricing render the same thing. ponytail: static — just a heading over the shared cards.
export default function Pricing() {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 24px 72px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--primary)', marginBottom: 12,
        }}>
          Plans
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 800, color: 'var(--text)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Simple plans for every teacher
        </h1>
        <p style={{ fontSize: 17, color: 'var(--muted)', maxWidth: 540, margin: '0 auto', lineHeight: 1.6 }}>
          The whole check-in loop is free. Pay only when you want your full history, deeper insight,
          and registration evidence.
        </p>
      </div>

      <PricingTiers />
    </div>
  )
}
