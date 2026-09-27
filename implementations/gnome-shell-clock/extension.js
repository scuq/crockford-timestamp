// extension.js
// GNOME Shell extension: shows the current UTC time as a crockford
// timestamp next to the system clock. Click it to open the flap clock.
//
// Install with: ./install.sh

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GnomeDesktop from 'gi://GnomeDesktop';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {ALPHABET, CYCLE_YEARS, EPOCH, decode, encode, valueOf} from './codec.js';

/** Seconds in one interval. */
const INTERVAL = 120;

/** Index of the cycle flap. The fields have the indexes 0 to 4. */
const CYCLE = 5;

const CAPTIONS = ['year', 'month', 'day', 'hour', '2 min', 'cycle'];

const FLIP_TIME = 350;

const MONTH_NAME = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    timeZone: 'UTC',
});

function pad(value) {
    return String(value).padStart(2, '0');
}

/** Explains one flap: character, value, and meaning. */
function hint(index, character, cycle) {
    let v;
    try {
        v = valueOf(character);
    } catch {
        return '';
    }
    const first = EPOCH + CYCLE_YEARS * v;
    switch (index) {
    case 0:
        return `year · ${character} = ${v} → ${EPOCH + CYCLE_YEARS * cycle + v}`;
    case 1: {
        const name = v >= 1 && v <= 12
            ? MONTH_NAME.format(new Date(Date.UTC(EPOCH, v - 1, 1)))
            : '?';
        return `month · ${character} = ${v} → ${name}`;
    }
    case 2:
        return `day · ${character} = ${v} → day ${v}`;
    case 3:
        return `hour · ${character} = ${v} → ${pad(v)}:00 UTC`;
    case 4:
        return `2 min · ${character} = ${v} → minutes ${pad(v * 2)}–${pad(v * 2 + 1)}`;
    default:
        return `cycle · +${character} = ${v} → ${first}–${first + CYCLE_YEARS - 1}`;
    }
}

/** Returns a local time as HH:MM. */
function localTime(date) {
    const seconds = Math.floor(date.getTime() / 1000);
    return GLib.DateTime.new_from_unix_local(seconds).format('%H:%M');
}

