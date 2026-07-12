import { useNavigate } from 'react-router-dom'
import ProfileWizardSteps from '../components/onboarding/ProfileWizardSteps'

// /onboarding/profile — the ProfileNudge follow-up route for a teacher who already finished
// step 1 (or skipped steps 2-5 entirely) and is coming back later to answer them.
function OnboardingProfile() {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '44px 32px', textAlign: 'center', background: 'var(--surface)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'var(--logoGrad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '26px', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--shadowField)' }}>⚡</div>
      <ProfileWizardSteps startStepNumber={2} onDone={() => navigate('/teacher/home', { replace: true })} />
    </div>
  )
}

export default OnboardingProfile
