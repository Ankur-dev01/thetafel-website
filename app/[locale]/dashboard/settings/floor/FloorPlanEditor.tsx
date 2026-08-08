'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import FloorTableRow from '@/components/dashboard/settings/FloorTableRow';
import { useFloorPlanActions } from '@/lib/dashboard/actions/floorPlanActions';
import {
  MAX_SEATS,
  MAX_TABLE_LABEL_LENGTH,
  MAX_ZONE_NAME_LENGTH,
  MIN_SEATS,
} from '@/lib/dashboard/settings/floorPlanValidation';
import type { FloorSavePayload } from '@/lib/dashboard/settings/floorPlanValidation';
import type { FloorPlanInitialData, FloorTable, FloorZone } from '@/lib/dashboard/queries/floorPlan';

type EditableZone = { id: string; name: string };

type EditableTable = {
  id: string | null; // null = not saved yet
  clientId: string; // stable React key across the id being filled in after save
  zoneId: string;
  label: string;
  seats: number;
  isBookable: boolean;
  isQrEnabled: boolean;
  qrImagePath: string | null;
};

type Baseline = {
  zones: EditableZone[];
  tables: EditableTable[];
};

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function makeClientId(): string {
  return crypto.randomUUID();
}

function zonesFromInitial(zones: FloorZone[]): EditableZone[] {
  return zones.map((z) => ({ id: z.id, name: z.name }));
}

function tablesFromInitial(zones: FloorZone[], tablesByZone: Record<string, FloorTable[]>): EditableTable[] {
  const tables: EditableTable[] = [];
  for (const zone of zones) {
    for (const table of tablesByZone[zone.id] ?? []) {
      tables.push({
        id: table.id,
        clientId: table.id,
        zoneId: table.zoneId,
        label: table.label,
        seats: table.seats,
        isBookable: table.isBookable,
        isQrEnabled: table.isQrEnabled,
        qrImagePath: table.qrImagePath,
      });
    }
  }
  return tables;
}

function cloneZones(zones: EditableZone[]): EditableZone[] {
  return zones.map((z) => ({ ...z }));
}
function cloneTables(tables: EditableTable[]): EditableTable[] {
  return tables.map((t) => ({ ...t }));
}

function newTableRow(zoneId: string): EditableTable {
  return {
    id: null,
    clientId: makeClientId(),
    zoneId,
    label: '',
    seats: 2,
    isBookable: true,
    isQrEnabled: false,
    qrImagePath: null,
  };
}

