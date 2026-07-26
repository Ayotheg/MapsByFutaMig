import { useSeo } from '../../lib/useSeo'
import LegalPageLayout from './LegalPageLayout'
import './legal.css'

const CONTACT_EMAIL = 'gearlifycorporation@gmail.com'

function TermsOfService() {
  useSeo({ title: 'Terms of Service – Maps By FUTA', robots: 'index, follow' })

  return (
    <LegalPageLayout title="Terms of Service" updated="July 2026">
      <p>
        These Terms of Service ("Terms") govern your use of Maps By FUTA
        (the "Service"), an independent, community-built campus navigation
        web app for the Federal University of Technology, Akure ("FUTA").
        By using the Service, you agree to these Terms.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Maps By FUTA is designed, developed, and maintained by an
        independent team of student developers. We are not an official
        department, unit, or agency of the University, and the Service is
        not officially endorsed by FUTA's administration — it's a
        student-built tool made for the FUTA community.
      </p>

      <h2>2. Ownership of the Service</h2>
      <p>
        Maps By FUTA — including its source code, interface design, brand
        name, logo, color and typography system, and the app's overall
        "look and feel" — was built entirely by our team and is our
        intellectual property. Except for the third-party and open-data
        components credited in Section 3 below, every part of the Service
        belongs to us.
      </p>

      <h2>3. Map data, open-source credit, and our own contributions</h2>
      <p>
        Maps By FUTA is built on top of <strong>OpenStreetMap (OSM)</strong>,
        an open, collaboratively-maintained map of the world, and routes
        walking/driving directions using <strong>OSRM</strong>, an
        open-source routing engine built on OSM data. We're genuinely
        grateful to the OpenStreetMap contributor community — their base
        map layout and geographic data made this project possible, and
        that underlying map data remains the property of OpenStreetMap and
        its contributors, made available under the Open Database License
        (ODbL).
      </p>
      <p>
        On top of that open base map, our team has separately and
        manually surveyed FUTA's campus ourselves — walking the campus to
        record our own waypoints, place categorizations, and named
        campus paths/segments. While OpenStreetMap's overall dataset is
        naturally larger than what any one project can build on its own,
        the specific campus place data, categorization, and curation
        featured on Maps By FUTA reflect our own independent fieldwork,
        and we maintain and update it ourselves through our admin
        tooling.
      </p>

      <h2>4. Photographs</h2>
      <p>
        Every photograph of a campus building or location shown on Maps
        By FUTA was taken by our team, on-site, ourselves. OpenStreetMap
        does not provide these photos — they are original work.{' '}
        <strong>
          All photographs on the Service remain our intellectual property,
          and any use of them elsewhere must credit Maps By FUTA.
        </strong>
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Scrape, copy, or republish our original photographs, place data, or curated content without permission or credit.</li>
        <li>Submit false, misleading, or abusive reviews or ratings.</li>
        <li>Attempt to interfere with, disrupt, or gain unauthorized access to the Service, its admin tools, or its underlying data.</li>
        <li>Use the Service for any unlawful purpose.</li>
      </ul>

      <h2>6. User-submitted content</h2>
      <p>
        Reviews and ratings you submit remain associated with your
        account and may be shown publicly on relevant place listings. You're
        responsible for what you post, and we may remove content that
        violates these Terms.
      </p>

      <h2>7. No warranty</h2>
      <p>
        Maps By FUTA is provided "as is." Routes, distances, and
        directions are generated using open routing data and may not
        always be perfectly accurate — always use good judgment,
        especially near roads, construction, or restricted areas.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these Terms as the Service evolves. Continued use
        after changes means you accept the updated Terms.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these Terms? Reach us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPageLayout>
  )
}

export default TermsOfService
