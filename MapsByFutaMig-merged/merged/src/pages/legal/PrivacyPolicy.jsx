import { useSeo } from '../../lib/useSeo'
import LegalPageLayout from './LegalPageLayout'
import './legal.css'

const CONTACT_EMAIL = 'gearlifycorporation@gmail.com'

function PrivacyPolicy() {
  useSeo({ title: 'Privacy Policy – Maps By FUTA', robots: 'index, follow' })

  return (
    <LegalPageLayout title="Privacy Policy" updated="July 2026">
      <p>
        This Privacy Policy explains what information Maps By FUTA
        collects, why, and how it's handled. We built this Service for
        the FUTA community and try to collect only what we need to make
        navigation work well.
      </p>

      <h2>1. Information we collect</h2>
      <p><strong>Location data:</strong> to show your position on the map, give
        you turn-by-turn directions, and find what's nearby, the Service
        requests access to your device's GPS location. This is only used
        live, in your browser, to power navigation — it's not something
        we sell or hand to advertisers.</p>
      <p><strong>Account information:</strong> if you sign in, we store the
        basic profile details needed to attach your reviews and ratings
        to your account.</p>
      <p><strong>Reviews and ratings:</strong> any review, rating, or comment
        you submit on a place is stored and may be shown publicly on that
        place's listing.</p>
      <p><strong>Usage analytics:</strong> we track how the Service is used so
        we can see what's working and fix what isn't. For anonymous
        visitors, this stays aggregate and non-identifying — a rotating
        identifier stored in your browser lets us count you as one visitor
        instead of many, without attaching a name or email to it. If you're
        signed in, it's different: your activity in the app (which features
        you use, what you search for, where you navigate) is associated
        with your account rather than kept anonymous, the same way your
        reviews already are. We also run a live "who's currently active"
        view for admins — while you're signed in and using the Service,
        an admin can see what you're doing right now (for example, that
        you're searching or navigating to a place), in real time. This
        stops the moment you close the tab or sign out.</p>

      <h2>2. How we use this information</h2>
      <ul>
        <li>To power live navigation, search, and "what's nearby" features.</li>
        <li>To attribute reviews/ratings to your account and show review counts.</li>
        <li>To improve the accuracy and coverage of the campus map over time.</li>
        <li>To understand overall usage of the Service so we can improve it.</li>
      </ul>

      <h2>3. What we don't do</h2>
      <p>
        We do not sell your personal data. We do not share your precise
        location history with third parties for advertising purposes.
      </p>

      <h2>4. Third-party services</h2>
      <p>
        The Service relies on a few outside services to work: OSRM and OpenStreetMap map data.
        Each of these may process technical data (like route coordinates)
        as part of delivering the feature — they don't receive your
        personal profile information.
      </p>

      <h2>5. Data retention</h2>
      <p>
        Account data and submitted reviews are kept for as long as your
        account is active. You can request deletion of your account and
        associated data at any time by contacting us.
      </p>

      <h2>6. Your choices</h2>
      <p>
        You can deny or revoke location permission at any time in your
        browser/device settings — some navigation features simply won't
        work without it. You can also request access to, correction of,
        or deletion of your data by reaching out below.
      </p>

      <h2>7. Children's privacy</h2>
      <p>
        The Service is intended for university students, staff, and
        visitors and is not directed at children.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about your data or this policy? Email us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPageLayout>
  )
}

export default PrivacyPolicy