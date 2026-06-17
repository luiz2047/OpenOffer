import { execFile } from 'child_process';
import { promisify } from 'util';
import type { CalendarEvent } from './CalendarManager';

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 4_000;

const MAC_CALENDAR_JXA = `
ObjC.import('stdlib');

function asDate(value) {
  try {
    if (!value) return null;
    var date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch (_) {
    return null;
  }
}

function stringValue(value, fallback) {
  try {
    if (value === null || value === undefined) return fallback;
    return String(value);
  } catch (_) {
    return fallback;
  }
}

function eventId(calendarName, event, startDate, title) {
  try {
    if (typeof event.uid === 'function') {
      var uid = event.uid();
      if (uid) return 'macos:' + String(uid);
    }
  } catch (_) {}
  try {
    if (typeof event.id === 'function') {
      var id = event.id();
      if (id) return 'macos:' + String(id);
    }
  } catch (_) {}
  return 'macos:' + calendarName + ':' + startDate.toISOString() + ':' + title;
}

var startMs = Number($.getenv('OPENOFFER_MAC_CALENDAR_START_MS'));
var endMs = Number($.getenv('OPENOFFER_MAC_CALENDAR_END_MS'));
var start = new Date(startMs);
var end = new Date(endMs);
var result = [];
var Calendar = Application('Calendar');
Calendar.includeStandardAdditions = true;

Calendar.calendars().forEach(function(calendar) {
  var calendarName = stringValue(calendar.name(), 'Calendar');
  try {
    calendar.events().forEach(function(event) {
      var startDate = asDate(event.startDate());
      var endDate = asDate(event.endDate());
      if (!startDate || !endDate) return;
      if (startDate < start || startDate > end) return;
      if ((endDate.getTime() - startDate.getTime()) < 5 * 60 * 1000) return;
      var title = stringValue(event.summary(), '(No Title)');
      var notes = '';
      try { notes = stringValue(event.description(), ''); } catch (_) {}
      var url = '';
      try { url = stringValue(event.url(), ''); } catch (_) {}
      result.push({
        id: eventId(calendarName, event, startDate, title),
        title: title,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        link: url || undefined,
        source: 'macos',
        calendarName: calendarName,
        notes: notes
      });
    });
  } catch (_) {}
});

JSON.stringify(result);
`;

export class MacCalendarManager {
  private static instance: MacCalendarManager;

  public static getInstance(): MacCalendarManager {
    if (!MacCalendarManager.instance) {
      MacCalendarManager.instance = new MacCalendarManager();
    }
    return MacCalendarManager.instance;
  }

  public isAvailable(): boolean {
    return process.platform === 'darwin';
  }

  public async getUpcomingEvents(): Promise<CalendarEvent[]> {
    if (!this.isAvailable()) return [];

    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    try {
      const { stdout } = await execFileAsync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', MAC_CALENDAR_JXA], {
        timeout: DEFAULT_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          OPENOFFER_MAC_CALENDAR_START_MS: String(now.getTime()),
          OPENOFFER_MAC_CALENDAR_END_MS: String(horizon.getTime()),
        },
      });
      const parsed = JSON.parse(stdout.trim() || '[]') as Array<CalendarEvent & { notes?: string }>;
      return parsed
        .map(event => ({
          id: event.id,
          title: event.title || '(No Title)',
          startTime: event.startTime,
          endTime: event.endTime,
          link: event.link || this.extractMeetingLink(event.notes || ''),
          source: 'macos' as const,
          attendees: [] as NonNullable<CalendarEvent['attendees']>,
        }))
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    } catch (error: any) {
      console.warn('[MacCalendarManager] macOS Calendar read failed:', error?.message || error);
      return [];
    }
  }

  private extractMeetingLink(text: string): string | undefined {
    const matches = text.match(/https?:\/\/(?:[a-z0-9-]+\.)?(?:zoom\.us|teams\.microsoft\.com|meet\.google\.com|webex\.com)\/[^\s<>"']+/i);
    return matches?.[0];
  }
}
