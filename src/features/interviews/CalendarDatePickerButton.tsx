import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { enUS, ru } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';
import { addLocalDays, startOfLocalDay } from './dateTime';
import { dayPickerClassNames } from './DateTimePickerField';

interface CalendarDatePickerButtonProps {
  value: Date;
  label: string;
  onChange: (value: Date) => void;
  ariaLabel: string;
  className?: string;
}

export const CalendarDatePickerButton: React.FC<CalendarDatePickerButtonProps> = ({
  value,
  label,
  onChange,
  ariaLabel,
  className = '',
}) => {
  const { i18n, t } = useTranslation();
  const buttonId = useId();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = startOfLocalDay(value);
  const locale = i18n.language?.startsWith('ru') ? ru : enUS;

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

  const choose = (date: Date) => {
    onChange(startOfLocalDay(date));
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      <button
        id={buttonId}
        type="button"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-white/[0.08] px-3 text-[12px] font-semibold text-text-secondary transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/60"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <CalendarDays size={14} className="flex-none text-text-tertiary" />
        <span className="min-w-0 truncate">{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-labelledby={buttonId}
          className="absolute left-1/2 top-[calc(100%+8px)] z-[80] w-[296px] -translate-x-1/2 rounded-md border border-white/[0.08] bg-[#0b0d0f] p-3 shadow-2xl shadow-black/45"
        >
          <DayPicker
            mode="single"
            locale={locale}
            selected={selected}
            onSelect={date => {
              if (date) choose(date);
            }}
            weekStartsOn={1}
            showOutsideDays
            fixedWeeks
            classNames={dayPickerClassNames}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => choose(new Date())}
              className="min-h-9 rounded-md border border-white/[0.08] text-[12px] font-semibold text-text-secondary transition hover:bg-white/[0.06] hover:text-white"
            >
              {t('interviews.today')}
            </button>
            <button
              type="button"
              onClick={() => choose(addLocalDays(new Date(), 1))}
              className="min-h-9 rounded-md border border-white/[0.08] text-[12px] font-semibold text-text-secondary transition hover:bg-white/[0.06] hover:text-white"
            >
              {t('interviews.tomorrow')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarDatePickerButton;
