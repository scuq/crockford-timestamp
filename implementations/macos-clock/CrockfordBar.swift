// CrockfordBar.swift
// macOS menu bar app: shows the current UTC time as a crockford
// timestamp next to the system clock. Click it to open the flap clock.
//
// Build with the Command Line Tools only: ./build.sh
// Or directly:
//   swiftc -parse-as-library -O CrockfordBar.swift -o CrockfordBar

import SwiftUI
import AppKit

// MARK: - Codec

enum CrockfordTimestamp {
    static let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
    static let epoch = 2020
    static let lastYear = 3043

    enum CodecError: Error {
        case yearOutOfRange(Int)
        case invalidCharacter(Character)
        case invalidLength
        case invalidValue
    }

    static let utc: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    /// Encodes a date as 5 characters, plus "+N" for cycle 1 and later.
    static func encode(_ date: Date) throws -> String {
        let c = utc.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        guard let year = c.year, let month = c.month, let day = c.day,
              let hour = c.hour, let minute = c.minute else {
            throw CodecError.invalidValue
        }
        guard (epoch...lastYear).contains(year) else {
            throw CodecError.yearOutOfRange(year)
        }
        let offset = year - epoch
        let cycle = offset / 32
        var code = String([
            alphabet[offset % 32],
            alphabet[month],
            alphabet[day],
            alphabet[hour],
            alphabet[minute / 2],
        ])
        if cycle > 0 {
            code += "+" + String(alphabet[cycle])
        }
        return code
    }

    /// Returns the value of one Crockford character. Maps I and L to 1, O to 0.
    static func value(of character: Character) throws -> Int {
        guard var c = character.uppercased().first else {
            throw CodecError.invalidCharacter(character)
        }
        if c == "I" || c == "L" { c = "1" }
        if c == "O" { c = "0" }
        guard let index = alphabet.firstIndex(of: c) else {
            throw CodecError.invalidCharacter(character)
        }
        return index
    }

    /// Decodes a code to the UTC start of its 2-minute interval.
    static func decode(_ input: String) throws -> Date {
        let cleaned = input.filter { $0 != "-" && !$0.isWhitespace }
        let parts = cleaned.split(separator: "+", omittingEmptySubsequences: false)
        guard parts.count == 1 || parts.count == 2, parts[0].count == 5 else {
            throw CodecError.invalidLength
        }
        var cycle = 0
        if parts.count == 2 {
            guard parts[1].count == 1, let suffix = parts[1].first else {
                throw CodecError.invalidLength
            }
            cycle = try value(of: suffix)
            guard cycle >= 1 else { throw CodecError.invalidValue }
        }
        let v = try parts[0].map { try value(of: $0) }
        let month = v[1], day = v[2], hour = v[3], minuteValue = v[4]
        guard (1...12).contains(month), (1...31).contains(day),
              hour <= 23, minuteValue <= 29 else {
            throw CodecError.invalidValue
        }
        var dc = DateComponents()
        dc.year = epoch + 32 * cycle + v[0]
        dc.month = month
        dc.day = day
        dc.hour = hour
        dc.minute = minuteValue * 2
        // Reject days that do not exist (for example 31 February).
        guard let date = utc.date(from: dc),
              utc.component(.day, from: date) == day else {
            throw CodecError.invalidValue
        }
        return date
    }
}

// MARK: - Self test (prints to the console)

func runSelfTest() {
    let iso = ISO8601DateFormatter()
    let cases: [(String, String)] = [
        ("2020-01-01T00:00:00Z", "01100"),
        ("2026-06-29T10:05:00+02:00", "66X82"),
        ("2026-01-01T00:30:00+01:00", "5CZQF"),
        ("2031-10-10T23:59:59Z", "BAAQX"),
        ("2051-12-31T23:59:00Z", "ZCZQX"),
        ("2052-01-01T00:00:00Z", "01100+1"),
        ("2100-03-15T12:34:56Z", "G3FCH+2"),
        ("3043-12-31T23:59:59Z", "ZCZQX+Z"),
    ]
    for (input, expected) in cases {
        guard let date = iso.date(from: input),
              let code = try? CrockfordTimestamp.encode(date),
              let back = try? CrockfordTimestamp.decode(code) else {
            print("FAIL", input)
            continue
        }
        let status = code == expected ? "ok  " : "FAIL"
        print(status, input, code, iso.string(from: back))
    }
}


// MARK: - Themes

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

struct Theme {
    let housing: Color   // panel background
    let flap: Color      // flap surface
    let hinge: Color     // split line
    let glyph: Color     // flap characters
    let signal: Color    // progress bar
    let track: Color     // progress bar background
    let text: Color      // primary text
    let caption: Color   // secondary text
    let buttonFill: Color
    let buttonText: Color
    var systemChrome = false  // true: use system buttons

    /// Light: split-flap departure board.
    static let board = Theme(
        housing: Color(hex: 0xD6D8DB),
        flap: Color(hex: 0x34373C),
        hinge: Color(hex: 0x1F2124),
        glyph: Color(hex: 0xEDEEF0),
        signal: Color(hex: 0xF3C41A),
        track: Color(hex: 0x34373C).opacity(0.15),
        text: Color(hex: 0x34373C),
        caption: Color(hex: 0x5A5E64),
        buttonFill: Color(hex: 0x34373C),
        buttonText: Color(hex: 0xEDEEF0)
    )

