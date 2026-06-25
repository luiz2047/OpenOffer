import type {
  CalendarCreateEventInput,
  CalendarEvent,
} from './CalendarManager';
import { SettingsManager } from './SettingsManager';
import type {
  CalendarProviderId,
  CalendarProviderStatus,
  CalendarRefreshProviderResult,
  CalendarRefreshResult,
  CalendarStatusResult,
} from '../../src/types/interviews';

interface GoogleCalendarSource {
  isProxyConfigured(): boolean;
  isClientConfigured?: () => boolean;
  getConnectionStatus(): { connected: boolean; email?: string; lastSync?: number; disabled?: boolean; reason?: string };
  getUpcomingEvents(force?: boolean, options?: { throwOnError?: boolean }): Promise<CalendarEvent[]>;
  createEvent(input: CalendarCreateEventInput): Promise<CalendarEvent>;
}

interface MacCalendarSource {
  isAvailable(): boolean;
  getUpcomingEvents(options?: { throwOnError?: boolean }): Promise<CalendarEvent[]>;
  createEvent(input: CalendarCreateEventInput): Promise<CalendarEvent>;
}

interface CalendarSettingsStore {
  get(key: 'calendarPreferredProvider'): CalendarProviderId | null | undefined;
  set(key: 'calendarPreferredProvider', value: CalendarProviderId | null): void;
}

export interface CalendarProviderCoordinatorDeps {
  google?: GoogleCalendarSource;
  macos?: MacCalendarSource;
  settings?: CalendarSettingsStore | null;
  now?: () => number;
}

function isCalendarProviderId(value: unknown): value is CalendarProviderId {
  return value === 'google' || value === 'macos';
}

export class CalendarProviderCoordinator {
  private static instance: CalendarProviderCoordinator;
  private readonly deps: CalendarProviderCoordinatorDeps;
  private readonly lastSyncAt: Partial<Record<CalendarProviderId, number>> = {};
  private readonly lastErrorCode: Partial<Record<CalendarProviderId, string | null>> = {};
  private macosProbeSucceeded = false;

  constructor(deps: CalendarProviderCoordinatorDeps = {}) {
    this.deps = deps;
  }

  public static getInstance(): CalendarProviderCoordinator {
    if (!CalendarProviderCoordinator.instance) {
      CalendarProviderCoordinator.instance = new CalendarProviderCoordinator();
    }
    return CalendarProviderCoordinator.instance;
  }

  public getStatus(): CalendarStatusResult {
    const providers = [this.googleStatus(), this.macosStatus()];
    const preferredProvider = this.resolvePreferredProvider(providers);
    const connected = providers.some(provider => provider.readCapability === 'yes');
    const email = providers.find(provider => provider.accountLabel)?.accountLabel;
    return { providers, preferredProvider, connected, email };
  }

  public setPreferredProvider(provider: CalendarProviderId | null): CalendarStatusResult {
    this.settings()?.set('calendarPreferredProvider', provider);
    return this.getStatus();
  }

  public async refresh(): Promise<CalendarRefreshResult> {
    const providers = await Promise.all([
      this.refreshGoogle(),
      this.refreshMacos(),
    ]);
    return {
      refreshedAt: this.now(),
      providers,
      status: this.getStatus(),
    };
  }

  public async getUpcomingEvents(): Promise<CalendarEvent[]> {
    const [googleEvents, macosEvents] = await Promise.all([
      this.safeReadGoogle(),
      this.safeReadMacos(),
    ]);
    return [...googleEvents, ...macosEvents].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }

