import Nav from '@/components/layout/Nav'
import Hero from '@/components/sections/Hero'
import TrustBar from '@/components/sections/TrustBar'
import Problem from '@/components/sections/Problem'
import Solution from '@/components/sections/Solution'
import HowItWorks from '@/components/sections/HowItWorks'
import Proof from '@/components/sections/Proof'
import ComingSoon from '@/components/sections/ComingSoon'
import FinalCTA from '@/components/sections/FinalCTA'
import Footer from '@/components/layout/Footer'

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <TrustBar />
      <Problem />
      <Solution />
      <HowItWorks />
      <Proof />
      <ComingSoon />
      <FinalCTA />
      <Footer />
    </main>
  )
}