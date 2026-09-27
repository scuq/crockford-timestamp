// copy.js
// The copy function that clock.js and converter.js share.

// Milliseconds a copy message stays on the status line.
const SHOW_TIME = 4000;

const status = document.getElementById('status');

let timer = 0;

/** Shows text on the status line for SHOW_TIME milliseconds. */
function announce(text) {
    status.textContent = text;
    clearTimeout(timer);
    timer = setTimeout(() => {
        status.textContent = '';
    }, SHOW_TIME);
}

/** Selects the text of an element, so the reader can copy it by hand. */
function select(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * Writes text to the clipboard and shows "Copied TEXT" on the status
 * line. The clipboard API needs a secure context (HTTPS or
 * localhost). When it is not available or it rejects, this selects
 * the text of element, if given, and tells the reader to copy it
 * with the keyboard.
 */
export async function copy(text, element = null) {
    try {
        await navigator.clipboard.writeText(text);
        announce(`Copied ${text}`);
    } catch {
        if (element !== null)
            select(element);
        announce('Press Ctrl+C to copy.');
    }
}
