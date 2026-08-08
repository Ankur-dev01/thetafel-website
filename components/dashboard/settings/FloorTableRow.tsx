'use client';

type FloorTableRowProps = {
  label: string;
  seats: number;
  isBookable: boolean;
  isQrEnabled: boolean;
  qrImagePath: string | null;
  onChangeLabel: (next: string) => void;
  onChangeSeats: (next: number) => void;
  onChangeBookable: (next: boolean) => void;
  onChangeQrEnabled: (next: boolean) => void;
  onDelete: () => void;
  disabled: boolean;
  error?: string | null;
  testIdPrefix: string;
  draggable: boolean;
  dragging: boolean;
  dragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  deleteConfirmMessage: string;
  nameLabel: string;
  namePlaceholder: string;
  capacityLabel: string;
  bookableLabel: string;
  qrLabel: string;
  qrNotGenerated: string;
  deleteLabel: string;
};

const labelClass = 'block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1';
const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const inputClass =
  'w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-50';
const inputStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;

export default function FloorTableRow({
  label,
  seats,
  isBookable,
  isQrEnabled,
  qrImagePath,
  onChangeLabel,
  onChangeSeats,
  onChangeBookable,
  onChangeQrEnabled,
  onDelete,
  disabled,
  error,
  testIdPrefix,
  draggable,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  deleteConfirmMessage,
  nameLabel,
  namePlaceholder,
  capacityLabel,
  bookableLabel,
  qrLabel,
  qrNotGenerated,
  deleteLabel,
}: FloorTableRowProps) {
  function handleDelete() {
    if (window.confirm(deleteConfirmMessage)) onDelete();
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      data-testid={testIdPrefix}
      className={
        'py-3 border-b border-[#f0e8d8] last:border-b-0 rounded-lg px-1 transition-colors' +
        (dragging ? ' opacity-40' : '') +
        (dragOver ? ' ring-2 ring-amber' : '')
      }
    >
      <div className="flex items-end gap-3 flex-wrap">
        <div className="w-[140px]">
          <label className={labelClass} style={labelStyle}>
            {nameLabel}
          </label>
          <input
            type="text"
            value={label}
            placeholder={namePlaceholder}
            onChange={(e) => onChangeLabel(e.target.value)}
            disabled={disabled}
            data-testid={`${testIdPrefix}-label`}
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div className="w-[90px]">
          <label className={labelClass} style={labelStyle}>
            {capacityLabel}
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={seats}
            onChange={(e) => onChangeSeats(Number(e.target.value))}
            disabled={disabled}
            data-testid={`${testIdPrefix}-seats`}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <label className="flex items-center gap-1.5 tafel-tap pb-2">
          <input
            type="checkbox"
            checked={isBookable}
            onChange={(e) => onChangeBookable(e.target.checked)}
            disabled={disabled}
            data-testid={`${testIdPrefix}-bookable`}
            className="w-4 h-4 accent-amber"
          />
          <span className="text-[13px] text-[#6f6353]" style={inputStyle}>
            {bookableLabel}
          </span>
        </label>

        <div className="pb-2">
          <label className="flex items-center gap-1.5 tafel-tap">
            <input
              type="checkbox"
              checked={isQrEnabled}
              onChange={(e) => onChangeQrEnabled(e.target.checked)}
              disabled={disabled}
              data-testid={`${testIdPrefix}-qr-enabled`}
              className="w-4 h-4 accent-amber"
            />
            <span className="text-[13px] text-[#6f6353]" style={inputStyle}>
              {qrLabel}
            </span>
          </label>
          {qrImagePath === null && (
            <p className="mt-0.5 text-[11px] text-[#8c8577]" data-testid={`${testIdPrefix}-qr-not-generated`}>
              {qrNotGenerated}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={disabled}
          data-testid={`${testIdPrefix}-delete`}
          className="tafel-tap ml-auto mb-2 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.06em] bg-[#f7e8e6] text-[#b3422f] disabled:opacity-50"
          style={labelStyle}
        >
          {deleteLabel}
        </button>
      </div>
      {error && (
        <p className="mt-1 text-[12px] text-[#b3422f]" data-testid={`${testIdPrefix}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