  public async createEvent(
    provider: CalendarProviderId | null | undefined,
    input: CalendarCreateEventInput,
  ): Promise<CalendarEvent> {
    const targetProvider = provider ?? this.getStatus().preferredProvider;
    if (!targetProvider) {
      throw new Error('No writable calendar provider is available.');
    }
    if (targetProvider === 'google') {
      const status = this.googleStatus();
      if (status.writeCapability !== 'yes') {
        throw new Error(status.lastErrorCode || 'Google Calendar is not ready for writes.');
      }
      const event = await this.google().createEvent(input);
      this.recordSuccess('google');
      return event;
    }

    const status = this.macosStatus();
    if (status.writeCapability === 'no') {
      throw new Error(status.lastErrorCode || 'macOS Calendar is not available.');
    }
    try {
      const event = await this.macos().createEvent(input);
      this.recordSuccess('macos');
      this.macosProbeSucceeded = true;
      return event;
    } catch (error) {
      const code = this.classifyError('macos', error);
      this.recordFailure('macos', code);
      throw error;
    }
  }

  private async refreshGoogle(): Promise<CalendarRefreshProviderResult> {
    const status = this.googleStatus();
    if (status.readCapability !== 'yes') {
      return { provider: 'google', ok: false, errorCode: status.lastErrorCode || status.state };
    }
    try {
      const events = await this.google().getUpcomingEvents(true, { throwOnError: true });
      this.recordSuccess('google');
      return { provider: 'google', ok: true, eventCount: events.length };
    } catch (error) {
      const code = this.classifyError('google', error);
      this.recordFailure('google', code);
      return { provider: 'google', ok: false, errorCode: code };
    }
  }

  private async refreshMacos(): Promise<CalendarRefreshProviderResult> {
    const status = this.macosStatus();
    if (status.state === 'unavailable') {
      return { provider: 'macos', ok: false, errorCode: status.lastErrorCode || 'unavailable' };
    }
    try {
      const events = await this.macos().getUpcomingEvents({ throwOnError: true });
      this.recordSuccess('macos');
      this.macosProbeSucceeded = true;
      return { provider: 'macos', ok: true, eventCount: events.length };
    } catch (error) {
      const code = this.classifyError('macos', error);
      this.recordFailure('macos', code);
      return { provider: 'macos', ok: false, errorCode: code };
    }
  }

  private async safeReadGoogle(): Promise<CalendarEvent[]> {
    if (this.googleStatus().readCapability !== 'yes') return [];
    try {
      const events = await this.google().getUpcomingEvents(false, { throwOnError: true });
      this.recordSuccess('google');
      return events;
    } catch (error) {
      this.recordFailure('google', this.classifyError('google', error));
      return [];
    }
  }

  private async safeReadMacos(): Promise<CalendarEvent[]> {
    if (this.macosStatus().state === 'unavailable') return [];
    try {
      const events = await this.macos().getUpcomingEvents({ throwOnError: true });
      this.recordSuccess('macos');
      this.macosProbeSucceeded = true;
      return events;
    } catch (error) {
      this.recordFailure('macos', this.classifyError('macos', error));
      return [];
    }
  }

  private googleStatus(): CalendarProviderStatus {
    const google = this.google();
    const status = google.getConnectionStatus();
    const clientConfigured = google.isClientConfigured ? google.isClientConfigured() : true;
    if (!google.isProxyConfigured() || !clientConfigured || status.disabled) {
      return {
        provider: 'google',
        state: 'needs_setup',
        labelKey: 'settings.calendar.providers.google',
        detailKey: 'settings.calendar.providerDetails.googleNeedsSetup',
        lastSyncAt: this.lastSyncAt.google ?? null,
        lastErrorCode: this.lastErrorCode.google ?? null,
        readCapability: 'no',
        writeCapability: 'no',
        canConnect: false,
      };
    }
    if (status.connected) {
      return {
        provider: 'google',
        state: 'connected',
        labelKey: 'settings.calendar.providers.google',
        detailKey: 'settings.calendar.providerDetails.googleConnected',
        accountLabel: status.email,
        lastSyncAt: this.lastSyncAt.google ?? status.lastSync ?? null,
        lastErrorCode: this.lastErrorCode.google ?? null,
        readCapability: 'yes',
        writeCapability: 'yes',
        canConnect: true,
      };
    }
    return {
      provider: 'google',
      state: 'needs_setup',
      labelKey: 'settings.calendar.providers.google',
      detailKey: 'settings.calendar.providerDetails.googleNeedsConnection',
      lastSyncAt: this.lastSyncAt.google ?? null,
      lastErrorCode: this.lastErrorCode.google ?? null,
      readCapability: 'no',
      writeCapability: 'no',
      canConnect: true,
    };
  }

