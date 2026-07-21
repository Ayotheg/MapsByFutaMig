import './landing/landing.css'
import Nav from './landing/Nav'
import Hero from './landing/Hero'
import TrustBar from './landing/TrustBar'
import DiscoverSection from './landing/DiscoverSection'
import ProductFeatures from './landing/ProductFeatures'
import VideoSection from './landing/VideoSection'
import WhySection from './landing/WhySection'
import ExploreSection from './landing/ExploreSection'
import StatsSection from './landing/StatsSection'
import RoadmapSection from './landing/RoadmapSection'
import SupportSection from './landing/SupportSection'
import FinalCTA from './landing/FinalCTA'
import FAQ from './landing/FAQ'
import Footer from './landing/Footer'

function LandingPage() {
  return (
    <>
      <Nav />
      <Hero />
      <TrustBar />
      <DiscoverSection />
      <ProductFeatures />
      <VideoSection />
      <WhySection />
      <ExploreSection />
      <StatsSection />
      <RoadmapSection />
      <SupportSection />
      <FinalCTA />
      <FAQ />
      <Footer />
    </>
  )
}

export default LandingPage
