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

export default async function PrivacybeleidPage({ params }: Props) {
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
            {isEn ? 'Privacy Policy' : 'Privacybeleid'}
          </h1>
          <p style={metaStyle}>{isEn ? 'Last updated: April 2026' : 'Laatst bijgewerkt: april 2026'}</p>

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
              ? 'We will not send you commercial messages or newsletters unless you have explicitly given consent. You can withdraw this consent at any time.'
              : 'Wij sturen u geen commerciële berichten of nieuwsbrieven tenzij u daar uitdrukkelijk toestemming voor hebt gegeven. U kunt deze toestemming te allen tijde intrekken.'}
          </p>

          {/* Section 4 */}
          <h2 style={headingStyle}>{isEn ? '4. How long do we retain your data' : '4. Hoe lang bewaren wij uw gegevens'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'We retain your personal data for a maximum of 2 years after the last contact with you. After that, your data will be deleted, unless we are legally required to retain it longer (for example for accounting purposes).'
              : 'Wij bewaren uw persoonsgegevens maximaal 2 jaar na het laatste contact met u. Daarna worden uw gegevens verwijderd, tenzij wij wettelijk verplicht zijn ze langer te bewaren (bijvoorbeeld voor boekhoudkundige doeleinden).'}
          </p>

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
              </>
            ) : (
              <>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Supabase</strong> — opslag van ingediende formuliergegevens. Supabase is gecertificeerd voor gegevensverwerking in de Europese Unie.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Resend</strong> — verzending van bevestigings- en notificatie-e-mails. Resend verwerkt e-mailgegevens conform de AVG/GDPR en is EU-gebaseerd.
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
                <li style={{ marginBottom: '6px' }}><strong>Right of access</strong> — you can request which data we process about you.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to rectification</strong> — you can ask us to correct inaccurate or incomplete data.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to erasure</strong> — you can ask us to delete your data ('right to be forgotten').</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to restriction of processing</strong> — you can ask us to restrict processing in certain circumstances.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to object</strong> — you can object to the processing of your data.</li>
              </>
            ) : (
              <>
                <li style={{ marginBottom: '6px' }}><strong>Recht op inzage</strong> — u kunt opvragen welke gegevens wij van u verwerken.</li>
                <li style={{ marginBottom: '6px' }}><strong>Recht op rectificatie</strong> — u kunt ons verzoeken onjuiste of onvolledige gegevens te corrigeren.</li>
                <li style={{ marginBottom: '6px' }}><strong>Recht op verwijdering</strong> — u kunt ons verzoeken uw gegevens te verwijderen ('recht op vergetelheid').</li>
                <li style={{ marginBottom: '6px' }}><strong>Recht op beperking van verwerking</strong> — u kunt ons vragen de verwerking te beperken in bepaalde omstandigheden.</li>
                <li style={{ marginBottom: '6px' }}><strong>Recht op bezwaar</strong> — u kunt bezwaar maken tegen de verwerking van uw gegevens.</li>
              </>
            )}
          </ul>
          <p style={bodyStyle}>
            {isEn ? (
              <>
                To exercise your rights, please send a request to{' '}
                <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>.
                We aim to respond to your request within 30 days. If you believe we are not processing
                your personal data correctly, you have the right to lodge a complaint with the Dutch Data
                Protection Authority (autoriteitpersoonsgegevens.nl).
              </>
            ) : (
              <>
                Om gebruik te maken van uw rechten kunt u een verzoek sturen naar{' '}
                <a href="mailto:hallo@thetafel.nl" style={linkStyle}>hallo@thetafel.nl</a>.
                Wij streven ernaar uw verzoek binnen 30 dagen te beantwoorden. Indien u van mening bent dat
                wij uw persoonsgegevens niet correct verwerken, heeft u het recht een klacht in te dienen bij
                de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).
              </>
            )}
          </p>

          {/* Section 7 */}
          <h2 style={headingStyle}>{isEn ? '7. Cookies' : '7. Cookies'}</h2>
          <p style={bodyStyle}>
            {isEn
              ? 'The Tafel uses only functional cookies that are necessary for the operation of the website. We do not place tracking cookies or marketing cookies.'
              : 'The Tafel gebruikt uitsluitend functionele cookies die noodzakelijk zijn voor de werking van de website. Wij plaatsen geen tracking cookies of marketing cookies.'}
          </p>
          <p style={bodyStyle}>
            {isEn ? (
              <>
                For website analytics we use <strong>Plausible Analytics</strong>, a privacy-friendly
                alternative to Google Analytics. Plausible works entirely without cookies, stores no
                personal data and requires no cookie banner. All analytics data is processed anonymously.
              </>
            ) : (
              <>
                Voor websiteanalyse maken wij gebruik van <strong>Plausible Analytics</strong>, een
                privacyvriendelijk alternatief voor Google Analytics. Plausible werkt volledig cookieloos,
                slaat geen persoonsgegevens op en vereist geen cookiebanner. Alle analysedata wordt
                geanonimiseerd verwerkt.
              </>
            )}
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
        }
      `}</style>
    </>
  )
}