    /// Dark: system dark background and text. Only the flaps use colours
    /// sampled from a retro pixel-art adventure night scene: amber title
    /// yellow on night-sky navy, with the black of the bridge girders.
    static let ega = Theme(
        housing: .clear,                              // system panel background
        flap: Color(hex: 0x131A54),                   // night-sky navy
        hinge: Color(hex: 0x060518),                  // girder black
        glyph: Color(hex: 0xF0A508),                  // amber title yellow
        signal: .accentColor,                         // system accent
        track: Color(nsColor: .quaternaryLabelColor),
        text: .primary,
        caption: .secondary,
        buttonFill: .clear,                           // not used
        buttonText: .primary,                         // not used
        systemChrome: true
    )

    static func current(_ scheme: ColorScheme) -> Theme {
        scheme == .dark ? .ega : .board
    }
}

/// Button in the theme colours. The system style was unreadable on the
/// custom background.
struct ThemedButtonStyle: ButtonStyle {
    let theme: Theme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(theme.buttonText)
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(theme.buttonFill)
                    .opacity(configuration.isPressed ? 0.7 : 1)
            )
    }
}

extension View {
    /// System buttons for the system chrome, themed buttons otherwise.
    @ViewBuilder
    func themedButtons(_ theme: Theme) -> some View {
        if theme.systemChrome {
            self.buttonStyle(.bordered)
        } else {
            self.buttonStyle(ThemedButtonStyle(theme: theme))
        }
    }
}

// MARK: - Views

struct FlapTile: View {
    let text: String
    let caption: String
    let theme: Theme
    var width: CGFloat = 76
    var hint: String = ""
    var isHovered = false
    var onHover: (Bool) -> Void = { _ in }

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 7)
                    .fill(theme.flap)
                Text(text)
                    .font(.system(size: 70, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.glyph)
                    .id(text)
                    .transition(.asymmetric(
                        insertion: .move(edge: .top).combined(with: .opacity),
                        removal: .move(edge: .bottom).combined(with: .opacity)
                    ))
                Rectangle()
                    .fill(theme.hinge)
                    .frame(height: 2)
            }
            .frame(width: width, height: 104)
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .overlay(
                RoundedRectangle(cornerRadius: 7)
                    .stroke(theme.glyph, lineWidth: isHovered ? 2 : 0)
            )
            Text(caption)
                .font(.system(size: 11))
                .foregroundStyle(theme.caption)
        }
        .contentShape(Rectangle())
        .onHover(perform: onHover)
        .help(hint)
    }
}

/// The 32 Crockford characters with their values. Highlights one character.
struct AlphabetRuler: View {
    let highlight: Character?
    let theme: Theme

    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<32, id: \.self) { i in
                let c = CrockfordTimestamp.alphabet[i]
                let on = c == highlight
                VStack(spacing: 1) {
                    Text(String(c))
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    Text("\(i)")
                        .font(.system(size: 8).monospacedDigit())
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 3)
                .foregroundStyle(on ? theme.glyph : theme.caption)
                .background(
                    RoundedRectangle(cornerRadius: 3)
                        .fill(on ? theme.flap : Color.clear)
                )
            }
        }
        .animation(.easeOut(duration: 0.15), value: highlight)
    }
}

/// Index of the hovered flap (0–4 fields, 5 cycle), or nil.
final class HoverState: ObservableObject {
    @Published var index: Int?
}

struct CrockfordClock: View {
    let theme: Theme

    /// Hover state. A class with @StateObject, because @State is a macro
    /// in the current SDK and the Command Line Tools do not ship the
    /// SwiftUIMacros plugin.
    @StateObject private var hover = HoverState()

    private var hovered: Int? { hover.index }

    private static let monthNames: [String] = DateFormatter().monthSymbols

    private func setHover(_ index: Int, _ inside: Bool) {
        if inside {
            hover.index = index
        } else if hover.index == index {
            hover.index = nil
        }
    }

    private func hintLine(hoveredChar: Character?, cycle: Int) -> String {
        guard let i = hovered, let c = hoveredChar else {
            return "Hover a flap to decode it."
        }
        return hint(for: i, character: c, cycle: cycle)
    }

    /// Explains one flap: character, value, and meaning.
    private func hint(for index: Int, character: Character, cycle: Int) -> String {
        guard let v = try? CrockfordTimestamp.value(of: character) else { return "" }
        let c = String(character)
        switch index {
        case 0:
            return "year · \(c) = \(v) → \(2020 + 32 * cycle + v)"
        case 1:
            let name = (1...12).contains(v) ? Self.monthNames[v - 1] : "?"
            return "month · \(c) = \(v) → \(name)"
        case 2:
            return "day · \(c) = \(v) → day \(v)"
        case 3:
            return "hour · \(c) = \(v) → \(String(format: "%02d", v)):00 UTC"
        case 4:
            return "2 min · \(c) = \(v) → minutes \(String(format: "%02d", v * 2))–\(String(format: "%02d", v * 2 + 1))"
        default:
            return "cycle · +\(c) = \(v) → \(2020 + 32 * v)–\(2051 + 32 * v)"
        }
    }