/** One flap with a caption below it. */
const FlapTile = GObject.registerClass(
class FlapTile extends St.BoxLayout {
    _init(caption, wide) {
        super._init({
            style_class: 'crockford-tile',
            orientation: Clutter.Orientation.VERTICAL,
            reactive: true,
            track_hover: true,
        });

        this._glyph = new St.Label({
            style_class: 'crockford-glyph',
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const hinge = new St.Widget({
            style_class: 'crockford-hinge',
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._flap = new St.Widget({
            style_class: wide ? 'crockford-flap crockford-flap-wide' : 'crockford-flap',
            layout_manager: new Clutter.BinLayout(),
            clip_to_allocation: true,
        });
        this._flap.add_child(this._glyph);
        this._flap.add_child(hinge);

        this.add_child(this._flap);
        this.add_child(new St.Label({
            style_class: 'crockford-caption crockford-dim',
            text: caption,
            x_align: Clutter.ActorAlign.CENTER,
        }));
    }

    setText(text) {
        if (this._glyph.text === text)
            return;
        this._glyph.text = text;
        if (!this.mapped)
            return;

        // The new character moves in from the top.
        this._glyph.remove_all_transitions();
        this._glyph.set({
            translation_y: -this._flap.height / 2,
            opacity: 0,
        });
        this._glyph.ease({
            translation_y: 0,
            opacity: 255,
            duration: FLIP_TIME,
            mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
        });
    }
});

/** The 32 Crockford characters with their values. Highlights one character. */
const AlphabetRuler = GObject.registerClass(
class AlphabetRuler extends St.BoxLayout {
    _init() {
        super._init({style_class: 'crockford-ruler', x_expand: true});

        this._cells = new Map();
        [...ALPHABET].forEach((character, value) => {
            const cell = new St.BoxLayout({
                style_class: 'crockford-ruler-cell crockford-dim',
                orientation: Clutter.Orientation.VERTICAL,
                x_expand: true,
            });
            cell.add_child(new St.Label({
                style_class: 'crockford-ruler-character',
                text: character,
                x_align: Clutter.ActorAlign.CENTER,
            }));
            cell.add_child(new St.Label({
                style_class: 'crockford-ruler-value',
                text: String(value),
                x_align: Clutter.ActorAlign.CENTER,
            }));
            this.add_child(cell);
            this._cells.set(character, cell);
        });
        this._highlight = null;
    }

    setHighlight(character) {
        if (character === this._highlight)
            return;
        this._cells.get(this._highlight)?.remove_style_class_name('crockford-ruler-on');
        this._cells.get(character)?.add_style_class_name('crockford-ruler-on');
        this._highlight = character;
    }
});

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'Crockford Clock');

        this._code = '';
        this._hovered = null;
        this._fraction = 0;
        this._timer = 0;

        this._label = new St.Label({
            style_class: 'crockford-panel-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._label);

        this._buildPanel();

        // The wall clock also sends a signal after a suspend and after
        // a change of the system time.
        this._clock = new GnomeDesktop.WallClock();
        this._clock.connectObject('notify::clock', () => this._update(), this);

        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._startTimer();
            else
                this._stopTimer();
        });

        this._update();
    }

    _buildPanel() {
        const box = new St.BoxLayout({
            style_class: 'crockford-clock',
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
        });

        const flaps = new St.BoxLayout({style_class: 'crockford-flaps'});
        this._tiles = CAPTIONS.map((caption, index) => {
            const tile = new FlapTile(caption, index === CYCLE);
            tile.connect('notify::hover', () => this._setHover(index, tile.hover));
            flaps.add_child(tile);
            return tile;
        });
        box.add_child(flaps);

        // Progress through the current 2-minute interval.
        this._track = new St.Widget({style_class: 'crockford-track', x_expand: true});
        this._signal = new St.Widget({style_class: 'crockford-signal'});
        this._track.add_child(this._signal);
        this._track.connect('notify::width', () => this._updateProgress());
        box.add_child(this._track);

        // Learning aid: the alphabet with values. Hover a flap to
        // highlight its character and read what it means.
        const aid = new St.BoxLayout({
            style_class: 'crockford-aid',
            orientation: Clutter.Orientation.VERTICAL,
        });
        this._ruler = new AlphabetRuler();
        this._hint = new St.Label({style_class: 'crockford-hint'});
        aid.add_child(this._ruler);
        aid.add_child(this._hint);
        box.add_child(aid);

        const times = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
        });
        this._utc = new St.Label({style_class: 'crockford-utc'});
        this._local = new St.Label({style_class: 'crockford-local crockford-dim'});
        times.add_child(this._utc);
        times.add_child(this._local);

        this._next = new St.Label({
            style_class: 'crockford-next crockford-dim',
            y_align: Clutter.ActorAlign.END,
        });

        const footer = new St.BoxLayout();
        footer.add_child(times);
        footer.add_child(this._next);
        box.add_child(footer);

        // A section, not a menu item: the shell theme dims the text of
        // a menu item that is not reactive.
        const section = new PopupMenu.PopupMenuSection();
        section.actor.add_child(box);
        this.menu.addMenuItem(section);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._copy = new PopupMenu.PopupMenuItem('');
        this._copy.connect('activate', () => {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, this._code);
        });
        this.menu.addMenuItem(this._copy);
    }

    _startTimer() {
        this._update();
        if (this._timer)
            return;
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopTimer() {
        if (this._timer)
            GLib.Source.remove(this._timer);
        this._timer = 0;
    }

    _setHover(index, inside) {
        if (inside)
            this._hovered = index;
        else if (this._hovered === index)
            this._hovered = null;
        this._updateHint();
    }

    /** Returns the character of the hovered flap, or null. */
    _hoveredCharacter() {
        if (this._hovered === null)
            return null;
        if (this._hovered === CYCLE)
            return this._code.length > 5 ? this._code[6] : null;
        return this._code[this._hovered] ?? null;
    }

    _cycle() {
        try {
            return this._code.length > 5 ? valueOf(this._code[6]) : 0;
        } catch {
            return 0;
        }
    }

    _updateHint() {
        const character = this._hoveredCharacter();
        this._ruler.setHighlight(character);
        if (character === null) {
            this._hint.text = 'Hover a flap to decode it.';
            this._hint.add_style_class_name('crockford-dim');
        } else {
            this._hint.text = hint(this._hovered, character, this._cycle());
            this._hint.remove_style_class_name('crockford-dim');
        }
    }

    _updateProgress() {
        const width = Math.round(this._track.width * this._fraction);
        this._signal.set_size(width, this._track.height);
    }

    _update() {
        const now = new Date();
        let code;
        try {
            code = encode(now);
        } catch {
            code = '?????';
        }
        if (code !== this._code) {
            this._code = code;
            this._label.text = code;
            this._copy.label.text = `Copy ${code}`;
        }
        if (!this.menu.isOpen)
            return;

        let start;
        try {
            start = decode(code);
        } catch {
            start = now;
        }
        const end = new Date(start.getTime() + INTERVAL * 1000);
        const elapsed = (now.getTime() - start.getTime()) / 1000;
        const remaining = Math.max(0, Math.floor(INTERVAL - elapsed));

        this._tiles.forEach((tile, index) => {
            if (index === CYCLE) {
                tile.visible = code.length > 5;
                tile.setText(code.slice(5));
            } else {
                tile.setText(code[index]);
            }
        });

        this._fraction = Math.min(1, Math.max(0, elapsed / INTERVAL));
        this._updateProgress();
        this._updateHint();

        const utc = start.toISOString();
        this._utc.text = `${utc.slice(0, 10)} ${utc.slice(11, 16)} UTC`;
        this._local.text = `${localTime(start)}–${localTime(end)} local`;
        this._next.text =
            `next flip in ${Math.floor(remaining / 60)}:${pad(remaining % 60)}`;
    }

    _onDestroy() {
        this._stopTimer();
        this._clock.disconnectObject(this);
        this._clock = null;
        super._onDestroy();
    }
});

export default class CrockfordClockExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        // Position 1 in the center box is directly after the system clock.
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'center');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
