import Link from 'next/link'
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

const subHeadingStyle = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 700,
  fontSize: '16px',
  color: 'var(--earth)',
  marginTop: '24px',
  marginBottom: '10px',
}

type Props = {
  params: Promise<{ locale: string }>
}

export default async function PrivacybeleidPage({ params }: Props) {
  const { locale } = await params
  const isEn = locale === 'en'

  return (
    <>
      <Nav solid />
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
            {isEn ? 'Privacy Policy' : 'Privacybeleid'}
          </h1>
          <p style={metaStyle}>{isEn ? 'Last updated: 16 July 2026' : 'Laatst bijgewerkt: 16 juli 2026'}</p>

          {/* Section 1 */}
          <h2 style={headingStyle}>{isEn ? '1. Who are we' : '1. Wie zijn wij'}</h2>
          <p style={bodyStyle}>
            {isEn ? (
              <>
                The Tafel is a Dutch platform offering free booking systems to restaurants.
                We are registered with the Chamber of Commerce under number KVK 42027611 and have
                VAT number NL005440779B20. For questions about your personal data, please contact us at{' '}
                <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>.
              </>
            ) : (
              <>
                The Tafel is een Nederlands platform dat gratis boekingssystemen aanbiedt aan restaurants.
                Wij zijn geregistreerd bij de Kamer van Koophandel onder nummer KVK 42027611 en hebben
                BTW-nummer NL005440779B20. Voor vragen over uw persoonsgegevens kunt u contact opnemen via{' '}
                <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>.
              </>
            )}
          </p>

          {/* Section 2 */}
          <h2 style={headingStyle}>{isEn ? '2. What data do we collect' : '2. Welke gegevens verzamelen wij'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'We only collect personal data that you provide to us via our sign-up form. This includes:'
              : 'Wij verzamelen uitsluitend persoonsgegevens die u zelf aan ons verstrekt via ons aanmeldformulier. Dit betreft de volgende gegevens:'}
          </p>
          <ul style={listStyle}>
            {isEn ? (
              <>
                <li style={{ marginBottom: '6px' }}>Name (first and last name)</li>
                <li style={{ marginBottom: '6px' }}>Email address</li>
                <li style={{ marginBottom: '6px' }}>Phone number</li>
                <li style={{ marginBottom: '6px' }}>Restaurant name</li>
                <li style={{ marginBottom: '6px' }}>City or location</li>
              </>
            ) : (
              <>
                <li style={{ marginBottom: '6px' }}>Naam (voor- en achternaam)</li>
                <li style={{ marginBottom: '6px' }}>E-mailadres</li>
                <li style={{ marginBottom: '6px' }}>Telefoonnummer</li>
                <li style={{ marginBottom: '6px' }}>Restaurantnaam</li>
                <li style={{ marginBottom: '6px' }}>Stad of locatie</li>
              </>
            )}
          </ul>
          <p style={bodyStyle}>
            {isEn
              ? 'We do not collect special categories of personal data and do not request more information than is necessary for the purpose for which the data is processed.'
              : 'Wij verzamelen geen bijzondere categorieën persoonsgegevens en vragen niet meer informatie dan noodzakelijk voor het doel waarvoor de gegevens worden verwerkt.'}
          </p>

          <h3 style={subHeadingStyle}>
            {isEn ? 'Data from guests using our booking and ordering flows' : 'Gegevens van gasten die onze boekings- en bestelfuncties gebruiken'}
          </h3>
          <p style={bodyStyle}>
            {isEn
              ? 'When you book a table, order from a table via QR code, or place a takeaway order through The Tafel, we additionally collect:'
              : 'Wanneer u een tafel reserveert, via QR-code aan tafel bestelt, of een afhaalbestelling plaatst via The Tafel, verzamelen wij daarnaast:'}
          </p>
          <ul style={listStyle}>
            {isEn ? (
              <>
                <li style={{ marginBottom: '6px' }}><strong>Bookings</strong> — your full name, email address, phone number, party size, any note you leave, and the restaurant you booked with.</li>
                <li style={{ marginBottom: '6px' }}><strong>QR table orders</strong> — the items you order, your table number, any note you leave, and the payment method you choose.</li>
                <li style={{ marginBottom: '6px' }}><strong>Takeaway orders</strong> — the items you order, your pickup time, your name/email/phone number where applicable, and your payment reference.</li>
                <li style={{ marginBottom: '6px' }}><strong>Payment intents</strong> — the Mollie payment reference, amount, currency and status of your payment. Your card details never pass through The Tafel — these stay with Mollie.</li>
                <li style={{ marginBottom: '6px' }}><strong>Technical data</strong> — on every request we log your IP address (masked to the first two octets), browser user-agent, referrer and timestamp, for security and abuse prevention.</li>
              </>
            ) : (
              <>
                <li style={{ marginBottom: '6px' }}><strong>Boekingen</strong> — uw volledige naam, e-mailadres, telefoonnummer, gezelschapsgrootte, eventuele opmerking, en het restaurant waar u heeft gereserveerd.</li>
                <li style={{ marginBottom: '6px' }}><strong>QR-tafelbestellingen</strong> — de bestelde items, uw tafelnummer, eventuele opmerking, en de gekozen betaalmethode.</li>
                <li style={{ marginBottom: '6px' }}><strong>Afhaalbestellingen</strong> — de bestelde items, ophaaltijd, uw naam/e-mailadres/telefoonnummer indien van toepassing, en uw betaalreferentie.</li>
                <li style={{ marginBottom: '6px' }}><strong>Betaalintenties</strong> — de Mollie-betaalreferentie, het bedrag, de valuta en de status van uw betaling. Uw kaartgegevens komen nooit bij The Tafel terecht — deze blijven bij Mollie.</li>
                <li style={{ marginBottom: '6px' }}><strong>Technische gegevens</strong> — bij elk verzoek loggen wij uw IP-adres (gemaskeerd tot de eerste twee octetten), browser user-agent, referrer en tijdstip, ter beveiliging en misbruikpreventie.</li>
              </>
            )}
          </ul>

          {/* Section 3 */}
          <h2 style={headingStyle}>{isEn ? '3. Why do we use your data' : '3. Waarvoor gebruiken wij uw gegevens'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'Your personal data is used solely for the following purposes:'
              : 'Uw persoonsgegevens worden uitsluitend gebruikt voor de volgende doeleinden:'}
          </p>
          <ul style={listStyle}>
            {isEn ? (
              <>
                <li style={{ marginBottom: '6px' }}>Contacting you to activate your restaurant on the The Tafel platform.</li>
                <li style={{ marginBottom: '6px' }}>Answering questions you send us.</li>
                <li style={{ marginBottom: '6px' }}>Performing the agreement you enter into with us.</li>
              </>
            ) : (
              <>
                <li style={{ marginBottom: '6px' }}>Het opnemen van contact met u om uw restaurant te activeren op het The Tafel platform.</li>
                <li style={{ marginBottom: '6px' }}>Het beantwoorden van vragen die u aan ons stelt.</li>
                <li style={{ marginBottom: '6px' }}>Het uitvoeren van de overeenkomst die u met ons sluit.</li>
              </>
            )}
          </ul>
          <p style={bodyStyle}>
            {isEn
              ? 'When you use our consumer booking and ordering flows, we also use your data to:'
              : 'Wanneer u gebruikmaakt van onze boekings- en bestelfuncties, gebruiken wij uw gegevens ook om:'}
          </p>
          <ul style={listStyle}>
            {isEn ? (
              <>
                <li style={{ marginBottom: '6px' }}>Confirm your bookings and send reminders.</li>
                <li style={{ marginBottom: '6px' }}>Process your orders and take payment.</li>
                <li style={{ marginBottom: '6px' }}>Send you order-ready notifications.</li>
                <li style={{ marginBottom: '6px' }}>Detect and prevent abuse of the platform.</li>
                <li style={{ marginBottom: '6px' }}>Respond to legal obligations, such as Dutch tax law.</li>
              </>
            ) : (
              <>
                <li style={{ marginBottom: '6px' }}>Uw boekingen te bevestigen en herinneringen te sturen.</li>
                <li style={{ marginBottom: '6px' }}>Uw bestellingen te verwerken en de betaling te innen.</li>
                <li style={{ marginBottom: '6px' }}>U te laten weten dat uw bestelling klaar is.</li>
                <li style={{ marginBottom: '6px' }}>Misbruik van het platform te detecteren en te voorkomen.</li>
                <li style={{ marginBottom: '6px' }}>Te voldoen aan wettelijke verplichtingen, zoals de Nederlandse belastingwetgeving.</li>
              </>
            )}
          </ul>
          <p style={bodyStyle}>
            {isEn
              ? 'We will not send you commercial messages or newsletters unless you have explicitly given consent. You can withdraw this consent at any time.'
              : 'Wij sturen u geen commerciële berichten of nieuwsbrieven tenzij u daar uitdrukkelijk toestemming voor hebt gegeven. U kunt deze toestemming te allen tijde intrekken.'}
          </p>

          {/* Section 4 */}
          <h2 style={headingStyle}>{isEn ? '4. How long do we retain your data' : '4. Hoe lang bewaren wij uw gegevens'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'How long we keep your data depends on what kind of data it is:'
              : 'Hoe lang wij uw gegevens bewaren, hangt af van het type gegevens:'}
          </p>
          <ul style={listStyle}>
            {isEn ? (
              <>
                <li style={{ marginBottom: '6px' }}><strong>Restaurant sign-up data</strong> — a maximum of 2 years after the last contact with you.</li>
                <li style={{ marginBottom: '6px' }}><strong>Booking, order and payment records</strong> — 7 years, as required by Dutch tax law (Wet op de Rijksbelastingen, art. 52).</li>
                <li style={{ marginBottom: '6px' }}><strong>Personal identifiers within those records</strong> — kept until you request deletion. At that point your identifiers are anonymised immediately, and the underlying records remain in anonymised form for the rest of the 7-year retention period.</li>
              </>
            ) : (
              <>
                <li style={{ marginBottom: '6px' }}><strong>Aanmeldgegevens van restaurants</strong> — maximaal 2 jaar na het laatste contact met u.</li>
                <li style={{ marginBottom: '6px' }}><strong>Boekings-, bestel- en betaalgegevens</strong> — 7 jaar, conform de Nederlandse belastingwetgeving (Wet op de Rijksbelastingen, art. 52).</li>
                <li style={{ marginBottom: '6px' }}><strong>Persoonsidentificerende gegevens binnen deze records</strong> — bewaard totdat u om verwijdering verzoekt. Op dat moment worden uw identificerende gegevens direct geanonimiseerd, en blijven de onderliggende records in geanonimiseerde vorm bewaard voor de resterende bewaartermijn van 7 jaar.</li>
              </>
            )}
          </ul>

          {/* Section 5 */}
          <h2 style={headingStyle}>{isEn ? '5. Do we share your data' : '5. Delen wij uw gegevens met derden'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'Your personal data is not sold, rented or shared with third parties for commercial purposes. We use the following processors who process data on our behalf:'
              : 'Uw persoonsgegevens worden niet verkocht, verhuurd of gedeeld met derden voor commerciële doeleinden. Wij maken gebruik van de volgende verwerkers die namens ons gegevens verwerken:'}
          </p>
          <ul style={listStyle}>
            {isEn ? (
              <>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Supabase</strong> — storage of submitted form data. Supabase is certified for data processing in the European Union.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Resend</strong> — sending confirmation and notification emails. Resend processes email data in accordance with GDPR and is EU-based.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Mollie</strong> — payment processing for bookings and orders. Mollie is EU-based and GDPR-compliant.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Cloudflare Turnstile</strong> — bot detection on our public forms. Turnstile receives request metadata and your IP address.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Vercel</strong> — hosting infrastructure for our website and application. Vercel is EU-based and GDPR-compliant.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Plausible</strong> — anonymous website analytics, only if you have accepted the analytics cookie category. Plausible is EU-based and cookie-free.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Upstash Redis</strong> — session state and rate-limit tracking. Upstash is EU-based.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Meta WhatsApp Cloud API</strong> — order status notifications, only for guests who provide a phone number and opt in. Governed by Meta&apos;s own data processing agreement.
                </li>
              </>
            ) : (
              <>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Supabase</strong> — opslag van ingediende formuliergegevens. Supabase is gecertificeerd voor gegevensverwerking in de Europese Unie.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Resend</strong> — verzending van bevestigings- en notificatie-e-mails. Resend verwerkt e-mailgegevens conform de AVG/GDPR en is EU-gebaseerd.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Mollie</strong> — betalingsverwerking voor boekingen en bestellingen. Mollie is EU-gebaseerd en AVG-conform.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Cloudflare Turnstile</strong> — botdetectie op onze openbare formulieren. Turnstile ontvangt verzoekmetadata en uw IP-adres.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Vercel</strong> — hostinginfrastructuur voor onze website en applicatie. Vercel is EU-gebaseerd en AVG-conform.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Plausible</strong> — anonieme websiteanalyse, uitsluitend als u de cookiecategorie analytics heeft geaccepteerd. Plausible is EU-gebaseerd en cookieloos.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Upstash Redis</strong> — sessiestatus en rate-limit tracking. Upstash is EU-gebaseerd.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Meta WhatsApp Cloud API</strong> — statusmeldingen van bestellingen, uitsluitend voor gasten die een telefoonnummer opgeven en hiervoor kiezen. Valt onder de eigen verwerkersovereenkomst van Meta.
                </li>
              </>
            )}
          </ul>
          <p style={bodyStyle}>
            {isEn
              ? 'Data processing agreements have been concluded with all processors in accordance with the General Data Protection Regulation (GDPR).'
              : 'Met alle verwerkers zijn verwerkersovereenkomsten gesloten conform de Algemene Verordening Gegevensbescherming (AVG).'}
          </p>

          {/* Section 6 */}
          <h2 style={headingStyle}>{isEn ? '6. Your rights' : '6. Uw rechten'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'Under the GDPR, you have the following rights regarding your personal data:'
              : 'Op grond van de AVG heeft u de volgende rechten met betrekking tot uw persoonsgegevens:'}
          </p>
          <ul style={listStyle}>
            {isEn ? (
              <>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Right of access</strong> — you can request a copy of everything we hold about you, via{' '}
                  <Link href="/en/privacybeleid/data-request" style={linkStyle}>our data request page</Link>.
                </li>
                <li style={{ marginBottom: '6px' }}><strong>Right to rectification</strong> — you can ask us to correct inaccurate or incomplete data. Currently handled manually — contact <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>.</li>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Right to erasure</strong> — you can ask us to delete your data (&apos;right to be forgotten&apos;), via{' '}
                  <Link href="/en/privacybeleid/data-deletion" style={linkStyle}>our data deletion page</Link>.
                </li>
                <li style={{ marginBottom: '6px' }}><strong>Right to data portability</strong> — you can receive your data in a machine-readable format. Covered by the same data request page as the right of access.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to restriction of processing</strong> — you can ask us to restrict processing in certain circumstances.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to object</strong> — you can object to specific processing. Manual — contact <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to lodge a complaint</strong> — with the Dutch Data Protection Authority (Autoriteit Persoonsgegevens), at autoriteitpersoonsgegevens.nl.</li>
              </>
            ) : (
              <>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Recht op inzage</strong> — u kunt een kopie opvragen van alles wat wij van u hebben opgeslagen, via{' '}
                  <Link href="/privacybeleid/data-request" style={linkStyle}>onze pagina voor gegevensopvraging</Link>.
                </li>
                <li style={{ marginBottom: '6px' }}><strong>Recht op rectificatie</strong> — u kunt ons verzoeken onjuiste of onvolledige gegevens te corrigeren. Momenteel handmatig — neem contact op via <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>.</li>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Recht op verwijdering</strong> — u kunt ons verzoeken uw gegevens te verwijderen (&apos;recht op vergetelheid&apos;), via{' '}
                  <Link href="/privacybeleid/data-deletion" style={linkStyle}>onze pagina voor gegevensverwijdering</Link>.
                </li>
                <li style={{ marginBottom: '6px' }}><strong>Recht op dataportabiliteit</strong> — u kunt uw gegevens ontvangen in een machineleesbaar formaat. Dit valt onder dezelfde pagina als het recht op inzage.</li>
                <li style={{ marginBottom: '6px' }}><strong>Recht op beperking van verwerking</strong> — u kunt ons vragen de verwerking te beperken in bepaalde omstandigheden.</li>
                <li style={{ marginBottom: '6px' }}><strong>Recht op bezwaar</strong> — u kunt bezwaar maken tegen specifieke verwerking. Handmatig — neem contact op via <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>.</li>
                <li style={{ marginBottom: '6px' }}><strong>Recht om een klacht in te dienen</strong> — bij de Autoriteit Persoonsgegevens, via autoriteitpersoonsgegevens.nl.</li>
              </>
            )}
          </ul>
          <p style={bodyStyle}>
            {isEn ? (
              <>
                To exercise a right that requires a manual request, please email{' '}
                <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>. We aim to respond within 30 days.
              </>
            ) : (
              <>
                Om gebruik te maken van een recht dat een handmatig verzoek vereist, kunt u mailen naar{' '}
                <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>. Wij streven ernaar binnen 30 dagen te reageren.
              </>
            )}
          </p>

          {/* Section 7 */}
          <h2 style={headingStyle}>{isEn ? '7. Cookies' : '7. Cookies'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'We use three categories of cookies: essential (always on, needed for the site to work — e.g. bot protection, your language preference, your cart session, and rate limiting), analytics (off by default, only loaded once you accept), and marketing (currently unused). You can choose which categories to accept via the cookie banner shown on your first visit.'
              : 'Wij gebruiken drie categorieën cookies: essentieel (altijd aan, nodig voor de werking van de site — bijvoorbeeld botbeveiliging, uw taalvoorkeur, uw bestelsessie en rate limiting), analytics (standaard uit, wordt alleen geladen nadat u akkoord gaat) en marketing (momenteel niet in gebruik). U kiest welke categorieën u accepteert via de cookiebanner die bij uw eerste bezoek verschijnt.'}
          </p>
          <p style={bodyStyle}>
            {isEn ? (
              <>
                For website analytics we use <strong>Plausible Analytics</strong>, a privacy-friendly
                alternative to Google Analytics. Plausible works entirely without cookies and stores no
                personal data — but as a precaution we still only load it once you have accepted the
                analytics category. All analytics data is processed anonymously.
              </>
            ) : (
              <>
                Voor websiteanalyse maken wij gebruik van <strong>Plausible Analytics</strong>, een
                privacyvriendelijk alternatief voor Google Analytics. Plausible werkt volledig cookieloos
                en slaat geen persoonsgegevens op — uit voorzorg laden wij het echter pas nadat u de
                categorie analytics heeft geaccepteerd. Alle analysedata wordt geanonimiseerd verwerkt.
              </>
            )}
          </p>
          <p style={bodyStyle}>
            {isEn
              ? 'You can change your cookie choices at any time via the "Cookie settings" link in the footer of this website.'
              : 'U kunt uw cookiekeuzes te allen tijde wijzigen via de link "Cookie-instellingen" in de footer van deze website.'}
          </p>

          {/* Section 8 */}
          <h2 style={headingStyle}>{isEn ? '8. Security' : '8. Beveiliging'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'We take appropriate technical and organisational measures to protect your personal data against loss, misuse or unauthorised access. Communication via our website always takes place over a secure HTTPS connection.'
              : 'Wij nemen passende technische en organisatorische maatregelen om uw persoonsgegevens te beschermen tegen verlies, misbruik of onbevoegde toegang. Communicatie via onze website verloopt altijd via een beveiligde HTTPS-verbinding.'}
          </p>

          {/* Section 9 */}
          <h2 style={headingStyle}>{isEn ? '9. Changes to this privacy policy' : '9. Wijzigingen in dit privacybeleid'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'We reserve the right to amend this privacy policy. Changes will be published on this page with an updated date. We advise you to consult this policy regularly.'
              : 'Wij behouden ons het recht voor dit privacybeleid te wijzigen. Wijzigingen worden gepubliceerd op deze pagina met een bijgewerkte datum. Wij adviseren u dit beleid regelmatig te raadplegen.'}
          </p>

          {/* Your data — links to the GDPR data-export request flow (C8.1/C8.1b) */}
          <h2 style={headingStyle}>{isEn ? 'Your data' : 'Jouw gegevens'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'You can request a copy of everything The Tafel holds about you, across every restaurant you have booked or ordered from. You will receive it by email as a PDF you can read and a JSON file for technical use.'
              : 'Je kunt een kopie opvragen van alles wat The Tafel over je heeft opgeslagen, bij elk restaurant waar je hebt gereserveerd of besteld. Je ontvangt deze per e-mail als een leesbare PDF en een JSON-bestand voor technisch gebruik.'}
          </p>
          <Link
            href={isEn ? '/en/privacybeleid/data-request' : '/privacybeleid/data-request'}
            className="tafel-tap privacy-data-request-cta"
            style={{
              display: 'inline-block',
              marginBottom: '16px',
              padding: '14px 32px',
              borderRadius: '999px',
              backgroundColor: 'var(--amber)',
              color: 'var(--cream)',
              fontFamily: 'var(--font-jost), sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              letterSpacing: '0.02em',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            {isEn ? 'Request my data' : 'Vraag mijn gegevens op'}
          </Link>

          <p style={{ ...bodyStyle, fontSize: '13px', marginTop: '8px' }}>
            {isEn
              ? 'You can also ask us to delete your data entirely. This cannot be undone — some records must be kept for tax reasons, but everything identifying you will be removed.'
              : 'Je kunt ons ook vragen om je gegevens volledig te verwijderen. Dit kan niet ongedaan worden gemaakt — sommige gegevens moeten wij om fiscale redenen bewaren, maar alles wat jou identificeert wordt verwijderd.'}
          </p>
          <Link
            href={isEn ? '/en/privacybeleid/data-deletion' : '/privacybeleid/data-deletion'}
            className="tafel-tap privacy-data-request-cta"
            style={{
              display: 'inline-block',
              marginBottom: '16px',
              padding: '14px 32px',
              borderRadius: '999px',
              backgroundColor: 'var(--amber)',
              color: 'var(--cream)',
              fontFamily: 'var(--font-jost), sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              letterSpacing: '0.02em',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            {isEn ? 'Delete your data' : 'Verwijder jouw gegevens'}
          </Link>

          {/* Section 10 */}
          <h2 style={headingStyle}>{isEn ? '10. Contact' : '10. Contact'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'Do you have questions, comments or requests regarding your personal data? Please contact us:'
              : 'Heeft u vragen, opmerkingen of verzoeken met betrekking tot uw persoonsgegevens? Neem dan contact met ons op:'}
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
          .privacy-data-request-cta {
            display: block !important;
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </>
  )
}
