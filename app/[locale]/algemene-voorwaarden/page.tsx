import Nav from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'

const headingStyle = {
  fontFamily: 'var(--font-raleway), sans-serif',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.02em',
  color: 'var(--earth)',
  marginBottom: '12px',
  marginTop: '40px',
}

const bodyStyle = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 400,
  fontSize: '15px',
  lineHeight: 1.75,
  color: 'var(--stone)',
  marginBottom: '16px',
}

const listStyle = {
  ...bodyStyle,
  paddingLeft: '24px',
  marginBottom: '16px',
}

const linkStyle = {
  color: 'var(--amber)',
  textDecoration: 'underline',
}

const metaStyle = {
  ...bodyStyle,
  color: 'rgba(156,139,106,0.7)',
  marginBottom: '48px',
}

type Props = {
  params: Promise<{ locale: string }>
}

export default async function AlgemeneVoorwaardenPage({ params }: Props) {
  const { locale } = await params
  const isEn = locale === 'en'

  return (
    <>
      <Nav />
      <main style={{ backgroundColor: 'var(--cream)', minHeight: '100vh' }}>
        <div
          style={{ maxWidth: '800px', margin: '0 auto', padding: 'clamp(80px, 10vw, 120px) clamp(24px, 5vw, 64px) 80px' }}
          className="policy-content"
        >
          <h1
            style={{
              fontFamily: 'var(--font-raleway), sans-serif',
              fontWeight: 900,
              fontSize: '48px',
              letterSpacing: '-0.03em',
              color: 'var(--earth)',
              marginBottom: '8px',
            }}
          >
            {isEn ? 'Terms and Conditions' : 'Algemene Voorwaarden'}
          </h1>
          <p style={metaStyle}>{isEn ? 'Last updated: April 2026' : 'Laatst bijgewerkt: april 2026'}</p>

          {/* Section 1 */}
          <h2 style={headingStyle}>{isEn ? '1. Definitions' : '1. Definities'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'The following terms are used in these terms and conditions:'
              : 'In deze algemene voorwaarden worden de volgende begrippen gehanteerd:'}
          </p>
          <ul style={listStyle}>
            {isEn ? (
              <>
                <li style={{ marginBottom: '8px' }}>
                  <strong>The Tafel</strong>: the company operating the thetafel.nl platform,
                  registered with the Chamber of Commerce under number KVK 42027611.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Restaurant</strong>: the hospitality entrepreneur or restaurant owner who uses
                  The Tafel platform.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>User</strong>: any person who visits thetafel.nl or uses The Tafel's services,
                  including restaurants and their guests.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Platform</strong>: the website thetafel.nl and all associated services,
                  including the booking system.
                </li>
              </>
            ) : (
              <>
                <li style={{ marginBottom: '8px' }}>
                  <strong>The Tafel</strong>: de onderneming die het platform thetafel.nl aanbiedt,
                  geregistreerd bij de Kamer van Koophandel onder nummer KVK 42027611.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Restaurant</strong>: de horecaondernemer of restauranthouder die gebruik maakt
                  van het platform van The Tafel.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Gebruiker</strong>: elke persoon die de website thetafel.nl bezoekt of gebruik
                  maakt van de diensten van The Tafel, waaronder restaurants en hun gasten.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Platform</strong>: de website thetafel.nl en alle bijbehorende diensten,
                  waaronder het boekingssysteem.
                </li>
              </>
            )}
          </ul>

          {/* Section 2 */}
          <h2 style={headingStyle}>{isEn ? '2. Applicability' : '2. Toepasselijkheid'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'These terms and conditions apply to all use of the thetafel.nl platform and to all agreements that The Tafel enters into with restaurants and other users. By using the platform you accept these terms.'
              : 'Deze algemene voorwaarden zijn van toepassing op elk gebruik van het platform thetafel.nl en op alle overeenkomsten die The Tafel sluit met restaurants en andere gebruikers. Door gebruik te maken van het platform accepteert u deze voorwaarden.'}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'The Tafel reserves the right to amend these terms. Users will be notified with a notice period of at least 30 days. Continued use of the platform after the change constitutes acceptance of the new terms.'
              : 'The Tafel behoudt zich het recht voor deze voorwaarden te wijzigen. Gebruikers worden hiervan op de hoogte gesteld met een opzegtermijn van minimaal 30 dagen. Voortgezet gebruik van het platform na de wijziging geldt als acceptatie van de nieuwe voorwaarden.'}
          </p>

          {/* Section 3 */}
          <h2 style={headingStyle}>{isEn ? '3. The platform' : '3. Het platform'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'The Tafel offers restaurants a free booking system through which guests can place reservations and optionally pay in advance. During the trial period the platform is completely free for restaurants. After the trial period, a flat monthly fee applies for use of the platform.'
              : 'The Tafel biedt restaurants een gratis boekingssysteem waarmee gasten reserveringen kunnen plaatsen en optioneel vooraf kunnen betalen. Gedurende de proefperiode is het platform volledig gratis voor restaurants. Na afloop van de proefperiode geldt een vast maandelijks bedrag voor gebruik van het platform.'}
          </p>
          <p style={bodyStyle}>
            {isEn ? (
              <>
                The Tafel <strong>never charges commission</strong> per reservation or per cover.
                The revenue model is based solely on a flat monthly subscription fee.
              </>
            ) : (
              <>
                The Tafel rekent <strong>nooit commissie</strong> per reservering of per couvvert.
                Het verdienmodel is uitsluitend gebaseerd op een flat maandelijks abonnementsbedrag.
              </>
            )}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'The Tafel aims to keep the platform available 24 hours a day, 7 days a week, but does not guarantee uninterrupted availability. The Tafel is not liable for damage resulting from temporary unavailability of the platform.'
              : 'The Tafel streeft ernaar het platform 24 uur per dag, 7 dagen per week beschikbaar te stellen, maar garandeert geen ononderbroken beschikbaarheid. The Tafel is niet aansprakelijk voor schade als gevolg van tijdelijke onbeschikbaarheid van het platform.'}
          </p>

          {/* Section 4 */}
          <h2 style={headingStyle}>{isEn ? '4. Use of the platform' : '4. Gebruik van het platform'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'The restaurant is responsible for the accuracy and completeness of all information placed on the platform, including opening hours, availability, prices and restaurant descriptions. The Tafel is not liable for incorrect information provided by the restaurant.'
              : 'Het restaurant is verantwoordelijk voor de juistheid en volledigheid van alle informatie die op het platform wordt geplaatst, waaronder openingstijden, beschikbaarheid, prijzen en restaurantbeschrijvingen. The Tafel is niet aansprakelijk voor onjuiste informatie verstrekt door het restaurant.'}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'Restaurants are not permitted to use the platform for illegal purposes, spam or misleading communication. The Tafel reserves the right to remove restaurants from the platform without giving reasons in case of misuse.'
              : 'Het is restaurants niet toegestaan het platform te gebruiken voor onwettige doeleinden, spam of misleidende communicatie. The Tafel behoudt zich het recht voor restaurants zonder opgave van redenen van het platform te verwijderen bij misbruik.'}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'All guest data collected through the platform belongs to the restaurant. The Tafel has no right to use this data for its own purposes or to provide it to third parties, unless legally required.'
              : 'Alle gastgegevens die via het platform worden verzameld zijn eigendom van het restaurant. The Tafel heeft geen recht deze gegevens voor eigen doeleinden te gebruiken of aan derden te verstrekken, tenzij wettelijk verplicht.'}
          </p>

          {/* Section 5 */}
          <h2 style={headingStyle}>{isEn ? '5. Payments' : '5. Betalingen'}</h2>
          <p style={bodyStyle}>
            {isEn ? (
              <>
                Prepaid bookings by guests are processed via <strong>Mollie</strong>, a certified Dutch
                payment processor. Payments are made via iDEAL and other payment methods supported by Mollie.
              </>
            ) : (
              <>
                Prepaid boekingen door gasten worden verwerkt via <strong>Mollie</strong>, een
                gecertificeerde Nederlandse betaalverwerker. Betalingen verlopen via iDEAL en andere door
                Mollie ondersteunde betaalmethoden.
              </>
            )}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'The Tafel is not liable for disruptions, delays or errors of Mollie or other payment processors. In the event of payment problems, please contact the payment processor or your bank.'
              : 'The Tafel is niet aansprakelijk voor storingen, vertragingen of fouten van Mollie of andere betaalverwerkers. Bij problemen met betalingen dient u contact op te nemen met de betaalverwerker of uw bank.'}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'Prepaid amounts will be paid out to the restaurant as soon as possible after the booking, in accordance with the payment processor\'s payout conditions.'
              : 'Prepaid bedragen worden zo spoedig mogelijk na de boeking uitbetaald aan het restaurant, conform de uitbetalingsvoorwaarden van de betaalverwerker.'}
          </p>

          {/* Section 6 */}
          <h2 style={headingStyle}>{isEn ? '6. No-shows and cancellations' : '6. No-shows en annuleringen'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'The Tafel facilitates the booking system but is not a party to the agreement between the restaurant and the guest. The Tafel is not liable for no-shows, cancellations or disputes arising between restaurants and their guests.'
              : 'The Tafel faciliteert het boekingssysteem maar is geen partij in de overeenkomst tussen het restaurant en de gast. The Tafel is niet aansprakelijk voor no-shows, annuleringen of geschillen die ontstaan tussen restaurants en hun gasten.'}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'Restaurants are themselves responsible for establishing and communicating their cancellation policy to guests. Any refunds upon cancellation are arranged between the restaurant and the guest.'
              : 'Restaurants zijn zelf verantwoordelijk voor het vaststellen en communiceren van hun annuleringsbeleid aan gasten. Eventuele restituties bij annulering worden geregeld tussen het restaurant en de gast.'}
          </p>

          {/* Section 7 */}
          <h2 style={headingStyle}>{isEn ? '7. Liability' : '7. Aansprakelijkheid'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'The Tafel is not liable for indirect damage, consequential damage, loss of profit or damage resulting from no-shows, booking disputes or platform outages.'
              : 'The Tafel is niet aansprakelijk voor indirecte schade, gevolgschade, gederfde winst of schade als gevolg van no-shows, boekingsgeschillen of storingen van het platform.'}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'The liability of The Tafel is in all cases limited to the amount the restaurant has paid to The Tafel in the three months prior to the damage-causing event. During use of the free trial period, liability is limited to €100.'
              : 'De aansprakelijkheid van The Tafel is in alle gevallen beperkt tot het bedrag dat het restaurant in de drie maanden voorafgaand aan het schadeveroorzakende event aan The Tafel heeft betaald. Bij gebruik tijdens de gratis proefperiode is de aansprakelijkheid beperkt tot €100.'}
          </p>

          {/* Section 8 */}
          <h2 style={headingStyle}>{isEn ? '8. Intellectual property' : '8. Intellectueel eigendom'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'All content on thetafel.nl, including texts, images, logos, designs and software, is the property of The Tafel or is licensed by The Tafel. It is not permitted to copy, distribute or commercially exploit content from the platform without prior written consent from The Tafel.'
              : 'Alle inhoud op thetafel.nl, waaronder teksten, afbeeldingen, logo\'s, ontwerpen en software, is eigendom van The Tafel of is gelicenseerd door The Tafel. Het is niet toegestaan content van het platform te kopiëren, verspreiden of commercieel te exploiteren zonder voorafgaande schriftelijke toestemming van The Tafel.'}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'By placing content (such as restaurant photos or descriptions) on the platform, the restaurant grants The Tafel a non-exclusive, free-of-charge licence to display this content on the platform.'
              : 'Door content (zoals restaurantfoto\'s of -beschrijvingen) op het platform te plaatsen, verleent het restaurant The Tafel een niet-exclusieve, kosteloze licentie om deze content te tonen op het platform.'}
          </p>

          {/* Section 9 */}
          <h2 style={headingStyle}>{isEn ? '9. Changes to the terms' : '9. Wijzigingen in de voorwaarden'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'The Tafel reserves the right to amend these terms and conditions. Restaurants will be notified at least 30 days in advance of substantial changes, via the email address known to us.'
              : 'The Tafel behoudt zich het recht voor deze algemene voorwaarden te wijzigen. Restaurants worden minimaal 30 dagen van tevoren op de hoogte gesteld van substantiële wijzigingen, via het bij ons bekende e-mailadres.'}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'If you do not agree to the amended terms, you may cancel your account before the effective date of the changes. Continued use after the effective date constitutes acceptance of the amended terms.'
              : 'Indien u niet akkoord gaat met de gewijzigde voorwaarden, kunt u uw account opzeggen voor de ingangsdatum van de wijzigingen. Voortgezet gebruik na de ingangsdatum geldt als acceptatie van de gewijzigde voorwaarden.'}
          </p>

          {/* Section 10 */}
          <h2 style={headingStyle}>{isEn ? '10. Applicable law and jurisdiction' : '10. Toepasselijk recht en bevoegde rechter'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'These terms and conditions and all agreements with The Tafel are exclusively governed by Dutch law. All disputes arising from or related to these terms or the use of the platform will be submitted to the competent court in Amsterdam, Netherlands.'
              : 'Op deze algemene voorwaarden en alle overeenkomsten met The Tafel is uitsluitend Nederlands recht van toepassing. Alle geschillen die voortvloeien uit of verband houden met deze voorwaarden of het gebruik van het platform worden voorgelegd aan de bevoegde rechter in Amsterdam, Nederland.'}
          </p>

          {/* Section 11 */}
          <h2 style={headingStyle}>{isEn ? '11. Contact' : '11. Contact'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'For questions about these terms and conditions, please contact us via:'
              : 'Voor vragen over deze algemene voorwaarden kunt u contact opnemen via:'}
          </p>
          <p style={bodyStyle}>
            The Tafel<br />
            KVK: 42027611<br />
            BTW: NL005440779B20<br />
            {isEn ? 'Email' : 'E-mail'}:{' '}
            <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>
            <br />
            {isEn ? 'Netherlands' : 'Nederland'}
          </p>
        </div>
      </main>
      <Footer />

      <style>{`
        @media (max-width: 768px) {
          .policy-content {
            padding: 100px 24px 60px !important;
          }
        }
      `}</style>
    </>
  )
}
