import { useNavigate } from 'react-router-dom'
import ProfileWizardSteps from '../components/onboarding/ProfileWizardSteps'
import BrandMark from '../components/BrandMark'

// /onboarding/profile — the ProfileNudge follow-up route for a teacher who already finished
// step 1 (or skipped steps 2-5 entirely) and is coming back later to answer them.
function OnboardingProfile() {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '44px 32px', textAlign: 'center', background: 'var(--surface)', border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 20px' }}><BrandMark size={52} /></div>
      <ProfileWizardSteps startStepNumber={2} onDone={() => navigate('/teacher/home', { replace: true })} />
    </div>
  )
}

export default OnboardingProfile
