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
