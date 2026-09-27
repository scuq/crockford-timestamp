// test.js
// Tests logic.js, the pure functions of the flap clock and the
// converter, with no DOM.
//
// Run with: TZ=Europe/Vienna gjs -m test.js
// Exit status: 0 if all tests pass, 1 if one or more tests fail,
// 2 if the time zone is not Europe/Vienna.
//
// The time zone is fixed, because two of the encode test cases below
// come from rows 3 and 4 of the examples in README.md and are tested
// as local time. GJS has no URL class, so the link round trip test
// uses string operations instead.

import System from 'system';

import {encode} from './codec.js';
import {
    breakdown,
    canonical,
    clockState,
    codeFromSearch,
    formatDateTimeInput,
    formatIso,
    formatLocalInterval,
    formatUtcInterval,
    hintLabel,
    hintText,
    interval,
    linkFor,
    parseDateTimeInput,
} from './logic.js';

const ZONE = 'Europe/Vienna';

if (new Intl.DateTimeFormat().resolvedOptions().timeZone !== ZONE) {
    print(`Set the time zone. Run: TZ=${ZONE} gjs -m test.js`);
    System.exit(2);
}

let failures = 0;

function check(name, actual, expected) {
    const ok = actual === expected;
    if (!ok)
        failures++;
    print(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
}

function attempt(fn) {
    try {
        return fn();
    } catch {
        return 'error';
    }
}

// Query string, expected code.
const searches = [
    ['?code=66X82', '66X82'],
    ['?code=G3FCH%2B2', 'G3FCH+2'],
    ['?code=G3FCH+2', 'G3FCH+2'],
    ['?code=g3fch%2b2', 'g3fch+2'],
    ['?other=1&code=66-X82', '66-X82'],
    ['code=66X82', '66X82'],
    ['?code=66X%2082', '66X 82'],
    ['?code=%E0%A4%A', '%E0%A4%A'],
    ['?code=', ''],
    ['?code', ''],
    ['?codes=66X82', null],
    ['?other=code', null],
    ['', null],
];

for (const [search, code] of searches)
    check(`codeFromSearch "${search}"`, codeFromSearch(search), code);

const BASE = 'https://scuq.github.io/crockford-timestamp/';

check('linkFor 66X82', linkFor('66X82', BASE), `${BASE}?code=66X82#converter`);
check('linkFor G3FCH+2', linkFor('G3FCH+2', BASE),
    `${BASE}?code=G3FCH%2B2#converter`);

for (const code of ['66X82', '01100+1', 'G3FCH+2', 'ZCZQX+Z']) {
    const link = linkFor(code, BASE);
    const search = link.slice(link.indexOf('?'), link.indexOf('#'));
    check(`link round trip ${code}`, codeFromSearch(search), code);
}

// Value of a "datetime-local" input, time zone, expected code.
// Rows 3 and 4 are the local time rows of the examples in README.md.
const inputs = [
    ['2020-01-01T00:00', 'utc', '01100'],
    ['2026-06-29T08:05', 'utc', '66X82'],
    ['2026-06-29T10:05', 'local', '66X82'],
    ['2026-01-01T00:30', 'local', '5CZQF'],
    ['2031-10-10T23:59:59', 'utc', 'BAAQX'],
    ['2052-01-01T00:00', 'utc', '01100+1'],
    ['2100-03-15T12:34:56.789', 'utc', 'G3FCH+2'],
    ['3043-12-31T23:59:59', 'utc', 'ZCZQX+Z'],
    ['2028-02-29T00:00', 'utc', '82X00'],
    ['2019-12-31T23:59', 'utc', 'error'],
    ['2020-01-01T00:30', 'local', 'error'],
    ['3044-01-01T00:00', 'utc', 'error'],
    ['0020-01-01T00:00', 'utc', 'error'],
];

for (const [value, zone, code] of inputs) {
    check(`encode ${value} ${zone}`,
        attempt(() => encode(parseDateTimeInput(value, zone))), code);
}

// parseDateTimeInput returns null for each of these, in both zones.
const rejectedInputs = [
    '',
    'now',
    '2026-06-29',
    '2026-06-29 08:05',
    '2026-13-01T00:00',
    '2026-02-30T00:00',
    '2026-06-31T00:00',
    '2026-06-29T24:00',
    '2026-06-29T08:60',
    '2026-06-29T08:05Z',
];

for (const value of rejectedInputs) {
    for (const zone of ['utc', 'local']) {
        check(`parseDateTimeInput "${value}" ${zone}`,
            parseDateTimeInput(value, zone), null);
    }
}

// A round trip through parseDateTimeInput and formatDateTimeInput
// returns the same value.
const formats = [
    ['2026-06-29T08:05', 'utc'],
    ['2026-06-29T10:05', 'local'],
    ['2026-01-01T00:30', 'local'],
    ['3043-12-31T23:59', 'utc'],
];

for (const [value, zone] of formats) {
    check(`formatDateTimeInput ${value} ${zone}`,
        formatDateTimeInput(parseDateTimeInput(value, zone), zone), value);
}

// formatDateTimeInput also converts a date across zones.
check('formatDateTimeInput utc to local',
    formatDateTimeInput(new Date('2026-06-29T08:05:00Z'), 'local'),
    '2026-06-29T10:05');
check('formatDateTimeInput local to utc',
    formatDateTimeInput(new Date('2026-01-01T00:30:00+01:00'), 'utc'),
    '2025-12-31T23:30');

// Code, and one hintText line for each of its characters.
const hints = [
    ['66X82', [
        'year · 6 = 6 → 2026',
        'month · 6 = 6 → June',
        'day · X = 29 → day 29',
        'hour · 8 = 8 → 08:00 UTC',
        '2 min · 2 = 2 → minutes 04–05',
    ]],
    ['01100+1', [
        'year · 0 = 0 → 2052',
        'month · 1 = 1 → January',
        'day · 1 = 1 → day 1',
        'hour · 0 = 0 → 00:00 UTC',
        '2 min · 0 = 0 → minutes 00–01',
        'cycle · +1 = 1 → 2052–2083',
    ]],
    ['ZCZQX+Z', [
        'year · Z = 31 → 3043',
        'month · C = 12 → December',
        'day · Z = 31 → day 31',
        'hour · Q = 23 → 23:00 UTC',
        '2 min · X = 29 → minutes 58–59',
        'cycle · +Z = 31 → 3012–3043',
    ]],
];

for (const [code, lines] of hints) {
    check(`hintText ${code}`,
        breakdown(code).map(hintText).join('\n'), lines.join('\n'));
}

check('hintLabel 66X82 year', hintLabel(breakdown('66X82')[0]),
    'year: 6, value 6, 2026');
check('hintLabel 01100+1 cycle', hintLabel(breakdown('01100+1')[5]),
    'cycle: +1, value 1, 2052–2083');
check('hintText ?????', breakdown('?????').map(hintText).join(''), '');

// Input, expected canonical code (or "error").
const canonicals = [
    ['66X82', '66X82'],
    [' 66-x82 ', '66X82'],
    ['OIL00', '01100'],
    ['g3fch+2', 'G3FCH+2'],
    ['66U82', 'error'],
    ['62Z00', 'error'],
    ['66X82+0', 'error'],
    ['', 'error'],
];

for (const [input, code] of canonicals)
    check(`canonical "${input}"`, attempt(() => canonical(input)), code);

// Code, ISO 8601 start, expected UTC interval, expected local interval.
const intervals = [
    ['66X82',
        '2026-06-29T08:04:00Z',
        '2026-06-29 08:04–08:06 UTC',
        '2026-06-29 10:04–10:06 Europe/Vienna (UTC+02:00)'],
    ['5CZQF',
        '2025-12-31T23:30:00Z',
        '2025-12-31 23:30–23:32 UTC',
        '2026-01-01 00:30–00:32 Europe/Vienna (UTC+01:00)'],
    ['BAAQX',
        '2031-10-10T23:58:00Z',
        '2031-10-10 23:58–00:00 UTC',
        '2031-10-11 01:58–02:00 Europe/Vienna (UTC+02:00)'],
    ['G3FCH+2',
        '2100-03-15T12:34:00Z',
        '2100-03-15 12:34–12:36 UTC',
        '2100-03-15 13:34–13:36 Europe/Vienna (UTC+01:00)'],
];

for (const [code, iso, utc, local] of intervals) {
    const {start, end} = interval(code);
    check(`formatIso ${code}`, formatIso(start), iso);
    check(`formatUtcInterval ${code}`, formatUtcInterval(start, end), utc);
    check(`formatLocalInterval ${code}`, formatLocalInterval(start, end), local);
}

// Now, expected code, expected seconds remaining, expected fraction.
const states = [
    ['2026-06-29T08:04:00Z', '66X82', 120, 0],
    ['2026-06-29T08:05:30Z', '66X82', 30, 0.75],
    ['2026-06-29T08:05:59.500Z', '66X82', 0, 0.9958333333333333],
    ['2052-01-01T00:01:00Z', '01100+1', 60, 0.5],
    ['2019-12-31T23:59:59Z', '?????', 120, 0],
];

for (const [now, code, remaining, fraction] of states) {
    const state = clockState(new Date(now));
    check(`clockState ${now} code`, state.code, code);
    check(`clockState ${now} remaining`, state.remaining, remaining);
    check(`clockState ${now} fraction`, state.fraction, fraction);
}

print(failures === 0 ? 'All tests passed.' : `${failures} tests failed.`);
System.exit(failures === 0 ? 0 : 1);
