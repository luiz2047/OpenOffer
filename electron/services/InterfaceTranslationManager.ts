import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { resources } from '../../src/i18n/resources';
import {
  CUSTOM_TRANSLATIONS_DIR_NAME,
  scanInterfaceTranslationPacks,
  type InterfaceTranslationsSnapshot,
} from './InterfaceTranslationPacks';

export class InterfaceTranslationManager {
  private static instance: InterfaceTranslationManager;

  public static getInstance(): InterfaceTranslationManager {
    if (!InterfaceTranslationManager.instance) {
      InterfaceTranslationManager.instance = new InterfaceTranslationManager();
    }
    return InterfaceTranslationManager.instance;
  }

  public getTranslationsPath(): string {
    return path.join(app.getPath('userData'), CUSTOM_TRANSLATIONS_DIR_NAME);
  }

  public getSnapshot(): InterfaceTranslationsSnapshot {
    const translationsPath = this.getTranslationsPath();
    fs.mkdirSync(translationsPath, { recursive: true });
    return scanInterfaceTranslationPacks(translationsPath, resources);
  }

  public async openTranslationsFolder(): Promise<{ success: boolean; path: string; error?: string }> {
    const translationsPath = this.getTranslationsPath();
    fs.mkdirSync(translationsPath, { recursive: true });
    const error = await shell.openPath(translationsPath);
    return {
      success: !error,
      path: translationsPath,
      error: error || undefined,
    };
  }
}
