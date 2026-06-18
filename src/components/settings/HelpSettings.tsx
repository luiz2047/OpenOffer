import React from 'react';
import {
    Brain,
    Calendar,
    Command,
    ExternalLink,
    FileText,
    Ghost,
    Key,
    Mic,
    Monitor,
    Settings,
    Smartphone,
    Sparkles,
    User,
    Wifi,
    Zap,
} from 'lucide-react';
import { useShortcuts } from '../../hooks/useShortcuts';

type HelpSection = {
    title: string;
    icon: React.ReactNode;
    points: string[];
};

const formatShortcut = (value?: string | string[]) => {
    if (Array.isArray(value)) return value.length ? value.join(' / ') : 'Не задано';
    return value || 'Не задано';
};

const ShortcutRow = ({ label, value }: { label: string; value?: string | string[] }) => (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-item-surface px-3 py-2">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="rounded-md border border-border-subtle bg-bg-input px-2 py-1 font-mono text-xs text-text-primary">
            {formatShortcut(value)}
        </span>
    </div>
);

export const HelpSettings: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
    const { shortcuts } = useShortcuts();

    const sections: HelpSection[] = [
        {
            title: 'Быстрый старт',
            icon: <Zap size={16} />,
            points: [
                'Подключите AI-провайдера в настройках, затем выберите модель по умолчанию.',
                'В Audio выберите STT-провайдера, язык речи, микрофон и устройство вывода.',
                'Проверьте системные разрешения на запись экрана, микрофон и Accessibility для глобальных хоткеев.',
                'Запустите встречу и используйте быстрые действия: что ответить, уточнить, рекап, follow-up и ответ.',
            ],
        },
        {
            title: 'Разрешения',
            icon: <Monitor size={16} />,
            points: [
                'Разрешение на запись экрана нужно для скриншотов и анализа текущего экрана.',
                'Accessibility нужен для глобальных хоткеев и stealth typing на macOS.',
                'Microphone нужен для захвата вашей речи; системное аудио используется для речи собеседника.',
            ],
        },
        {
            title: 'Аудио и STT',
            icon: <Mic size={16} />,
            points: [
                'Можно использовать облачные STT-провайдеры или локальные варианты Local Whisper и GigaSTT.',
                'Для точности выберите основной язык встречи и региональный вариант, если он доступен.',
                'Перед live-встречей проверьте подключение провайдера и тестовый звук.',
            ],
        },
        {
            title: 'AI-провайдеры',
            icon: <Brain size={16} />,
            points: [
                'Cloud-провайдеры требуют API-ключи; локальные провайдеры работают через Ollama или Codex CLI.',
                'Режим быстрых ответов использует Groq или быструю модель Codex CLI для короткой задержки.',
                'Для пользовательских эндпоинтов добавьте cURL-шаблон и JSON-путь ответа.',
            ],
        },
        {
            title: 'Профиль и JD',
            icon: <User size={16} />,
            points: [
                'Профильный интеллект строит персону по резюме и может учитывать активное описание вакансии.',
                'Custom Context подходит для фактов, цифр, предпочтений и подготовленных тезисов.',
                'Company research использует Tavily, если API-ключ добавлен; без него применяется только знание LLM.',
            ],
        },
        {
            title: 'Режимы и заметки',
            icon: <FileText size={16} />,
            points: [
                'Modes задают специализированную AI-персону для продаж, интервью, стендапов и других сценариев.',
                'К режиму можно прикреплять reference-файлы и шаблоны секций заметок.',
                'Активный режим влияет на ответы и итоговые заметки встречи.',
            ],
        },
        {
            title: 'Календарь и follow-up',
            icon: <Calendar size={16} />,
            points: [
                'Подключите Google Calendar, чтобы OpenOffer видел предстоящие встречи.',
                'Из карточки события можно открыть ссылку встречи в системном браузере.',
                'После встречи можно сгенерировать follow-up письмо по транскрипту и заметкам.',
            ],
        },
        {
            title: 'Phone Mirror и browser extension',
            icon: <Smartphone size={16} />,
            points: [
                'Phone Mirror показывает live-транскрипт и ответы на телефоне через QR-ссылку.',
                'LAN-доступ включайте только в доверенной сети; при сомнениях ротируйте токен.',
                'Browser extension отправляет контекст активной вкладки в desktop-приложение.',
            ],
        },
        {
            title: 'Stealth и управление окном',
            icon: <Ghost size={16} />,
            points: [
                'Undetectable mode и прозрачность помогают уменьшить визуальный след интерфейса.',
                'Mouse passthrough оставляет оверлей видимым, но пропускает клики в приложение под ним.',
                'После включения passthrough управляйте OpenOffer через глобальные горячие клавиши.',
            ],
        },
    ];

    return (
        <div className="space-y-6 pb-10">
            <div className="rounded-2xl border border-border-subtle bg-bg-item-surface p-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-input text-accent-primary">
                        <Command size={18} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-text-primary">Справка OpenOffer</h3>
                        <p className="text-sm text-text-secondary">Краткий ориентир по настройке, встречам, режимам и приватности.</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {sections.map((section) => (
                    <section key={section.title} className="rounded-xl border border-border-subtle bg-bg-item-surface p-4">
                        <div className="mb-3 flex items-center gap-2 text-text-primary">
                            <span className="text-accent-primary">{section.icon}</span>
                            <h4 className="text-sm font-bold">{section.title}</h4>
                        </div>
                        <ul className="space-y-2">
                            {section.points.map((point) => (
                                <li key={point} className="flex gap-2 text-xs leading-relaxed text-text-secondary">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary/70" />
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>

            <section className="rounded-xl border border-border-subtle bg-bg-item-surface p-4">
                <div className="mb-3 flex items-center gap-2 text-text-primary">
                    <Key size={16} className="text-accent-primary" />
                    <h4 className="text-sm font-bold">Основные горячие клавиши</h4>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                    <ShortcutRow label="Показать / скрыть интерфейс" value={shortcuts.toggleVisibility} />
                    <ShortcutRow label="Снять экран и спросить AI" value={shortcuts.captureAndProcess} />
                    <ShortcutRow label="Обработать скриншоты" value={shortcuts.processScreenshots} />
                    <ShortcutRow label="Сделать скриншот" value={shortcuts.takeScreenshot} />
                    <ShortcutRow label="Что ответить" value={shortcuts.whatToAnswer} />
                    <ShortcutRow label="Ответ / запись" value={shortcuts.answer} />
                </div>
            </section>

            <section className="rounded-xl border border-border-subtle bg-bg-item-surface p-4">
                <div className="mb-2 flex items-center gap-2 text-text-primary">
                    <Wifi size={16} className="text-accent-primary" />
                    <h4 className="text-sm font-bold">Полезные ссылки</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => window.electronAPI?.openExternal?.('https://ollama.com/download')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated"
                    >
                        Ollama <ExternalLink size={12} />
                    </button>
                    <button
                        type="button"
                        onClick={() => window.electronAPI?.openExternal?.('https://app.tavily.com/home')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated"
                    >
                        Tavily <ExternalLink size={12} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate ? onNavigate('ai-providers') : window.electronAPI?.openSettingsTab?.('ai-providers')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated"
                    >
                        <Settings size={12} /> AI-провайдеры
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate ? onNavigate('audio') : window.electronAPI?.openSettingsTab?.('audio')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated"
                    >
                        <Mic size={12} /> Аудио
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate ? onNavigate('profile') : window.electronAPI?.openSettingsTab?.('profile')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated"
                    >
                        <Sparkles size={12} /> Профиль
                    </button>
                </div>
            </section>
        </div>
    );
};
