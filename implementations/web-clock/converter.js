// converter.js
// DOM code of the converter: date and time to code, code to date and
// time, and the copy buttons of both results.

import {CodecError, EPOCH, LAST_YEAR, encode} from './codec.js';
import {copy} from './copy.js';
import {
    breakdown,
    canonical,
    codeFromSearch,
    formatDateTimeInput,
    formatIso,
    formatLocalInterval,
    formatUtcInterval,
    hintText,
    interval,
    linkFor,
    parseDateTimeInput,
} from './logic.js';

// The first and the last date that encode accepts, for the min and
// max of the date and time input. encode still decides: these two
// are hints only.
const FIRST = new Date(Date.UTC(EPOCH, 0, 1, 0, 0));
const LAST = new Date(Date.UTC(LAST_YEAR, 11, 31, 23, 59));

const encodeForm = document.getElementById('encode-form');
const encodeInput = document.getElementById('encode-input');
const encodeNow = document.getElementById('encode-now');
const encodeResult = document.getElementById('encode-result');
const decodeForm = document.getElementById('decode-form');
const decodeInput = document.getElementById('decode-input');
const decodeResult = document.getElementById('decode-result');

function element(name, className, text = '') {
    const node = document.createElement(name);
    node.className = className;
    node.textContent = text;
    return node;
}

/** Returns the URL of this page with no query string and no fragment. */
function base() {
    return `${location.origin}${location.pathname}`;
}

/** Returns "utc" or "local", the selected radio button of encodeForm. */
function zone() {
    return encodeForm.elements.zone.value;
}

/** Clears a result and the error state of its input. */
function clear(input, result) {
    result.replaceChildren();
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
}

/** Shows an error message and marks the input as invalid. */
function showError(input, result, message) {
    const error = element('p', 'error', message);
    error.id = `${input.id}-error`;
    result.replaceChildren(error);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', error.id);
}

/** Builds the definition list of labeled values, each with a copy button. */
function buildRows(rows) {
    const list = element('dl', 'rows');
    for (const {label, value, kind} of rows) {
        const text = element('span', `value value-${kind}`);
        if (kind === 'link') {
            const link = element('a', '', value);
            link.href = value;
            text.append(link);
        } else {
            text.textContent = value;
        }
        const button = element('button', 'button small', 'Copy');
        button.type = 'button';
        button.setAttribute('aria-label', `Copy ${label}: ${value}`);
        button.addEventListener('click', () => copy(value, text));

        const data = element('dd', '');
        data.append(text, button);
        list.append(element('dt', '', label), data);
    }
    return list;
}

/** Returns the rows that both forms show for a code. */
function rowsFor(code) {
    const {start, end} = interval(code);
    return [
        {label: 'Code', value: code, kind: 'code'},
        {label: 'UTC', value: formatUtcInterval(start, end), kind: 'text'},
        {label: 'Local', value: formatLocalInterval(start, end), kind: 'text'},
        {label: 'ISO 8601', value: formatIso(start), kind: 'text'},
        {label: 'Link', value: linkFor(code, base()), kind: 'link'},
    ];
}

/** Reads the date and time form, and shows its code or its error. */
function convertDate() {
    clear(encodeInput, encodeResult);
    if (encodeInput.value === '')
        return;

    let code;
    try {
        const date = parseDateTimeInput(encodeInput.value, zone());
        if (date === null)
            throw new CodecError('invalid date');
        code = encode(date);
    } catch (error) {
        showError(encodeInput, encodeResult, error.message);
        return;
    }
    encodeResult.replaceChildren(buildRows(rowsFor(code)));
}

/** Reads the code form, and shows its date and time or its error. */
function convertCode() {
    clear(decodeInput, decodeResult);
    if (decodeInput.value.trim() === '')
        return;

    let code;
    try {
        code = canonical(decodeInput.value);
    } catch (error) {
        showError(decodeInput, decodeResult, error.message);
        return;
    }

    const parts = element('ul', 'parts');
    for (const part of breakdown(code))
        parts.append(element('li', '', hintText(part)));
    decodeResult.replaceChildren(buildRows(rowsFor(code)), parts);
}

function setRange() {
    encodeInput.min = formatDateTimeInput(FIRST, zone());
    encodeInput.max = formatDateTimeInput(LAST, zone());
}

/** Fills the date and time input with the current time, then converts it. */
function setNow() {
    encodeInput.value = formatDateTimeInput(new Date(), zone());
    convertDate();
}

encodeForm.addEventListener('submit', event => {
    event.preventDefault();
    convertDate();
});
encodeInput.addEventListener('input', convertDate);
encodeInput.addEventListener('change', convertDate);
encodeNow.addEventListener('click', setNow);
for (const radio of encodeForm.elements.zone) {
    // A change of the time zone keeps the text and reads it again in
    // the new zone, instead of converting the value to the new zone.
    radio.addEventListener('change', () => {
        setRange();
        convertDate();
    });
}

decodeForm.addEventListener('submit', event => {
    event.preventDefault();
    convertCode();
});
decodeInput.addEventListener('input', convertCode);

setRange();
setNow();

// Fill the code form from the query string, for example after a
// visitor opens a link with "?code=66X82".
const linked = codeFromSearch(location.search);
if (linked !== null) {
    decodeInput.value = linked;
    convertCode();
}
