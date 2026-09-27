// test.js
// Tests codec.js against the examples of the specification.
//
// Run with: gjs -m test.js
// Exit status: 0 if all tests pass, 1 if one or more tests fail.

import System from 'system';

import {encode, decode} from './codec.js';

let failures = 0;

function check(name, actual, expected) {
    const ok = actual === expected;
    if (!ok)
        failures++;
    print(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
}

/** Returns the result of fn, or the text "error" if fn throws. */
function attempt(fn) {
    try {
        return fn();
    } catch {
        return 'error';
    }
}

function minutes(date) {
    return date.toISOString().slice(0, 16);
}

// Input, code, decode result.
const cases = [
    ['2020-01-01T00:00:00Z', '01100', '2020-01-01T00:00'],
    ['2026-06-29T08:05:00Z', '66X82', '2026-06-29T08:04'],
    ['2026-06-29T10:05:00+02:00', '66X82', '2026-06-29T08:04'],
    ['2026-01-01T00:30:00+01:00', '5CZQF', '2025-12-31T23:30'],
    ['2031-10-10T23:59:59Z', 'BAAQX', '2031-10-10T23:58'],
    ['2051-12-31T23:59:00Z', 'ZCZQX', '2051-12-31T23:58'],
    ['2052-01-01T00:00:00Z', '01100+1', '2052-01-01T00:00'],
    ['2100-03-15T12:34:56Z', 'G3FCH+2', '2100-03-15T12:34'],
    ['3043-12-31T23:59:59Z', 'ZCZQX+Z', '3043-12-31T23:58'],
];

for (const [input, code, result] of cases) {
    check(`encode ${input}`, attempt(() => encode(new Date(input))), code);
    check(`decode ${code}`, attempt(() => minutes(decode(code))), result);
}

// Decode accepts lowercase, hyphens, whitespace, I, L, and O.
const accepted = [
    ['66x82', '2026-06-29T08:04'],
    ['66-X82', '2026-06-29T08:04'],
    [' 66X 82 ', '2026-06-29T08:04'],
    ['OIL00', '2020-01-01T00:00'],
    ['g3fch+2', '2100-03-15T12:34'],
    ['82X00', '2028-02-29T00:00'],
];

for (const [code, result] of accepted)
    check(`decode "${code}"`, attempt(() => minutes(decode(code))), result);

const rejectedDates = [
    '2019-12-31T23:59:59Z',
    '3044-01-01T00:00:00Z',
];

for (const input of rejectedDates)
    check(`encode ${input}`, attempt(() => encode(new Date(input))), 'error');

const rejectedCodes = [
    '',
    '66X8',
    '66X822',
    '66U82',
    '66X82+0',
    '66X82+O',
    '66X82+',
    '66X82+12',
    '66X82+1+1',
    '60X82',
    '6DX82',
    '66082',
    '66XR2',
    '66X8Y',
    '62Z00',
    '72X00',
];

for (const code of rejectedCodes)
    check(`decode "${code}"`, attempt(() => minutes(decode(code))), 'error');

print(failures === 0 ? 'All tests passed.' : `${failures} tests failed.`);
System.exit(failures === 0 ? 0 : 1);