  private macosStatus(): CalendarProviderStatus {
    const macos = this.macos();
    if (!macos.isAvailable()) {
      return {
        provider: 'macos',
        state: 'unavailable',
        labelKey: 'settings.calendar.providers.macos',
        detailKey: 'settings.calendar.providerDetails.macosUnavailable',
        lastSyncAt: this.lastSyncAt.macos ?? null,
        lastErrorCode: this.lastErrorCode.macos ?? null,
        readCapability: 'no',
        writeCapability: 'no',
        canConnect: false,
      };
    }
    const lastError = this.lastErrorCode.macos ?? null;
    const denied = lastError === 'permission_denied';
    const state = denied
      ? 'permission_denied'
      : this.macosProbeSucceeded
        ? 'available'
        : 'permission_unknown';
    return {
      provider: 'macos',
      state,
      labelKey: 'settings.calendar.providers.macos',
      detailKey: denied
        ? 'settings.calendar.providerDetails.macosPermissionDenied'
        : this.macosProbeSucceeded
          ? 'settings.calendar.providerDetails.macosAvailable'
          : 'settings.calendar.providerDetails.macosPermissionUnknown',
      lastSyncAt: this.lastSyncAt.macos ?? null,
      lastErrorCode: lastError,
      readCapability: denied ? 'no' : this.macosProbeSucceeded ? 'yes' : 'unknown',
      writeCapability: denied ? 'no' : this.macosProbeSucceeded ? 'yes' : 'unknown',
      canConnect: false,
    };
  }

  private resolvePreferredProvider(providers: CalendarProviderStatus[]): CalendarProviderId | null {
    const stored = this.settings()?.get('calendarPreferredProvider');
    if (isCalendarProviderId(stored) && this.providerCanWrite(providers, stored)) return stored;
    const macos = providers.find(provider => provider.provider === 'macos');
    if (macos && (macos.state === 'available' || macos.state === 'permission_unknown')) return 'macos';
    const google = providers.find(provider => provider.provider === 'google');
    if (google?.state === 'connected') return 'google';
    return null;
  }

  private providerCanWrite(providers: CalendarProviderStatus[], providerId: CalendarProviderId): boolean {
    const provider = providers.find(item => item.provider === providerId);
    return provider?.writeCapability === 'yes' || provider?.writeCapability === 'unknown';
  }

  private recordSuccess(provider: CalendarProviderId): void {
    this.lastSyncAt[provider] = this.now();
    this.lastErrorCode[provider] = null;
  }

  private recordFailure(provider: CalendarProviderId, code: string): void {
    this.lastErrorCode[provider] = code;
  }

  private classifyError(provider: CalendarProviderId, error: unknown): string {
    const message = String((error as any)?.message || error || '');
    if (/not connected|token|client id|proxy|configured/i.test(message)) return 'needs_setup';
    if (/permission|not authorized|operation not permitted|automation/i.test(message)) return 'permission_denied';
    if (/timeout|timed out|AbortError/i.test(message)) return 'timeout';
    if (/only available|unavailable/i.test(message)) return 'unavailable';
    return provider === 'google' ? 'calendar_refresh_failed' : 'provider_unavailable';
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  private settings(): CalendarSettingsStore | null {
    if ('settings' in this.deps) return this.deps.settings ?? null;
    try {
      return SettingsManager.getInstance() as unknown as CalendarSettingsStore;
    } catch {
      return null;
    }
  }

  private google(): GoogleCalendarSource {
    if (this.deps.google) return this.deps.google;
    return require('./CalendarManager').CalendarManager.getInstance();
  }

  private macos(): MacCalendarSource {
    if (this.deps.macos) return this.deps.macos;
    return require('./MacCalendarManager').MacCalendarManager.getInstance();
  }
}
