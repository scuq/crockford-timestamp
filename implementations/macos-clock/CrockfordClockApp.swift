// CrockfordClockApp.swift
// macOS app: a split-flap clock that shows the current UTC time as a
// crockford timestamp (2-minute resolution).
//
// Build with the Command Line Tools only (no full Xcode needed):
//   xcode-select --install
//   swiftc -parse-as-library -O CrockfordClockApp.swift -o CrockfordClock
//   ./CrockfordClock

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


// MARK: - Style

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

enum Palette {
    static let housing = Color(hex: 0xD6D8DB)  // board housing
    static let flap = Color(hex: 0x34373C)     // flap surface
    static let hinge = Color(hex: 0x1F2124)    // split line
    static let glyph = Color(hex: 0xEDEEF0)    // characters
    static let signal = Color(hex: 0xF3C41A)   // departure-board yellow
    static let caption = Color(hex: 0x5A5E64)
}

// MARK: - Views

struct FlapTile: View {
    let text: String
    let caption: String
    var width: CGFloat = 76

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 7)
                    .fill(Palette.flap)
                Text(text)
                    .font(.system(size: 70, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Palette.glyph)
                    .id(text)
                    .transition(.asymmetric(
                        insertion: .move(edge: .top).combined(with: .opacity),
                        removal: .move(edge: .bottom).combined(with: .opacity)
                    ))
                Rectangle()
                    .fill(Palette.hinge)
                    .frame(height: 2)
            }
            .frame(width: width, height: 104)
            .clipShape(RoundedRectangle(cornerRadius: 7))
            Text(caption)
                .font(.system(size: 11))
                .foregroundStyle(Palette.caption)
        }
    }
}

struct CrockfordClock: View {
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

            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top, spacing: 10) {
                    ForEach(0..<main.count, id: \.self) { i in
                        FlapTile(text: main[i], caption: Self.captions[i])
                    }
                    if let suffix {
                        FlapTile(text: suffix, caption: "cycle", width: 100)
                    }
                }
                .animation(.easeInOut(duration: 0.35), value: code)

                // Progress through the current 2-minute interval.
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Palette.flap.opacity(0.15))
                        Capsule()
                            .fill(Palette.signal)
                            .frame(width: geo.size.width * min(1, elapsed / 120))
                    }
                }
                .frame(height: 5)

                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(Self.utcFormat.string(from: start)) UTC")
                            .font(.system(size: 15, weight: .medium))
                        Text("\(Self.localFormat.string(from: start))–\(Self.localFormat.string(from: end)) local")
                            .font(.system(size: 12))
                            .foregroundStyle(Palette.caption)
                    }
                    Spacer()
                    Text("next flip in \(remaining / 60):\(String(format: "%02d", remaining % 60))")
                        .font(.system(size: 12).monospacedDigit())
                        .foregroundStyle(Palette.caption)
                }
            }
            .padding(28)
        }
        .background(Palette.housing)
    }
}

// MARK: - App

@main
struct CrockfordClockApp: App {
    init() {
        runSelfTest()
        // A bare binary has no bundle. Make it a normal app with a Dock icon.
        NSApplication.shared.setActivationPolicy(.regular)
    }

    var body: some Scene {
        WindowGroup("Crockford Clock") {
            CrockfordClock()
                .frame(width: 560)
                .onAppear {
                    if #available(macOS 14, *) {
                        NSApplication.shared.activate()
                    } else {
                        NSApplication.shared.activate(ignoringOtherApps: true)
                    }
                }
        }
        .windowResizability(.contentSize)
    }
}
