import { useSeo } from '../../lib/useSeo'
import LegalPageLayout from './LegalPageLayout'
import './legal.css'

const CONTACT_EMAIL = 'gearlifycorporation@gmail.com'

function CookiePolicy() {
  useSeo({ title: 'Cookie Policy – Maps By FUTA', robots: 'index, follow' })

  return (
    <LegalPageLayout title="Cookie Policy" updated="July 2026">
      <p>
        This Cookie Policy explains how Maps By FUTA uses cookies and
        similar browser storage technologies.
      </p>

      <h2>1. What we use</h2>
      <p><strong>Essential storage:</strong> We use cookies/local storage to keep
        you signed in, remember your session, and store lightweight
        preferences (like your last map view or view-mode toggle) so the
        Service works smoothly between visits.</p>
      <p><strong>Analytics:</strong> We store two small identifiers in your
        browser to power this: one in local storage that persists across
        visits (so repeat visits from the same browser count as one
        visitor, not several), and one in session storage that's cleared
        when you close the tab (used to group activity within a single
        visit). Neither is a long-lived cross-site advertising cookie, and
        neither is shared with ad networks or other sites — it's used
        only within Maps By FUTA.</p>

      <h2>2. What we don't use</h2>
      <p>
        We don't use third-party advertising cookies, and we don't sell
        cookie or usage data to advertisers.
      </p>

      <h2>3. Managing cookies</h2>
      <p>
        Most browsers let you view, block, or delete cookies and local
        storage through their settings. Blocking essential storage may
        sign you out or reset preferences, but the core map and
        navigation features will still work.
      </p>

      <h2>4. Changes to this policy</h2>
      <p>
        We may update this policy as the Service changes. Check back here
        for the latest version.
      </p>

      <h2>5. Contact</h2>
      <p>
        Questions about cookies on Maps By FUTA? Email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPageLayout>
  )
}

export default CookiePolicy