export default function FloorPlanEditor({ initialData }: { initialData: FloorPlanInitialData }) {
  const t = useTranslations('dashboard.settings.floor');
  const { pending, saveFloorPlan } = useFloorPlanActions();

  const [baseline, setBaseline] = useState<Baseline>({
    zones: zonesFromInitial(initialData.zones),
    tables: tablesFromInitial(initialData.zones, initialData.tablesByZone),
  });
  const [zones, setZones] = useState<EditableZone[]>(() => zonesFromInitial(initialData.zones));
  const [tables, setTables] = useState<EditableTable[]>(() =>
    tablesFromInitial(initialData.zones, initialData.tablesByZone),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [blockedNames, setBlockedNames] = useState<string[] | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const draggedZoneIdRef = useRef<string | null>(null);
  const [draggedZoneId, setDraggedZoneId] = useState<string | null>(null);
  const [dragOverZoneId, setDragOverZoneId] = useState<string | null>(null);

  const draggedTableIdRef = useRef<string | null>(null);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);

  function normalizedSnapshot(z: EditableZone[], tb: EditableTable[]) {
    const sortedTables = [...tb]
      .sort((a, b) => (a.id ?? a.clientId).localeCompare(b.id ?? b.clientId))
      .map((table) => ({
        id: table.id,
        zoneId: table.zoneId,
        label: table.label.trim(),
        seats: table.seats,
        isBookable: table.isBookable,
        isQrEnabled: table.isQrEnabled,
      }));
    return JSON.stringify({ zoneOrder: z.map((zone) => ({ id: zone.id, name: zone.name.trim() })), sortedTables });
  }

  const dirty = normalizedSnapshot(zones, tables) !== normalizedSnapshot(baseline.zones, baseline.tables);

  // Client-side validation (server re-validates authoritatively).
  const zoneErrors: Record<string, string> = {};
  const seenZoneNames = new Set<string>();
  for (const zone of zones) {
    const trimmed = zone.name.trim();
    if (trimmed.length === 0) zoneErrors[zone.id] = 'zoneNameRequired';
    else if (trimmed.length > MAX_ZONE_NAME_LENGTH) zoneErrors[zone.id] = 'zoneNameTooLong';
    const key = trimmed.toLowerCase();
    if (seenZoneNames.has(key)) zoneErrors[zone.id] = 'zoneNameDuplicate';
    seenZoneNames.add(key);
  }

  const tableErrors: Record<string, string> = {};
  const seenLabels = new Set<string>();
  for (const table of tables) {
    const trimmed = table.label.trim();
    if (trimmed.length === 0) tableErrors[table.clientId] = 'nameRequired';
    else if (trimmed.length > MAX_TABLE_LABEL_LENGTH) tableErrors[table.clientId] = 'nameTooLong';
    const key = trimmed.toLowerCase();
    if (key.length > 0 && seenLabels.has(key)) tableErrors[table.clientId] = 'nameDuplicate';
    seenLabels.add(key);
    if (table.seats < MIN_SEATS || table.seats > MAX_SEATS) tableErrors[table.clientId] = 'capacityInvalid';
  }

  const hasErrors = Object.keys(zoneErrors).length > 0 || Object.keys(tableErrors).length > 0;
  const canSave = dirty && !hasErrors && !pending;

  function updateTable(clientId: string, patch: Partial<EditableTable>) {
    setTables((prev) => prev.map((t) => (t.clientId === clientId ? { ...t, ...patch } : t)));
    setSavedToast(false);
  }

  function deleteTable(clientId: string) {
    setTables((prev) => prev.filter((t) => t.clientId !== clientId));
    setSavedToast(false);
  }

  function addTable(zoneId: string) {
    setTables((prev) => [...prev, newTableRow(zoneId)]);
    setSavedToast(false);
  }

  function renameZone(zoneId: string, name: string) {
    setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, name } : z)));
    setSavedToast(false);
  }

  // Zone drag reorder — same vanilla HTML5 pattern as menu category reorder
  // (CategoryList.tsx), simplified: no per-drag network round-trip since
  // zone order here is just local edit state until the whole form is saved.
  function handleZoneDragStart(id: string) {
    draggedZoneIdRef.current = id;
    setDraggedZoneId(id);
  }
  function handleZoneDragEnd() {
    draggedZoneIdRef.current = null;
    setDraggedZoneId(null);
    setDragOverZoneId(null);
  }
  function handleZoneDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (draggedZoneIdRef.current && overId !== draggedZoneIdRef.current) setDragOverZoneId(overId);
  }
  function handleZoneDrop(targetId: string) {
    const sourceId = draggedZoneIdRef.current;
    draggedZoneIdRef.current = null;
    setDraggedZoneId(null);
    setDragOverZoneId(null);
    if (!sourceId || sourceId === targetId) return;
    setZones((prev) => {
      const next = [...prev];
      const from = next.findIndex((z) => z.id === sourceId);
      const to = next.findIndex((z) => z.id === targetId);
      if (from === -1 || to === -1) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setSavedToast(false);
  }

  // Table drag reorder within the same zone card — display-only (no
  // ordering column on restaurant_tables in D5.2, see floorPlan.ts's
  // comment); dragging just re-sorts the on-screen list, it is never sent
  // to the server and does not affect `dirty`.
  const [displayOrderOverride, setDisplayOrderOverride] = useState<Record<string, string[]>>({});
  function handleTableDragStart(id: string) {
    draggedTableIdRef.current = id;
    setDraggedTableId(id);
  }
  function handleTableDragEnd() {
    draggedTableIdRef.current = null;
    setDraggedTableId(null);
    setDragOverTableId(null);
  }
  function handleTableDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (draggedTableIdRef.current && overId !== draggedTableIdRef.current) setDragOverTableId(overId);
  }
  function handleTableDrop(zoneId: string, orderedClientIds: string[], targetId: string) {
    const sourceId = draggedTableIdRef.current;
    draggedTableIdRef.current = null;
    setDraggedTableId(null);
    setDragOverTableId(null);
    if (!sourceId || sourceId === targetId) return;
    const next = [...orderedClientIds];
    const from = next.indexOf(sourceId);
    const to = next.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDisplayOrderOverride((prev) => ({ ...prev, [zoneId]: next }));
  }

  function handleCancel() {
    setZones(cloneZones(baseline.zones));
    setTables(cloneTables(baseline.tables));
    setFormError(null);
    setBlockedNames(null);
    setSavedToast(false);
    setDisplayOrderOverride({});
  }

  function buildPayload(): FloorSavePayload {
    return {
      zones: zones.map((z, index) => ({ id: z.id, name: z.name.trim(), display_order: index })),
      tables: tables.map((t) => ({
        id: t.id,
        zone_id: t.zoneId,
        label: t.label.trim(),
        seats: t.seats,
        is_bookable: t.isBookable,
        is_qr_enabled: t.isQrEnabled,
      })),
      deletedTableIds: baseline.tables
        .filter((bt) => bt.id !== null && !tables.some((t) => t.id === bt.id))
        .map((bt) => bt.id as string),
    };
  }

  async function handleSave() {
    if (!canSave) return;
    setFormError(null);
    setBlockedNames(null);

    const newTableClientIds = tables.filter((t) => t.id === null).map((t) => t.clientId);
    const result = await saveFloorPlan(buildPayload());

    if (result.ok) {
      const filledTables = tables.map((t) => {
        const idx = newTableClientIds.indexOf(t.clientId);
        return idx >= 0 && result.addedIds[idx] ? { ...t, id: result.addedIds[idx] } : t;
      });
      setTables(filledTables);
      setBaseline({ zones: cloneZones(zones), tables: cloneTables(filledTables) });
      setSavedToast(true);
    } else if (result.code === 'table_has_future_bookings') {
      setBlockedNames(result.blockedTableNames ?? []);
    } else {
      setFormError('saveFailed');
    }
  }

  const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
  const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;

  function tablesForZone(zoneId: string): EditableTable[] {
    const inZone = tables.filter((t) => t.zoneId === zoneId);
    const override = displayOrderOverride[zoneId];
    if (override) {
      const byId = new Map(inZone.map((t) => [t.clientId, t]));
      const ordered = override.map((id) => byId.get(id)).filter((t): t is EditableTable => Boolean(t));
      const missing = inZone.filter((t) => !override.includes(t.clientId));
      return [...ordered, ...missing];
    }
    return [...inZone].sort((a, b) => naturalCollator.compare(a.label, b.label));
  }

  return (
    <div className="pb-24">
      {savedToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-full shadow-[0_8px_24px_rgba(30,21,8,0.18)] px-4 py-2.5"
          data-testid="floor-saved-toast"
        >
          <span className="text-[13px] text-[#1e1508]" style={bodyStyle}>
            {t('savedToast')}
          </span>
        </div>
      )}

      {zones.map((zone) => {
        const zoneTables = tablesForZone(zone.id);
        return (
          <div
            key={zone.id}
            draggable
            onDragStart={() => handleZoneDragStart(zone.id)}
            onDragOver={(e) => handleZoneDragOver(e, zone.id)}
            onDragEnd={handleZoneDragEnd}
            onDrop={(e) => {
              e.preventDefault();
              handleZoneDrop(zone.id);
            }}
            data-testid={`floor-zone-${zone.id}`}
            className={
              'bg-white rounded-card p-5 mb-4 transition-colors' +
              (draggedZoneId === zone.id ? ' opacity-40' : '') +
              (dragOverZoneId === zone.id ? ' ring-2 ring-amber' : '')
            }
          >
            <div className="flex items-center gap-2 mb-3 tafel-tap cursor-move">
              <input
                type="text"
                value={zone.name}
                onChange={(e) => renameZone(zone.id, e.target.value)}
                disabled={pending}
                data-testid={`floor-zone-${zone.id}-name`}
                className="text-[16px] text-[#1e1508] bg-transparent border-b border-transparent focus:border-[#e7ddc9] focus:outline-none px-0.5"
                style={labelStyle}
              />
            </div>
            {zoneErrors[zone.id] && (
              <p className="mb-2 text-[12px] text-[#b3422f]" data-testid={`floor-zone-${zone.id}-error`}>
                {t(`errors.${zoneErrors[zone.id]}`)}
              </p>
            )}

            <div>
              {zoneTables.map((table) => (
                <FloorTableRow
                  key={table.clientId}
                  label={table.label}
                  seats={table.seats}
                  isBookable={table.isBookable}
                  isQrEnabled={table.isQrEnabled}
                  qrImagePath={table.qrImagePath}
                  onChangeLabel={(v) => updateTable(table.clientId, { label: v })}
                  onChangeSeats={(v) => updateTable(table.clientId, { seats: v })}
                  onChangeBookable={(v) => updateTable(table.clientId, { isBookable: v })}
                  onChangeQrEnabled={(v) => updateTable(table.clientId, { isQrEnabled: v })}
                  onDelete={() => deleteTable(table.clientId)}
                  disabled={pending}
                  error={tableErrors[table.clientId] ? t(`errors.${tableErrors[table.clientId]}`) : null}
                  testIdPrefix={`floor-table-${table.clientId}`}
                  draggable
                  dragging={draggedTableId === table.clientId}
                  dragOver={dragOverTableId === table.clientId}
                  onDragStart={() => handleTableDragStart(table.clientId)}
                  onDragOver={(e) => handleTableDragOver(e, table.clientId)}
                  onDragEnd={handleTableDragEnd}
                  onDrop={() =>
                    handleTableDrop(
                      zone.id,
                      zoneTables.map((t) => t.clientId),
                      table.clientId,
                    )
                  }
                  deleteConfirmMessage={t('row.deleteConfirm', { name: table.label || '' })}
                  nameLabel={t('row.nameLabel')}
                  namePlaceholder={t('row.namePlaceholder')}
                  capacityLabel={t('row.capacityLabel')}
                  bookableLabel={t('row.bookableLabel')}
                  qrLabel={t('row.qrLabel')}
                  qrNotGenerated={t('row.qrNotGenerated')}
                  deleteLabel={t('row.delete')}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => addTable(zone.id)}
              disabled={pending}
              data-testid={`floor-add-table-${zone.id}`}
              className="tafel-tap mt-3 px-4 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
              style={labelStyle}
            >
              {t('addTable')}
            </button>
          </div>
        );
      })}

      <div className="bg-white rounded-card p-4 mb-4 text-[12px] text-[#8c8577]" style={bodyStyle}>
        {t('row.bookableHelp')} {t('row.qrHelp')}
      </div>

      {blockedNames && blockedNames.length > 0 && (
        <p className="text-[13px] text-[#b3422f]" data-testid="floor-blocked-error">
          {t('errors.tableHasFutureBookings', { names: blockedNames.join(', ') })}
        </p>
      )}
      {formError && (
        <p className="text-[13px] text-[#b3422f]" data-testid="floor-form-error">
          {t(`errors.${formError}`)}
        </p>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[#f7f2e9] border-t border-[#e7ddc9] px-5 py-3 flex justify-end gap-2 z-40">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending || !dirty}
          data-testid="floor-cancel"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {t('actions.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="floor-save"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {pending ? t('actions.saving') : t('actions.save')}
        </button>
      </div>
    </div>
  );
}
