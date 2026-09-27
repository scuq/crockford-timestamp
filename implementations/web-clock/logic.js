// logic.js
// Pure functions for the clock and the converter: no DOM, so that
// gjs can test them directly. clock.js and converter.js hold the DOM
// code that calls these functions.

import {CYCLE_YEARS, EPOCH, decode, encode, valueOf} from './codec.js';

/** Seconds in one interval. */
export const INTERVAL = 120;

/** Index of the cycle flap. The fields have the indexes 0 to 4. */
export const CYCLE = 5;

export const CAPTIONS = ['year', 'month', 'day', 'hour', '2 min', 'cycle'];

// The locale is fixed at "en", not the locale of the visitor, so that
// the test in test.js gets the same month names on every machine.
const MONTH_NAME = new Intl.DateTimeFormat('en', {
    month: 'long',
    timeZone: 'UTC',
});

// The value of a "datetime-local" input, with optional seconds and
// fractional seconds, and a year of 4 to 6 digits (codec.js accepts
// years up to 3043).
const INPUT = /^(\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

export function pad(value, length = 2) {
    return String(value).padStart(length, '0');
}

/**
 * Explains one character of a code: its caption, its display text,
 * its value, and its meaning. Returns null for a character that is
 * not in the Crockford alphabet.
 */
export function describe(index, character, cycle) {
    let value;
    try {
        value = valueOf(character);
    } catch {
        return null;
    }
    const first = EPOCH + CYCLE_YEARS * value;
    let meaning;
    switch (index) {
    case 0:
        meaning = String(EPOCH + CYCLE_YEARS * cycle + value);
        break;
    case 1:
        meaning = value >= 1 && value <= 12
            ? MONTH_NAME.format(new Date(Date.UTC(EPOCH, value - 1, 1)))
            : '?';
        break;
    case 2:
        meaning = `day ${value}`;
        break;
    case 3:
        meaning = `${pad(value)}:00 UTC`;
        break;
    case 4:
        meaning = `minutes ${pad(value * 2)}–${pad(value * 2 + 1)}`;
        break;
    default:
        meaning = `${first}–${first + CYCLE_YEARS - 1}`;
    }
    const last = index >= CYCLE;
    return {
        caption: CAPTIONS[last ? CYCLE : index],
        character,
        text: last ? `+${character}` : character,
        value,
        meaning,
    };
}

/** Formats the result of describe for the visible hint line. */
export function hintText(parts) {
    if (parts === null)
        return '';
    return `${parts.caption} · ${parts.text} = ${parts.value} → ${parts.meaning}`;
}

/** Formats the result of describe for the aria-label of a flap. */
export function hintLabel(parts) {
    if (parts === null)
        return '';
    return `${parts.caption}: ${parts.text}, value ${parts.value}, ${parts.meaning}`;
}

/** Runs describe on each character of a canonical code. */
export function breakdown(code) {
    const suffix = code.length > CYCLE ? code[CYCLE + 1] : null;
    let cycle = 0;
    try {
        cycle = suffix === null ? 0 : valueOf(suffix);
    } catch {
        cycle = 0;
    }
    const parts = [...code.slice(0, CYCLE)].map(
        (character, index) => describe(index, character, cycle));
    if (suffix !== null)
        parts.push(describe(CYCLE, suffix, cycle));
    return parts;
}

/** Decodes input, then encodes it again, to get its canonical form. */
export function canonical(input) {
    return encode(decode(input));
}

/** Returns the start and the end of the 2-minute interval of a code. */
export function interval(code) {
    const start = decode(code);
    return {start, end: new Date(start.getTime() + INTERVAL * 1000)};
}

/**
 * Returns the code, the current interval, and its progress for now.
 * The code is "?????" when encode throws, the same as the GNOME
 * Shell extension.
 */
export function clockState(now) {
    let code;
    let start;
    try {
        code = encode(now);
        start = decode(code);
    } catch {
        code = '?????';
        start = now;
    }
    const end = new Date(start.getTime() + INTERVAL * 1000);
    const elapsed = (now.getTime() - start.getTime()) / 1000;
    return {
        code,
        start,
        end,
        remaining: Math.max(0, Math.floor(INTERVAL - elapsed)),
        fraction: Math.min(1, Math.max(0, elapsed / INTERVAL)),
    };
}

/** Formats the UTC time of a date as HH:MM. */
export function timeUtc(date) {
    return date.toISOString().slice(11, 16);
}

/** Formats the local time of a date as HH:MM. */
export function timeLocal(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Formats a date as its UTC date and time, "YYYY-MM-DD HH:MM". */
export function formatUtc(date) {
    return `${date.toISOString().slice(0, 10)} ${timeUtc(date)}`;
}

/** Formats a date as its local date and time, "YYYY-MM-DD HH:MM". */
export function formatLocal(date) {
    const day = [
        pad(date.getFullYear(), 4),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join('-');
    return `${day} ${timeLocal(date)}`;
}

/** Formats a date as an ISO 8601 string with second resolution. */
export function formatIso(date) {
    return `${date.toISOString().slice(0, 19)}Z`;
}

/** Returns the name and the UTC offset of the local time zone. */
export function zoneName(date) {
    const offset = -date.getTimezoneOffset();
    const size = Math.abs(offset);
    const utc =
        `UTC${offset < 0 ? '-' : '+'}${pad(Math.floor(size / 60))}:${pad(size % 60)}`;
    const name = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return name ? `${name} (${utc})` : utc;
}

/** Formats an interval as its UTC start and end, for example
 * "2026-06-29 08:04–08:06 UTC". */
export function formatUtcInterval(start, end) {
    return `${formatUtc(start)}–${timeUtc(end)} UTC`;
}

/** Formats an interval as its local start and end, with the zone name. */
export function formatLocalInterval(start, end) {
    return `${formatLocal(start)}–${timeLocal(end)} ${zoneName(start)}`;
}

/**
 * Reads the value of a "datetime-local" input as UTC or as local
 * time. That input has no time zone of its own, so the caller says
 * which one to use. Returns null for text that is not a valid date.
 *
 * The date starts at setUTCFullYear or setFullYear, not at Date.UTC
 * or new Date(year, ...), because those two map the years 0 to 99 to
 * 1900 to 1999.
 */
export function parseDateTimeInput(value, zone) {
    const match = INPUT.exec(value);
    if (match === null)
        return null;

    const [year, month, day, hour, minute, second] =
        match.slice(1).map(text => Number(text ?? 0));
    if (month < 1 || month > 12 || day < 1 || day > 31 ||
        hour > 23 || minute > 59 || second > 59)
        return null;

    const date = new Date(0);
    if (zone === 'utc') {
        date.setUTCFullYear(year, month - 1, day);
        date.setUTCHours(hour, minute, second, 0);
        // Reject days that do not exist (for example 31 February).
        if (date.getUTCDate() !== day)
            return null;
    } else {
        date.setFullYear(year, month - 1, day);
        date.setHours(hour, minute, second, 0);
        if (date.getDate() !== day)
            return null;
    }
    return date;
}

/** Formats a date for the value of a "datetime-local" input, the
 * opposite direction of parseDateTimeInput. */
export function formatDateTimeInput(date, zone) {
    if (zone === 'utc')
        return date.toISOString().slice(0, 16);
    return formatLocal(date).replace(' ', 'T');
}

/**
 * Reads the "code" parameter from a raw query string. Returns null
 * when the parameter is missing.
 *
 * This does not use URLSearchParams, because it turns a raw "+" into
 * a space, and decode then removes the space and gets a code of the
 * wrong length. "?code=G3FCH+2" and "?code=G3FCH%2B2" thus give the
 * same result here. When decodeURIComponent throws, this returns the
 * raw, not-decoded text.
 */
export function codeFromSearch(search) {
    const query = search.startsWith('?') ? search.slice(1) : search;
    for (const pair of query.split('&')) {
        const at = pair.indexOf('=');
        const name = at < 0 ? pair : pair.slice(0, at);
        if (name !== 'code')
            continue;
        const raw = at < 0 ? '' : pair.slice(at + 1);
        try {
            return decodeURIComponent(raw);
        } catch {
            return raw;
        }
    }
    return null;
}

/** Builds a link to a code, for example "BASE?code=66X82#converter".
 * Always writes a "+" in the code as "%2B". */
export function linkFor(code, base) {
    return `${base}?code=${encodeURIComponent(code)}#converter`;
}
