import Nav from '@/components/layout/Nav'
import HomeHero from '@/components/home/HomeHero'
import Commission from '@/components/home/Commission'
import Products from '@/components/home/Products'
import BrandOwnership from '@/components/home/BrandOwnership'
import HowItStarts from '@/components/home/HowItStarts'
import Pricing from '@/components/home/Pricing'
import FinalCta from '@/components/home/FinalCta'
import Faq from '@/components/home/Faq'
import Footer from '@/components/layout/Footer'
import styles from '@/components/home/home.module.css'

export default function Home() {
  return (
    <main className={styles.page}>
      <Nav />
      <HomeHero />
      <Commission />
      <Products />
      <BrandOwnership />
      <HowItStarts />
      <Pricing />
      <FinalCta />
      <Faq />
      <Footer />
    </main>
  )
}
