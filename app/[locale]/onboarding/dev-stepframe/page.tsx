'use client';

/**
 * Dev-only test page for StepFrame + field component showcase.
 *
 * Visit: /onboarding/dev-stepframe  or  /en/onboarding/dev-stepframe
 *
 * Deleted in Phase D9 before launch.
 */

import { useParams } from 'next/navigation';
import { useState } from 'react';
import StepFrame from '@/components/onboarding/shell/StepFrame';
import TextField from '@/components/onboarding/fields/TextField';
import TextAreaField from '@/components/onboarding/fields/TextAreaField';
import SelectField from '@/components/onboarding/fields/SelectField';
import ToggleField from '@/components/onboarding/fields/ToggleField';
import CardChoice from '@/components/onboarding/fields/CardChoice';
import FileUploadField, { type UploadedFileMetadata } from '@/components/onboarding/fields/FileUploadField';
import PostcodeField from '@/components/onboarding/fields/PostcodeField';
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator';
import { useDraftSave } from '@/lib/onboarding/useDraftSave';

export default function DevStepFramePage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale === 'en' ? 'en' : 'nl';

  // StepFrame dev controls
  const [canContinue, setCanContinue] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showError, setShowError] = useState(false);
  const [hasBack, setHasBack] = useState(true);
  const [currentStep, setCurrentStep] = useState(2);

  // Field showcase values
  const [textValue, setTextValue] = useState('');
  const [textAreaValue, setTextAreaValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [toggleA, setToggleA] = useState(true);
  const [toggleB, setToggleB] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>(['reservations']);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileMetadata | null>(null);

  // PostcodeField state
  const [postcode, setPostcode] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [houseNumberAddition, setHouseNumberAddition] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');

  const { state: saveState, save: saveDraft, saveNow: saveDraftNow } = useDraftSave();

  const toggleCard = (key: string) => {
    setSelectedCards((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleContinue = async () => {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsSubmitting(false);
    alert('Continue handler fired.');
  };

  return (
    <StepFrame
      locale={locale}
      showProgress
      currentStepDisplayNumber={currentStep}
      totalSteps={13}
      serviceTag={locale === 'en' ? 'Reservations' : 'Reserveringen'}
      heading={
        locale === 'en' ? 'Field component showcase' : 'Veldcomponenten showcase'
      }
      subHeading={
        locale === 'en'
          ? 'Dev page for verifying TextField, TextAreaField, SelectField, ToggleField, and CardChoice. Deleted in Phase D9.'
          : 'Dev-pagina voor het verifiëren van de veldcomponenten. Wordt verwijderd in Phase D9.'
      }
      error={
        showError
          ? locale === 'en'
            ? 'Example error banner — dismiss with the X.'
            : 'Voorbeeld-foutbalk — sluit met de X.'
          : null
      }
      onDismissError={() => setShowError(false)}
      backHref={hasBack ? `/${locale === 'en' ? 'en/' : ''}onboarding` : null}
      onContinue={handleContinue}
      canContinue={canContinue}
      isSubmitting={isSubmitting}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* ---- useDraftSave tester ---- */}
        <section
          style={{
            padding: '20px 22px',
            backgroundColor: 'rgba(248, 242, 230, 0.5)',
            border: '1px solid #f0e8d8',
            borderRadius: '16px',
          }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#9c8b6a',
            }}
          >
            useDraftSave tester
          </h2>
          <p
            style={{
              margin: '0 0 16px',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              color: '#9c8b6a',
              lineHeight: 1.5,
            }}
          >
            Watch the footer centre for the SavedIndicator state. "Saving…" appears
            immediately, then "Saved" after the network call, or "Retry" after 3 failed attempts.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => saveDraft({ restaurant: { name: 'Test Save ' + Date.now() } })}
              style={{
                padding: '10px 16px',
                borderRadius: '999px',
                backgroundColor: '#d4820a',
                color: '#fdfaf5',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Trigger debounced save
            </button>
            <button
              type="button"
              onClick={() => void saveDraftNow({ restaurant: { name: 'Immediate ' + Date.now() } })}
              style={{
                padding: '10px 16px',
                borderRadius: '999px',
                backgroundColor: 'transparent',
                color: '#1e1508',
                border: '1.5px solid #1e1508',
                cursor: 'pointer',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Trigger immediate saveNow
            </button>
          </div>
          <p
            style={{
              margin: '12px 0 0',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '12px',
              color: '#9c8b6a',
            }}
          >
            Current state: <code>{saveState.status}</code>
          </p>
        </section>

        {/* ---- StepFrame dev controls ---- */}
        <section
          style={{
            padding: '20px 22px',
            backgroundColor: 'rgba(248, 242, 230, 0.5)',
            border: '1px solid #f0e8d8',
            borderRadius: '16px',
          }}
        >
          <h2
            style={{
              margin: '0 0 16px',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#9c8b6a',
            }}
          >
            StepFrame controls
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px', color: '#1e1508', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={canContinue}
                onChange={(e) => setCanContinue(e.target.checked)}
              />
              canContinue
            </label>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px', color: '#1e1508', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showError}
                onChange={(e) => setShowError(e.target.checked)}
              />
              show error banner
            </label>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px', color: '#1e1508', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasBack}
                onChange={(e) => setHasBack(e.target.checked)}
              />
              show Back button
            </label>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px', color: '#1e1508', cursor: 'pointer' }}>
              currentStep:
              <input
                type="number"
                min={0}
                max={13}
                value={currentStep}
                onChange={(e) => setCurrentStep(Number(e.target.value))}
                style={{
                  width: '60px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #f0e8d8',
                }}
              />
            </label>
          </div>
        </section>

        {/* ---- TextField ---- */}
        <FieldSection title="TextField">
          <TextField
            label="Restaurant name"
            value={textValue}
            onChange={setTextValue}
            placeholder="e.g. De Kas"
            hint="The name diners see on your page."
            required
          />
          <TextField
            label="Email (with error)"
            value="not-an-email"
            onChange={() => {}}
            type="email"
            error="Please enter a valid email address."
          />
          <TextField
            label="Prep time"
            value="20"
            onChange={() => {}}
            type="number"
            trailingSlot="min"
            hint="How long it usually takes to prepare a takeaway order."
          />
          <TextField
            label="Disabled field"
            value="Locked value"
            onChange={() => {}}
            disabled
          />
        </FieldSection>

        {/* ---- TextAreaField ---- */}
        <FieldSection title="TextAreaField">
          <TextAreaField
            label="Confirmation message (NL)"
            value={textAreaValue}
            onChange={setTextAreaValue}
            placeholder="Bedankt voor je reservering bij…"
            hint="Sent automatically after booking."
            maxLength={500}
            showCounter
            rows={4}
          />
        </FieldSection>

        {/* ---- SelectField ---- */}
        <FieldSection title="SelectField">
          <SelectField
            label="Cuisine type"
            value={selectValue}
            onChange={setSelectValue}
            placeholder="Select a cuisine..."
            options={[
              {
                label: 'European',
                options: [
                  { value: 'dutch', label: 'Dutch' },
                  { value: 'french', label: 'French' },
                  { value: 'italian', label: 'Italian' },
                ],
              },
              {
                label: 'Asian',
                options: [
                  { value: 'japanese', label: 'Japanese' },
                  { value: 'thai', label: 'Thai' },
                  { value: 'indian', label: 'Indian' },
                ],
              },
            ]}
            required
          />
        </FieldSection>

        {/* ---- ToggleField ---- */}
        <FieldSection title="ToggleField">
          <ToggleField
            label="Allow waitlist"
            description="When the requested slot is full, diners can join a waitlist."
            value={toggleA}
            onChange={setToggleA}
          />
          <ToggleField
            label="WhatsApp reminders"
            description="We send a reminder 2 hours before the booking."
            value={toggleB}
            onChange={setToggleB}
            hint="Requires WhatsApp Business connection (set up in Step 6)."
          />
        </FieldSection>

        {/* ---- CardChoice ---- */}
        <FieldSection title="CardChoice (multi-select demo)">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            <CardChoice
              title="Reservations"
              description="Diners book tables online."
              accentColor="#d4820a"
              selected={selectedCards.includes('reservations')}
              onClick={() => toggleCard('reservations')}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              }
              badge="From €0.50 / booking"
            />
            <CardChoice
              title="Takeaway"
              description="Online ordering with pickup."
              accentColor="#3a7d44"
              selected={selectedCards.includes('takeaway')}
              onClick={() => toggleCard('takeaway')}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              }
              badge="2% commission"
            />
            <CardChoice
              title="QR ordering"
              description="Diners scan, order from their phone."
              accentColor="#8b5cf6"
              selected={selectedCards.includes('qr')}
              onClick={() => toggleCard('qr')}
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <line x1="14" y1="14" x2="14" y2="21" />
                  <line x1="18" y1="14" x2="18" y2="21" />
                  <line x1="21" y1="17" x2="14" y2="17" />
                </svg>
              }
              badge="€19 / month"
            />
            <CardChoice
              title="Delivery"
              description="Online ordering with delivery."
              accentColor="#0ea5e9"
              selected={false}
              onClick={() => {}}
              disabled
              disabledReason="Coming Q3 2026"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.5" cy="17.5" r="2.5" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                  <path d="M3 14V6a1 1 0 0 1 1-1h10v9" />
                  <path d="M14 8h4l3 4v5h-3" />
                </svg>
              }
            />
          </div>
        </FieldSection>

        {/* ---- FileUploadField ---- */}
        <FieldSection title="FileUploadField">
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              color: '#9c8b6a',
              lineHeight: 1.5,
            }}
          >
            Uploads to the <code>restaurant-assets</code> bucket. Folder path
            is a placeholder UUID for dev. Public bucket → preview shows the
            image directly.
          </p>
          <FileUploadField
            label="Hero photo"
            hint="JPG, PNG, or WebP. Max 5 MB."
            bucket="restaurant-assets"
            folderPath="00000000-0000-0000-0000-000000000000/hero-dev-test"
            accept="image/jpeg,image/webp"
            maxSizeBytes={5 * 1024 * 1024}
            isPublicBucket={true}
            currentFile={uploadedFile}
            onUploaded={setUploadedFile}
            onRemoved={() => setUploadedFile(null)}
          />
        </FieldSection>

        {/* ---- PostcodeField ---- */}
        <FieldSection title="PostcodeField (Dutch address with PDOK autofill)">
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              color: '#9c8b6a',
              lineHeight: 1.5,
            }}
          >
            Type a valid Dutch postcode (e.g. <code>1011AC</code>) and a house
            number (e.g. <code>12</code>). After 400 ms the component calls the
            PDOK lookup route and autofills street and city.
          </p>
          <PostcodeField
            heading="Restaurant address"
            postcode={postcode}
            houseNumber={houseNumber}
            houseNumberAddition={houseNumberAddition}
            street={street}
            city={city}
            onPostcodeChange={setPostcode}
            onHouseNumberChange={setHouseNumber}
            onHouseNumberAdditionChange={setHouseNumberAddition}
            onStreetChange={setStreet}
            onCityChange={setCity}
            hint="Postcode + huisnummer autovult straat en stad via PDOK."
            required
          />
        </FieldSection>
      </div>
    </StepFrame>
  );
}

function FieldSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#9c8b6a',
        }}
      >
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {children}
      </div>
    </section>
  );
}
