'use client';

/**
 * Component sandbox — /dashboard/_sandbox (folder %5Fsandbox: encoded
 * underscore so the App Router serves it; a literal _sandbox folder would be
 * private and 404). Not linked from the nav; verification-only. Renders every
 * D0.3 component with example props and the full icon grid. Stays until D9.4
 * decides its fate.
 */

import { useState } from 'react';
import StatTile from '@/components/dashboard/ui/StatTile';
import AlertStrip from '@/components/dashboard/ui/AlertStrip';
import StatusChip from '@/components/dashboard/ui/StatusChip';
import EntityCard from '@/components/dashboard/ui/EntityCard';
import DetailSheet from '@/components/dashboard/ui/DetailSheet';
import DetailPanel from '@/components/dashboard/ui/DetailPanel';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DateNav from '@/components/dashboard/ui/DateNav';
import SectionHeader from '@/components/dashboard/ui/SectionHeader';
import * as Icons from '@/components/dashboard/icons';

export default function SandboxPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPending, setDialogPending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [date, setDate] = useState(new Date());

  const label = (text: string) => (
    <h2
      className="mt-10 mb-3 text-[13px] uppercase tracking-[0.15em] text-[#8c8577]"
      style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
    >
      {text}
    </h2>
  );

  return (
    <div className="max-w-[900px]">
      <SectionHeader
        title="Sandbox"
        subtitle="D0.3 componenten en iconen — alleen voor verificatie."
        rightSlot={<StatusChip tone="neutral" label="Intern" />}
      />

      {label('StatTile')}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Reserveringen vandaag" value="14" delta={{ text: '3 meer dan vorige week', tone: 'positive' }} href="/dashboard/bookings" />
        <StatTile label="Bestellingen vandaag" value="23" delta={{ text: '€412 omzet', tone: 'neutral' }} />
        <StatTile label="Open rekeningen" value="4" delta={{ text: '€186 uitstaand', tone: 'negative' }} />
        <StatTile label="Verwachte gasten" value="38" />
      </div>

      {label('AlertStrip')}
      <AlertStrip
        alerts={[
          { id: '1', tone: 'danger', label: 'Mollie-verbinding verbroken — gasten kunnen niet vooruitbetalen.', actionHref: '/dashboard/settings', actionLabel: 'Herstel' },
          { id: '2', tone: 'warning', label: '2 bestellingen staan langer dan 10 minuten klaar.', actionHref: '/dashboard/orders', actionLabel: 'Bekijk', onDismiss: () => {} },
        ]}
      />

      {label('StatusChip')}
      <div className="flex flex-wrap gap-2">
        <StatusChip tone="success" label="Bevestigd" />
        <StatusChip tone="warning" label="Wacht op aanbetaling" />
        <StatusChip tone="danger" label="No-show" />
        <StatusChip tone="neutral" label="Geannuleerd" />
      </div>

      {label('EntityCard')}
      <div className="flex flex-col gap-3">
        <EntityCard
          title="Jansen · 4 personen"
          subtitle="Terras · Tafel 7"
          meta="19:30"
          status={<StatusChip tone="success" label="Bevestigd" />}
          actions={[
            { key: 'arrive', label: 'Aangekomen', tone: 'primary' },
            { key: 'noshow', label: 'No-show', tone: 'danger' },
          ]}
        />
        <EntityCard
          title="Bestelling #A12"
          subtitle="2× Pasta pesto · 1× Tiramisu"
          meta="4 min geleden"
          status={<StatusChip tone="warning" label="Nieuw" />}
          href="/dashboard/orders"
        />
      </div>

      {label('ConfirmDialog + DetailSheet')}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          Open ConfirmDialog
        </button>
        <button
          type="button"
          onClick={() => setDialogPending((v) => !v)}
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          Toggle pending ({dialogPending ? 'aan' : 'uit'})
        </button>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          Open DetailSheet
        </button>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
        title="Reservering annuleren?"
        body={<span>De gast ontvangt een annuleringsmail. De aanbetaling van €20 wordt teruggestort.</span>}
        confirmLabel="Annuleren"
        cancelLabel="Terug"
        destructive
        pending={dialogPending}
      />

      <DetailSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Reservering — Jansen"
        footerAction={
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="tafel-tap w-full px-4 py-3 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            Markeer als aangekomen
          </button>
        }
      >
        <p style={{ fontFamily: 'var(--font-jost), Jost, sans-serif' }} className="text-[14px] text-[#6f6353]">
          Voorbeeldinhoud van het detailpaneel. 4 personen, 19:30, Terras tafel 7.
        </p>
      </DetailSheet>

      {label('DetailPanel (desktop)')}
      <div className="hidden md:grid grid-cols-[60%_40%] gap-4">
        <div className="bg-white rounded-card p-4 text-[14px] text-[#6f6353]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif' }}>
          Lijstzijde (60%)
        </div>
        <DetailPanel
          title="Detail"
          footerAction={
            <button
              type="button"
              className="tafel-tap w-full px-4 py-3 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              Actie
            </button>
          }
        >
          <p className="text-[14px] text-[#6f6353]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif' }}>
            Detailzijde (40%), sticky naast de lijst.
          </p>
        </DetailPanel>
      </div>

      {label('EmptyState')}
      <EmptyState
        illustration={<Icons.Plate width={48} height={48} />}
        heading="Nog geen reserveringen voor vandaag"
        body="Zodra een gast reserveert verschijnt die hier direct."
        action={
          <button
            type="button"
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            + Walk-in toevoegen
          </button>
        }
      />

      {label('DateNav')}
      <DateNav date={date} onChange={setDate} locale="nl" />

      {label('Iconen (27)')}
      <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
        {Object.entries(Icons).map(([name, Icon]) => (
          <div key={name} className="bg-white rounded-card p-3 flex flex-col items-center gap-2 text-[#1e1508]">
            <Icon width={24} height={24} />
            <span
              className="text-[10px] text-[#8c8577] text-center break-all"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
            >
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
