import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { i18n, initI18n } from './i18n';
import {
  type InterfaceLanguageState,
  type InterfaceTranslationsSnapshot,
  resolveInterfaceLanguage,
} from './locales';

function applyDocumentLanguage(state: InterfaceLanguageState): void {
  document.documentElement.lang = state.resolvedLanguage;
  document.documentElement.dataset.interfaceLanguage = state.preference;
}

function applyTranslationResources(snapshot?: InterfaceTranslationsSnapshot | null): void {
  if (!snapshot?.resources) return;
  for (const [language, bundle] of Object.entries(snapshot.resources)) {
    if (!bundle || typeof bundle !== 'object') continue;
    i18n.addResourceBundle(language, 'translation', bundle, true, true);
  }
}

async function applyInterfaceLanguage(state: InterfaceLanguageState): Promise<void> {
  const resolvedLanguage = resolveInterfaceLanguage(state.preference, state.systemLanguage);
  const nextState = { ...state, resolvedLanguage: state.resolvedLanguage || resolvedLanguage };
  applyDocumentLanguage(nextState);
  if (i18n.language !== nextState.resolvedLanguage) {
    await i18n.changeLanguage(nextState.resolvedLanguage);
  }
}

export function InterfaceI18nProvider({ children }: { children: React.ReactNode }) {
  initI18n();

  useEffect(() => {
    let cancelled = false;

    const apply = (state: InterfaceLanguageState) => {
      if (cancelled) return;
      void applyInterfaceLanguage(state).catch((error) => {
        console.warn('[i18n] Failed to apply interface language:', error);
      });
    };

    const fallbackState: InterfaceLanguageState = {
      preference: 'system',
      resolvedLanguage: resolveInterfaceLanguage('system', navigator.language),
      systemLanguage: navigator.language,
    };
    applyDocumentLanguage(fallbackState);

    Promise.all([
      window.electronAPI?.getInterfaceTranslations?.().catch(() => null),
      window.electronAPI?.getInterfaceLanguage?.().catch(() => null),
    ]).then(([snapshot, state]) => {
        applyTranslationResources(snapshot);
        if (state) {
          apply(state);
        } else {
          apply(fallbackState);
        }
      })
      .catch(() => {
        apply(fallbackState);
      });

    const unsubscribeLanguage = window.electronAPI?.onInterfaceLanguageChanged?.(apply);
    const unsubscribeTranslations = window.electronAPI?.onInterfaceTranslationsChanged?.((snapshot) => {
      applyTranslationResources(snapshot);
      window.electronAPI?.getInterfaceLanguage?.()
        .then((state) => {
          if (state) apply(state);
        })
        .catch(() => {
          apply(fallbackState);
        });
    });

    return () => {
      cancelled = true;
      unsubscribeLanguage?.();
      unsubscribeTranslations?.();
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
