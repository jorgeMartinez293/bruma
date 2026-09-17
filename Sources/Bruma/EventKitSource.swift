import EventKit
import Foundation

/// Reads Calendar events and Reminders through EventKit, so widgets get the
/// data without launching Calendar.app / Reminders.app (which AppleScript does).
///
/// Every result is a JSON-bridge-friendly dictionary:
///     { status: "authorized", events: [...] } / { status: "authorized", items: [...] }
///     { status: "denied" }       — the user refused access in System Settings
///     { status: "unavailable" }  — no usage description in Info.plist (e.g.
///                                  `swift run`), where asking would crash
/// Dates are milliseconds since 1970, ready for `new Date(ms)`.
final class EventKitSource {
    private let store = EKEventStore()

    func calendarEvents(days: Double, completion: @escaping ([String: Any]) -> Void) {
        requestAccess(to: .event) { [store] granted, status in
            guard granted else { completion(["status": status]); return }
            let start = Date()
            let end = start.addingTimeInterval(days * 86400)
            let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
            let events = store.events(matching: predicate).map { e -> [String: Any] in
                [
                    "title": e.title ?? "",
                    "start": e.startDate.timeIntervalSince1970 * 1000,
                    "end": e.endDate.timeIntervalSince1970 * 1000,
                    "allDay": e.isAllDay,
                    "calendar": e.calendar?.title ?? ""
                ]
            }
            completion(["status": "authorized", "events": events])
        }
    }

    func incompleteReminders(completion: @escaping ([String: Any]) -> Void) {
        requestAccess(to: .reminder) { [store] granted, status in
            guard granted else { completion(["status": status]); return }
            let predicate = store.predicateForIncompleteReminders(
                withDueDateStarting: nil, ending: nil, calendars: nil)
            store.fetchReminders(matching: predicate) { reminders in
                let items = (reminders ?? []).map { r -> [String: Any] in
                    var d: [String: Any] = [
                        "title": r.title ?? "",
                        "list": r.calendar?.title ?? "",
                        "priority": r.priority
                    ]
                    if let comps = r.dueDateComponents,
                       let due = Calendar.current.date(from: comps) {
                        d["due"] = due.timeIntervalSince1970 * 1000
                    }
                    return d
                }
                completion(["status": "authorized", "items": items])
            }
        }
    }

    // MARK: Access

    /// Calls back with (granted, status string). Prompts only the first time;
    /// afterwards macOS answers from the stored decision.
    private func requestAccess(to type: EKEntityType,
                               completion: @escaping (Bool, String) -> Void) {
        guard Self.hasUsageDescription(for: type) else {
            completion(false, "unavailable"); return
        }
        let finish: (Bool, Error?) -> Void = { granted, _ in
            completion(granted, granted ? "authorized" : "denied")
        }
        if #available(macOS 14.0, *) {
            switch type {
            case .event: store.requestFullAccessToEvents(completion: finish)
            case .reminder: store.requestFullAccessToReminders(completion: finish)
            @unknown default: completion(false, "unavailable")
            }
        } else {
            store.requestAccess(to: type, completion: finish)
        }
    }

    /// macOS terminates a process that asks for calendar/reminder access
    /// without the matching Info.plist key, so check before asking.
    private static func hasUsageDescription(for type: EKEntityType) -> Bool {
        let keys: [String]
        switch type {
        case .event: keys = ["NSCalendarsFullAccessUsageDescription", "NSCalendarsUsageDescription"]
        case .reminder: keys = ["NSRemindersFullAccessUsageDescription", "NSRemindersUsageDescription"]
        @unknown default: return false
        }
        let key: String
        if #available(macOS 14.0, *) { key = keys[0] } else { key = keys[1] }
        return Bundle.main.object(forInfoDictionaryKey: key) != nil
    }
}
