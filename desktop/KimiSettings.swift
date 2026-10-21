import Foundation
import Security
import WebKit

enum SettingsError: Error { case message(String) }

final class KimiSettingsBridge: NSObject, WKScriptMessageHandlerWithReply, URLSessionTaskDelegate {
    static let models = ["k3", "k3-256k", "kimi-for-coding", "kimi-for-coding-highspeed"]
    let resourceFolder: URL
    let directory: URL
    let service: String
    let account = "kimi-code"
    var checking = false
    private var cachedKey: String?
    private var credentialEpoch = 0
    /// Keychain authorization may wait for the user. Never block WebKit's main thread.
    func unlockKey(_ completion: @escaping (Result<String, Error>) -> Void) {
        if let key = cachedKey { completion(.success(key)); return }
        let epoch = credentialEpoch
        DispatchQueue.global(qos: .userInitiated).async {
            let result = Result { try self.readKey() }
            DispatchQueue.main.async {
                guard epoch == self.credentialEpoch else { completion(.failure(SettingsError.message("Key 配置已更新，请重试。"))); return }
                if case .success(let key) = result { self.cachedKey = key }
                completion(result)
            }
        }
    }
    /// Only for an explicitly requested local QA run; never returned to JavaScript.
    func useTestCredential(_ key: String) { credentialEpoch += 1; cachedKey = key }
    init(resourceFolder: URL, testDirectory: URL?) {
        self.resourceFolder = resourceFolder
        directory = testDirectory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Glimpse")
        service = testDirectory == nil ? "local.glimpse.kimi-code" : "local.glimpse.kimi-code.qa"
        super.init()
    }
    var settingsFile: URL { directory.appendingPathComponent("kimi-settings.json") }
    var keyQuery: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account] }
    func keyExists() throws -> Bool {
        var query = keyQuery
        query[kSecReturnAttributes as String] = true
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        if status == errSecItemNotFound { return false }
        guard status == errSecSuccess else { throw SettingsError.message("无法访问本机钥匙串，请检查系统授权后重试。") }
        return true
    }
    func readKey() throws -> String {
        var query = keyQuery
        query[kSecReturnData as String] = true
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data, let key = String(data: data, encoding: .utf8) else { throw SettingsError.message("请先保存 API Key，再检查连接。") }
        return key
    }
    func saveKey(_ key: String) throws {
        let attributes = [kSecValueData as String: Data(key.utf8)]
        var status = SecItemUpdate(keyQuery as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var query = keyQuery
            query[kSecValueData as String] = Data(key.utf8)
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            status = SecItemAdd(query as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw SettingsError.message("Key 保存失败，请检查钥匙串权限后重试。") }
        credentialEpoch += 1; cachedKey = key
    }
    func readModel() throws -> String {
        if !FileManager.default.fileExists(atPath: settingsFile.path) { return "kimi-for-coding" }
        let data = try Data(contentsOf: settingsFile)
        guard let value = try JSONSerialization.jsonObject(with: data) as? [String: Any], let model = value["model"] as? String, Self.models.contains(model) else { throw SettingsError.message("本机模型配置损坏，请检查配置文件后重试。") }
        return model
    }
    func saveConfiguration(model: String, suppliedKey: String) throws {
        guard Self.models.contains(model) else { throw SettingsError.message("配置参数有误，请重新选择模型。") }
        let key = suppliedKey.trimmingCharacters(in: .whitespacesAndNewlines)
        if !key.isEmpty {
            guard key.count <= 512, key.range(of: "^sk-[A-Za-z0-9_-]{8,}$", options: .regularExpression) != nil else { throw SettingsError.message("API Key 格式有误，请检查后重试。") }
            try saveKey(key)
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try JSONSerialization.data(withJSONObject: ["schemaVersion": 1, "provider": "kimi-code", "model": model], options: [.sortedKeys]).write(to: settingsFile, options: [.atomic])
    }
    func summary() throws -> [String: Any] { ["model": try readModel(), "hasKey": try keyExists(), "storage": "keychain"] }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url, url.isFileURL, url.standardizedFileURL == resourceFolder.appendingPathComponent("index.html").standardizedFileURL, let body = message.body as? [String: Any], let action = body["action"] as? String else { replyHandler(nil, "无法识别配置请求。"); return }
        do {
            switch action {
            case "read": replyHandler(try summary(), nil)
            case "save":
                guard let model = body["model"] as? String, Self.models.contains(model), let suppliedKey = body["apiKey"] as? String else { throw SettingsError.message("配置参数有误，请重新选择模型。") }
                try saveConfiguration(model: model, suppliedKey: suppliedKey)
                replyHandler(try summary(), nil)
            case "removeKey":
                let status = SecItemDelete(keyQuery as CFDictionary)
                guard status == errSecSuccess || status == errSecItemNotFound else { throw SettingsError.message("Key 移除失败，请检查钥匙串权限。") }
                credentialEpoch += 1; cachedKey = nil
                replyHandler(try summary(), nil)
            case "checkConnection":
                guard !checking else { throw SettingsError.message("正在检查连接，请稍候。") }
                checking = true
                unlockKey { result in
                    switch result {
                    case .success(let key): self.checkConnection(key: key, replyHandler: replyHandler)
                    case .failure: self.checking = false; replyHandler(nil, "无法读取 Key，请检查钥匙串授权或重新保存 Key。")
                    }
                }
            default: throw SettingsError.message("不支持此配置操作。")
            }
        } catch SettingsError.message(let detail) { replyHandler(nil, detail) }
        catch { replyHandler(nil, "配置读写失败，请检查本机存储权限后重试。") }
    }
    private func checkConnection(key: String, replyHandler: @escaping (Any?, String?) -> Void) {
                var request = URLRequest(url: URL(string: "https://api.kimi.com/coding/v1/models")!, timeoutInterval: 15)
                request.setValue("Bearer " + key, forHTTPHeaderField: "Authorization")
                request.setValue("Glimpse/0.2.3 (macOS; connectivity-check)", forHTTPHeaderField: "User-Agent")
                request.setValue("application/json", forHTTPHeaderField: "Accept")
                let session = URLSession(configuration: .ephemeral, delegate: self, delegateQueue: nil)
                session.dataTask(with: request) { data, response, error in
                    DispatchQueue.main.async {
                        self.checking = false
                        defer { session.finishTasksAndInvalidate() }
                        if error != nil { replyHandler(nil, "连接失败，请检查网络后重试。"); return }
                        guard let response = response as? HTTPURLResponse else { replyHandler(nil, "无法读取服务端响应。"); return }
                        guard response.statusCode == 200 else {
                            let detail: String
                            switch response.statusCode {
                            case 401: detail = "Key 无效、已过期或账号无权限，请在 Kimi Code 控制台检查。"
                            case 403: detail = "Kimi Code 拒绝了请求，请检查会员额度与客户端接入权限。"
                            case 429: detail = "Kimi Code 正在限流，请稍后重试。"
                            default: detail = "Kimi Code 暂时无法响应（HTTP \(response.statusCode)）。"
                            }
                            replyHandler(nil, detail); return
                        }
                        guard let data = data, data.count <= 1_000_000, let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let models = payload["data"] as? [[String: Any]] else { replyHandler(nil, "模型列表格式有误。"); return }
                        let ids = models.compactMap { $0["id"] as? String }.filter { Self.models.contains($0) }
                        replyHandler(["models": ids], nil)
                    }
                }.resume()
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