    private static let captions = ["year", "month", "day", "hour", "2 min"]

    private static let utcFormat: DateFormatter = {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f
    }()

    private static let localFormat: DateFormatter = {
        let f = DateFormatter()
        f.timeZone = .current
        f.dateFormat = "HH:mm"
        return f
    }()

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let now = context.date
            let code = (try? CrockfordTimestamp.encode(now)) ?? "?????"
            let main = Array(code.prefix(5)).map(String.init)
            let suffix: String? = code.count > 5 ? String(code.suffix(2)) : nil
            let start = (try? CrockfordTimestamp.decode(code)) ?? now
            let end = start.addingTimeInterval(120)
            let elapsed = now.timeIntervalSince(start)
            let remaining = max(0, Int(120 - elapsed))
            let suffixChar: Character? = suffix?.last
            let cycle: Int = suffixChar.flatMap { try? CrockfordTimestamp.value(of: $0) } ?? 0
            let chars: [Character] = main.map { Character($0) } + (suffixChar.map { [$0] } ?? [])

            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top, spacing: 10) {
                    ForEach(0..<main.count, id: \.self) { i in
                        FlapTile(
                            text: main[i], caption: Self.captions[i], theme: theme,
                            hint: hint(for: i, character: chars[i], cycle: cycle),
                            isHovered: hovered == i,
                            onHover: { setHover(i, $0) }
                        )
                    }
                    if let suffix {
                        FlapTile(
                            text: suffix, caption: "cycle", theme: theme, width: 100,
                            hint: hint(for: 5, character: chars[5], cycle: cycle),
                            isHovered: hovered == 5,
                            onHover: { setHover(5, $0) }
                        )
                    }
                }
                .animation(.easeInOut(duration: 0.35), value: code)

                // Progress through the current 2-minute interval.
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(theme.track)
                        Capsule()
                            .fill(theme.signal)
                            .frame(width: geo.size.width * min(1, elapsed / 120))
                    }
                }
                .frame(height: 5)

                // Learning aid: the alphabet with values. Hover a flap to
                // highlight its character and read what it means.
                let hoveredChar: Character? = hovered.flatMap { $0 < chars.count ? chars[$0] : nil }
                VStack(alignment: .leading, spacing: 6) {
                    AlphabetRuler(highlight: hoveredChar, theme: theme)
                    Text(hintLine(hoveredChar: hoveredChar, cycle: cycle))
                        .font(.system(size: 12).monospacedDigit())
                        .foregroundStyle(hovered == nil ? theme.caption : theme.text)
                }

                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(Self.utcFormat.string(from: start)) UTC")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(theme.text)
                        Text("\(Self.localFormat.string(from: start))–\(Self.localFormat.string(from: end)) local")
                            .font(.system(size: 12))
                            .foregroundStyle(theme.caption)
                    }
                    Spacer()
                    Text("next flip in \(remaining / 60):\(String(format: "%02d", remaining % 60))")
                        .font(.system(size: 12).monospacedDigit())
                        .foregroundStyle(theme.caption)
                }
            }
            .padding(28)
        }
    }
}

// MARK: - Menu bar model

/// Publishes the current code. Updates once per second, but only
/// publishes a change when the code changes (every 2 minutes).
final class ClockModel: ObservableObject {
    @Published private(set) var code = ""
    private var timer: Timer?

    init() {
        update()
        let t = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
            self?.update()
        }
        // .common keeps the timer running while the panel is open.
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    private func update() {
        let new = (try? CrockfordTimestamp.encode(Date())) ?? "?????"
        if new != code { code = new }
    }

    func copyToPasteboard() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code, forType: .string)
    }
}

// MARK: - Panel

/// Panel content. Reads the system appearance and picks the theme.
struct ClockPanel: View {
    @ObservedObject var model: ClockModel
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let theme = Theme.current(scheme)
        VStack(spacing: 0) {
            CrockfordClock(theme: theme)
            HStack {
                Button("Copy \(model.code)") {
                    model.copyToPasteboard()
                }
                .keyboardShortcut("c")
                Spacer()
                Button("Quit") {
                    NSApplication.shared.terminate(nil)
                }
                .keyboardShortcut("q")
            }
            .themedButtons(theme)
            .padding(.horizontal, 28)
            .padding(.bottom, 20)
        }
        .frame(width: 560)
        .background(theme.housing)
    }
}

// MARK: - App

@main
struct CrockfordBarApp: App {
    @StateObject private var model = ClockModel()

    init() {
        runSelfTest()
        // No Dock icon. The app lives only in the menu bar.
        NSApplication.shared.setActivationPolicy(.accessory)
    }

    var body: some Scene {
        MenuBarExtra {
            ClockPanel(model: model)
        } label: {
            Text(model.code)
                .monospacedDigit()
        }
        .menuBarExtraStyle(.window)
    }
}
