import Foundation
import Darwin

struct KimiUsageEntry: Codable {
    let id: String
    let model: String
    let createdAt: Date
    let reservation: Int
    var tokens: Int?
}

final class KimiUsageLedger {
    let limit = 3_000_000
    let file: URL
    init(directory: URL) { file = directory.appendingPathComponent("kimi-usage.json") }
    private func locked<T>(_ operation: () throws -> T) throws -> T {
        try FileManager.default.createDirectory(at:file.deletingLastPathComponent(),withIntermediateDirectories:true)
        let descriptor=Darwin.open(file.deletingLastPathComponent().appendingPathComponent("kimi-usage.lock").path,O_CREAT|O_RDWR,S_IRUSR|S_IWUSR)
        guard descriptor>=0 else{throw SettingsError.message("用量锁无法打开，已暂停新请求。")}
        defer{_ = flock(descriptor,LOCK_UN);_ = Darwin.close(descriptor)}
        guard flock(descriptor,LOCK_EX)==0 else{throw SettingsError.message("用量记录正在被另一窗口使用，请重试。")}
        return try operation()
    }
    func read() throws -> [KimiUsageEntry] {try locked{try readUnlocked()}}
    private func readUnlocked() throws -> [KimiUsageEntry] {
        if !FileManager.default.fileExists(atPath: file.path) { return [] }
        let entries = try JSONDecoder().decode([KimiUsageEntry].self, from: Data(contentsOf: file))
        guard entries.count <= 10_000, Set(entries.map(\.id)).count == entries.count, entries.allSatisfy({ $0.reservation > 0 && $0.reservation <= limit && ($0.tokens == nil || ($0.tokens! >= 0 && $0.tokens! <= limit)) }) else { throw SettingsError.message("本机用量记录有误，已暂停新请求。请先核对用量记录。") }
        return entries
    }
    private func write(_ entries: [KimiUsageEntry]) throws {
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(entries).write(to: file, options: [.atomic])
    }
    func reserve(id: String, model: String) throws {
        try locked {
        var entries = try readUnlocked()
        guard !entries.contains(where: { $0.id == id }) else { throw SettingsError.message("显影请求编号重复，请重新显影。") }
        // Reserve the model's entire allowed context plus capped output. No uncertain image-token estimate.
        let reservation = (["k3-256k", "kimi-for-coding-highspeed"].contains(model) ? 262_144 : 1_048_576) + 4096
        let held = entries.reduce(0) { $0 + ($1.tokens ?? $1.reservation) }
        guard held + reservation <= limit else { throw SettingsError.message("本轮 300 万 Token 的剩余安全预算不足。超时或取消的请求仍保留用量预留，请先核对账户用量。") }
        entries.append(KimiUsageEntry(id: id, model: model, createdAt: Date(), reservation: reservation, tokens: nil))
        try write(entries)
        }
    }
    func settle(id: String, tokens: Int?) throws {
        guard let tokens = tokens else { return } // Unknown/failed requests retain their entire reservation.
        guard tokens >= 0 && tokens <= limit else { throw SettingsError.message("服务端用量无法校验，已保留预算预留。") }
        try locked {
        var entries = try readUnlocked()
        guard let index = entries.firstIndex(where: { $0.id == id }) else { throw SettingsError.message("用量记录缺失，已暂停新请求。") }
        entries[index].tokens = tokens
        try write(entries)
        }
    }
    func summary() throws -> [String: Any] {
        let entries = try read()
        let known = entries.compactMap(\.tokens).reduce(0, +)
        let reserved = entries.filter { $0.tokens == nil }.map(\.reservation).reduce(0, +)
        return ["limit": limit, "knownTokens": known, "reservedTokens": reserved, "unknownRequests": entries.filter { $0.tokens == nil }.count, "remainingTokens": max(0, limit - known - reserved)]
    }
    func seedPreviousProbe() throws {
        try locked {
        var entries = try readUnlocked()
        if !entries.contains(where: { $0.id == "v02-probe-known" }) { entries.append(KimiUsageEntry(id: "v02-probe-known", model: "kimi-for-coding", createdAt: Date(), reservation: 2962, tokens: 2962)) }
        if !entries.contains(where: { $0.id == "v02-probe-unknown" }) { entries.append(KimiUsageEntry(id: "v02-probe-unknown", model: "k3-256k", createdAt: Date(), reservation: 266_240, tokens: nil)) }
        try write(entries)
        }
    }
}
