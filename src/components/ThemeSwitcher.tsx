import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { getThemePreference, setThemePreference, subscribeTheme } from '@/lib/theme';

const options = [
  { value: 'system', label: '跟随系统', Icon: Monitor },
  { value: 'light', label: '明亮模式', Icon: Sun },
  { value: 'dark', label: '黑暗模式', Icon: Moon },
] as const;

export default function ThemeSwitcher() {
  const preference = useSyncExternalStore(subscribeTheme, getThemePreference);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = options.find(option => option.value === preference)!;

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="theme-switcher" ref={rootRef} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={buttonRef} type="button" className="btn-ghost !px-3 !py-2 text-xs" aria-label={`切换主题，当前：${current.label}`} aria-expanded={open} title={`切换主题，当前：${current.label}`} onClick={() => setOpen(value => !value)}>
        <current.Icon size={16} aria-hidden="true" />
        <span className="hidden sm:inline">主题</span>
      </button>
      {open && (
        <div className="theme-options" role="group" aria-label="选择主题">
          {options.map(({ value, label, Icon }) => (
            <button key={value} type="button" aria-pressed={preference === value} onClick={() => {
              setThemePreference(value);
              setOpen(false);
              buttonRef.current?.focus();
            }}>
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
              {preference === value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
