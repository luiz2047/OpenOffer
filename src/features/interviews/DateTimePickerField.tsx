import React, { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { CalendarDays, Clock3, X } from 'lucide-react';
import { DayFlag, DayPicker, SelectionState, UI } from 'react-day-picker';
import { enUS, ru } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
import {
  dateTimePartsFromEpoch,
  epochFromLocalDateAndTime,
  formatDateTimeLabel,
  isValidLocalTime,
} from './dateTime';

interface DateTimePickerFieldProps {
  value?: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}

export const dayPickerClassNames = {
  [UI.Root]: 'relative text-[12px] text-text-primary',
  [UI.Months]: 'flex',
  [UI.Month]: 'w-full',
  [UI.MonthCaption]: 'flex h-9 items-center justify-center',
  [UI.CaptionLabel]: 'text-[13px] font-semibold text-text-primary',
  [UI.Nav]: 'absolute left-0 right-0 top-0 flex h-9 items-center justify-between',
  [UI.PreviousMonthButton]: 'inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30',
  [UI.NextMonthButton]: 'inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30',
  [UI.Chevron]: 'h-4 w-4 fill-current',
  [UI.MonthGrid]: 'mt-2 w-full border-separate border-spacing-y-1',
  [UI.Weekdays]: 'grid grid-cols-7',
  [UI.Weekday]: 'flex h-7 items-center justify-center text-[10px] font-semibold uppercase text-zinc-500',
  [UI.Week]: 'grid grid-cols-7',
  [UI.Day]: 'flex h-8 w-8 items-center justify-center',
  [UI.DayButton]: 'h-8 w-8 rounded-md text-[12px] text-text-secondary transition hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60',
  [SelectionState.selected]: '[&>button]:bg-cyan-300 [&>button]:font-semibold [&>button]:text-black [&>button]:hover:bg-cyan-200 [&>button]:hover:text-black',
  [DayFlag.today]: '[&>button]:text-cyan-200',
  [DayFlag.outside]: '[&>button]:text-zinc-600',
  [DayFlag.disabled]: 'opacity-35',
};

export const DateTimePickerField: React.FC<DateTimePickerFieldProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
}) => {
  const { i18n, t } = useTranslation();
  const buttonId = useId();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | null>(() => dateTimePartsFromEpoch(value).date);
  const [draftTime, setDraftTime] = useState(() => dateTimePartsFromEpoch(value).time);
  const locale = i18n.language?.startsWith('ru') ? ru : enUS;
  const label = formatDateTimeLabel(value, i18n.language) || placeholder || t('interviews.dateTime.noDate');
  const canApply = Boolean(draftDate && isValidLocalTime(draftTime));

  useEffect(() => {
    if (open) return;
    const next = dateTimePartsFromEpoch(value);
    setDraftDate(next.date);
    setDraftTime(next.time);
  }, [open, value]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const openPicker = () => {
    const next = dateTimePartsFromEpoch(value);
    setDraftDate(next.date);
    setDraftTime(next.time);
    setOpen(true);
  };

  const applyDraft = () => {
    if (!canApply) return;
    const nextValue = epochFromLocalDateAndTime(draftDate, draftTime);
    flushSync(() => setOpen(false));
    onChange(nextValue);
  };

  const clearDraft = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border bg-[#090b0d] px-3 py-2.5 text-left text-[13px] outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-50 ${
          invalid ? 'border-rose-400/60 text-rose-100' : 'border-white/[0.08] text-text-primary hover:border-cyan-300/35 hover:bg-black/30'
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{label}</span>
        <CalendarDays size={16} className="flex-none text-text-tertiary" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-labelledby={buttonId}
          data-testid="date-time-picker-popover"
          className="absolute left-0 top-[calc(100%+8px)] z-[80] w-[296px] rounded-md border border-white/[0.08] bg-bg-card p-3 shadow-2xl shadow-black/45"
        >
          <DayPicker
            mode="single"
            locale={locale}
            selected={draftDate ?? undefined}
            onSelect={date => {
              if (date) setDraftDate(date);
            }}
            weekStartsOn={1}
            showOutsideDays
            fixedWeeks
            classNames={dayPickerClassNames}
          />
          <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
            <label className="flex min-h-10 flex-1 items-center gap-2 rounded-md border border-white/[0.08] bg-bg-input px-2.5 text-[12px] text-text-secondary">
              <Clock3 size={14} className="text-text-tertiary" />
              <span className="sr-only">{t('interviews.dateTime.time')}</span>
              <input
                type="time"
                step={300}
                value={draftTime}
                onChange={event => setDraftTime(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-text-primary outline-none"
              />
            </label>
            <button
              type="button"
              onClick={clearDraft}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] text-text-secondary transition hover:bg-white/[0.06] hover:text-white"
              title={t('interviews.dateTime.clear')}
            >
              <X size={15} />
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={applyDraft}
              disabled={!canApply}
              data-testid="date-time-picker-apply"
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-3 text-[12px] font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('interviews.dateTime.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTimePickerField;
