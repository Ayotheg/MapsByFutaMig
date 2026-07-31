import './landing/landing.css'
import { useSeo } from '../lib/useSeo'
import Nav from './landing/Nav'
import Hero from './landing/Hero'
import TrustBar from './landing/TrustBar'
import ProductFeatures from './landing/ProductFeatures'
import VideoSection from './landing/VideoSection'
import ExploreSection from './landing/ExploreSection'
import FinalCTA from './landing/FinalCTA'
import FAQ from './landing/FAQ'
import Footer from './landing/Footer'

function LandingPage() {
  // Matches the static <title>/meta robots already baked into
  // index.html for first paint & crawlers — this just restores them if
  // the person navigates back to "/" client-side after visiting /map.
  useSeo({
    title: 'Maps By FUTA – Campus Map & Navigation for Federal University of Technology, Akure',
    robots: 'index, follow',
  });

  return (
    <>
      {/* Slice 11 QA fix: .hero-fade/.reveal/.reveal-scale (landing.css)
          default to opacity:0 and only reach their visible end state via
          a JS-driven IntersectionObserver (useReveal in landingHooks.js)
          adding a .visible class. That's fine when JS runs, but with
          scripting off entirely (not just prefers-reduced-motion — real
          no-JS browsing) nothing ever adds .visible and every section
          stays invisible forever, which is exactly what Slice 10's own
          acceptance check called out as unacceptable. This forces the
          end state when scripting is disabled, without touching the
          normal JS-enabled animation path at all. */}
      <noscript>
        <style>{`.hero-fade, .reveal, .reveal-scale { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>
      <Nav />
      <Hero />
      <TrustBar />
      <ProductFeatures />
      <VideoSection />
      <ExploreSection />
      <FinalCTA />
      <FAQ />
      <Footer />
    </>
  )
}

export default LandingPage
