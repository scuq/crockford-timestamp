// codec.js
// Encodes and decodes a crockford timestamp. This module has no GNOME
// imports, so you can also test it with: gjs -m test.js

export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const EPOCH = 2020;
export const LAST_YEAR = 3043;

/** Years in one cycle. */
export const CYCLE_YEARS = 32;

export class CodecError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CodecError';
    }
}

/**
 * Encodes a date as 5 characters, plus "+N" for cycle 1 and later.
 *
 * @param {Date} date - the time to encode
 * @returns {string} the code
 * @throws {CodecError} if the UTC year is before 2020 or after 3043
 */
export function encode(date) {
    const year = date.getUTCFullYear();
    if (Number.isNaN(year))
        throw new CodecError('invalid date');
    if (year < EPOCH || year > LAST_YEAR)
        throw new CodecError(`year out of range: ${year}`);

    const offset = year - EPOCH;
    const cycle = Math.floor(offset / CYCLE_YEARS);
    let code =
        ALPHABET[offset % CYCLE_YEARS] +
        ALPHABET[date.getUTCMonth() + 1] +
        ALPHABET[date.getUTCDate()] +
        ALPHABET[date.getUTCHours()] +
        ALPHABET[Math.floor(date.getUTCMinutes() / 2)];
    if (cycle > 0)
        code += `+${ALPHABET[cycle]}`;
    return code;
}

/**
 * Returns the value of one Crockford character. Maps I and L to 1, O to 0.
 *
 * @param {string} character - one character
 * @returns {number} the value, 0 to 31
 * @throws {CodecError} if the character is not in the alphabet
 */
export function valueOf(character) {
    let c = character.toUpperCase();
    if (c === 'I' || c === 'L')
        c = '1';
    if (c === 'O')
        c = '0';
    const index = c.length === 1 ? ALPHABET.indexOf(c) : -1;
    if (index < 0)
        throw new CodecError(`invalid character: ${character}`);
    return index;
}

/**
 * Decodes a code to the UTC start of its 2-minute interval.
 *
 * @param {string} input - the code, with or without the cycle suffix
 * @returns {Date} the start of the interval
 * @throws {CodecError} if the code is not valid
 */
export function decode(input) {
    const parts = input.replace(/[-\s]/g, '').split('+');
    if (parts.length > 2 || [...parts[0]].length !== 5)
        throw new CodecError('invalid length');

    let cycle = 0;
    if (parts.length === 2) {
        if ([...parts[1]].length !== 1)
            throw new CodecError('invalid length');
        cycle = valueOf(parts[1]);
        if (cycle < 1)
            throw new CodecError('invalid value: cycle 0 has no suffix');
    }

    const [yearValue, month, day, hour, minuteValue] =
        [...parts[0]].map(c => valueOf(c));
    if (month < 1 || month > 12 || day < 1 || hour > 23 || minuteValue > 29)
        throw new CodecError('invalid value');

    const year = EPOCH + CYCLE_YEARS * cycle + yearValue;
    const date = new Date(Date.UTC(year, month - 1, day, hour, minuteValue * 2));
    // Reject days that do not exist (for example 31 February).
    if (date.getUTCDate() !== day)
        throw new CodecError('invalid value: the day does not exist');
    return date;
}
