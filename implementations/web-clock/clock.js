// clock.js
// DOM code of the flap clock: builds the flap tiles and the alphabet
// ruler, and keeps them in step with the time of the device.

import {ALPHABET} from './codec.js';
import {copy} from './copy.js';
import {
    CAPTIONS,
    CYCLE,
    breakdown,
    clockState,
    formatUtc,
    hintLabel,
    hintText,
    pad,
    timeLocal,
} from './logic.js';

const IDLE_HINT = 'Hover or tap a flap to decode it.';

const flaps = document.getElementById('flaps');
const signal = document.getElementById('signal');
const ruler = document.getElementById('ruler');
const hint = document.getElementById('hint');
const utc = document.getElementById('utc');
const local = document.getElementById('local');
const next = document.getElementById('next');
const copyCode = document.getElementById('copy-code');

let code = '';
let parts = [];
// The active flap is the hovered flap, else the pinned flap, else
// the flap with keyboard focus. buildTile and activeIndex apply
// this order.
let hovered = null;
let focused = null;
let pinned = null;
// The character that the ruler currently highlights.
let highlight = null;
let timer = 0;

function element(name, className, text = '') {
    const node = document.createElement(name);
    node.className = className;
    node.textContent = text;
    return node;
}

/** Builds one flap tile with its pointer, focus, and click handlers. */
function buildTile(caption, index) {
    const tile = element('div', 'tile');
    const flap = element('button', index === CYCLE ? 'flap wide' : 'flap');
    flap.type = 'button';
    flap.setAttribute('aria-pressed', 'false');

    const glyph = element('span', 'glyph');
    glyph.setAttribute('aria-hidden', 'true');
    const hinge = element('span', 'hinge');
    hinge.setAttribute('aria-hidden', 'true');
    flap.append(glyph, hinge);

    flap.addEventListener('pointerenter', event => {
        // Ignore a touch: it fires pointerenter with no hover, and
        // the click handler below does the work for a tap instead.
        if (event.pointerType === 'touch')
            return;
        hovered = index;
        updateHint();
    });
    flap.addEventListener('pointerleave', () => {
        if (hovered === index)
            hovered = null;
        updateHint();
    });
    flap.addEventListener('focus', () => {
        // :focus-visible excludes a focus from a mouse click.
        if (!flap.matches(':focus-visible'))
            return;
        focused = index;
        updateHint();
    });
    flap.addEventListener('blur', () => {
        if (focused === index)
            focused = null;
        updateHint();
    });
    flap.addEventListener('click', () => {
        // A click or a tap pins the flap. A second click or tap, or
        // Escape, releases it.
        pinned = pinned === index ? null : index;
        updateHint();
    });

    tile.append(flap, element('span', 'caption dim', caption));
    flaps.append(tile);
    return {tile, flap, glyph};
}

/** Builds the alphabet ruler and returns its cells, keyed by character. */
function buildRuler() {
    const cells = new Map();
    [...ALPHABET].forEach((character, value) => {
        const cell = element('li', 'cell');
        cell.append(
            element('span', 'ruler-character', character),
            element('span', 'ruler-value', String(value)));
        ruler.append(cell);
        cells.set(character, cell);
    });
    return cells;
}

const tiles = CAPTIONS.map(buildTile);
const cells = buildRuler();

/** Sets the text of a flap and restarts its flip animation. */
function setGlyph(glyph, text, animate) {
    if (glyph.textContent === text)
        return;
    glyph.textContent = text;
    if (!animate)
        return;
    // Remove the class, read offsetWidth to force a reflow, then add
    // the class again, so the animation restarts even when the flap
    // is still showing it.
    glyph.classList.remove('flip');
    void glyph.offsetWidth;
    glyph.classList.add('flip');
}

/** Returns the index of the active flap, or null. */
function activeIndex() {
    const index = hovered ?? pinned ?? focused;
    if (index === null || parts[index] === undefined)
        return null;
    return index;
}

function updateHint() {
    const index = activeIndex();
    const active = index === null ? null : parts[index];

    tiles.forEach(({flap}, at) => {
        flap.classList.toggle('on', at === index);
        flap.setAttribute('aria-pressed', String(at === pinned));
    });

    const character = active?.character ?? null;
    if (character !== highlight) {
        cells.get(highlight)?.classList.remove('on');
        cells.get(character)?.classList.add('on');
        highlight = character;
    }

    hint.textContent = active ? hintText(active) : IDLE_HINT;
    hint.classList.toggle('on', Boolean(active));
    hint.classList.toggle('dim', !active);
}

/** Rebuilds the flap tiles and their labels for a new code. */
function updateCode(animate) {
    parts = breakdown(code);
    const cycle = code.length > CYCLE;

    flaps.classList.toggle('has-cycle', cycle);
    tiles.forEach(({tile, flap, glyph}, index) => {
        if (index === CYCLE) {
            tile.hidden = !cycle;
            setGlyph(glyph, code.slice(CYCLE), animate);
        } else {
            setGlyph(glyph, code[index], animate);
        }
        flap.setAttribute('aria-label',
            parts[index] ? hintLabel(parts[index]) : CAPTIONS[index]);
    });

    if (pinned !== null && parts[pinned] === undefined)
        pinned = null;
    copyCode.textContent = `Copy ${code}`;
}

/** Updates the flaps, the progress bar, the hint, and the footer. */
function update() {
    const state = clockState(new Date());
    if (state.code !== code) {
        // No animation on the first render.
        const animate = code !== '';
        code = state.code;
        updateCode(animate);
    }

    signal.style.width = `${state.fraction * 100}%`;
    updateHint();

    utc.textContent = `${formatUtc(state.start)} UTC`;
    local.textContent =
        `${timeLocal(state.start)}–${timeLocal(state.end)} local`;
    next.textContent =
        `next flip in ${Math.floor(state.remaining / 60)}:${pad(state.remaining % 60)}`;
}

function stop() {
    clearTimeout(timer);
    timer = 0;
}

/** Updates now, then arms a timer for the start of the next second. */
function start() {
    stop();
    update();
    timer = setTimeout(start, 1000 - Date.now() % 1000 + 10);
}

// Stop the timer while the page is hidden. Update at once and start
// it again when the page becomes visible.
document.addEventListener('visibilitychange', () => {
    if (document.hidden)
        stop();
    else
        start();
});

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || pinned === null)
        return;
    pinned = null;
    updateHint();
});

copyCode.addEventListener('click', () => copy(code));

start();
