import Foundation
import Darwin
import ImageIO
import CryptoKit
import WebKit
import UniformTypeIdentifiers

final class InspirationStore {
    let directory: URL
    private let qualityRunId: String?
    private var recovered = false
    init(directory: URL, qualityRunId: String? = nil) { self.directory = directory.appendingPathComponent("records"); self.qualityRunId = qualityRunId }
    var suiteFile: URL { qualityRunId.map { directory.deletingLastPathComponent().appendingPathComponent("quality-runs/" + $0 + ".json") } ?? directory.deletingLastPathComponent().appendingPathComponent("quality-suite.json") }
    func comparisonStore(_ id: String) throws -> InspirationStore {
        guard UUID(uuidString: id) != nil else { throw SettingsError.message("对照任务编号无效。") }
        return InspirationStore(directory: directory.deletingLastPathComponent(), qualityRunId: id)
    }
    private func suiteLock<T>(_ operation:()throws->T)throws->T {
        try FileManager.default.createDirectory(at:suiteFile.deletingLastPathComponent(),withIntermediateDirectories:true)
        let fd=Darwin.open(suiteFile.deletingPathExtension().appendingPathExtension("lock").path,O_CREAT|O_RDWR,S_IRUSR|S_IWUSR)
        guard fd>=0 else{throw SettingsError.message("验收记录无法锁定，请重试。")}
        defer{_ = flock(fd,LOCK_UN);_ = Darwin.close(fd)}
        guard flock(fd,LOCK_EX)==0 else{throw SettingsError.message("另一窗口正在保存验收记录，请重试。")}
        return try operation()
    }
    private func suiteUnlocked()throws->[String:Any]? {
        guard FileManager.default.fileExists(atPath:suiteFile.path) else{return nil}
        let data=try Data(contentsOf:suiteFile)
        guard data.count<=1_000_000,let suite=try JSONSerialization.jsonObject(with:data) as? [String:Any],suite["schemaVersion"] as? Int==1,let tasks=suite["tasks"] as? [[String:Any]],tasks.count==20,Set(tasks.compactMap{$0["id"] as? String}).count==20 else{throw SettingsError.message("验收任务记录损坏，请保留文件并检查。")}
        if let id = qualityRunId { guard suite["id"] as? String == id, suite["engine"] as? String == ContourGuidance.engine else { throw SettingsError.message("对照任务身份不一致，请保留文件并检查。") } }
        return suite
    }
    /// Deterministic ID keeps each engine's first outcomes immutable across restarts/windows.
    func comparisonSuite(create: Bool = false) throws -> Any {
        guard qualityRunId == nil else { throw SettingsError.message("请从原版基线建立对照。") }
        return try suiteLock {
            guard let baseline = try suiteUnlocked(), let tasks = baseline["tasks"] as? [[String: Any]],
                  tasks.allSatisfy({ ["revealed", "failed"].contains($0["status"] as? String ?? "") && ($0["status"] as? String != "revealed" || $0["assessment"] is [String: Any]) }),
                  let baselineId = baseline["id"] as? String else { throw SettingsError.message("原版20项首次观察及评分完成后，才能建立独立对照。") }
            let fields = ["id", "recordId", "filename", "description", "selection", "originalSha256"]
            let fixed = tasks.map { task in Dictionary(uniqueKeysWithValues: fields.compactMap { field in task[field].map { (field, $0) } }) }
            let protocolData = try JSONSerialization.data(withJSONObject: ["baselineId": baselineId, "engine": ContourGuidance.engine, "tasks": fixed], options: [.sortedKeys])
            let hash = SHA256.hash(data: protocolData).map { String(format: "%02x", $0) }.joined()
            let chars = Array(hash.prefix(32)), parts = [0..<8, 8..<12, 12..<16, 16..<20, 20..<32]
            let id = parts.map { String(chars[$0]) }.joined(separator: "-")
            let comparison = try comparisonStore(id)
            if FileManager.default.fileExists(atPath: comparison.suiteFile.path) { return try comparison.readSuite(recoverInterrupted: true) }
            guard create else { return NSNull() }
            for task in fixed {
                guard let recordId = task["recordId"] as? String, try read(recordId)["originalSha256"] as? String == task["originalSha256"] as? String else { throw SettingsError.message("对照照片缺失或原图校验不一致，请先检查日志。") }
            }
            let pending = fixed.map { $0.merging(["status": "pending"], uniquingKeysWith: { _, new in new }) }
            return try comparison.writeSuite(["schemaVersion": 1, "revision": 0, "id": id, "createdAt": Date().timeIntervalSince1970 * 1000, "engine": ContourGuidance.engine, "baselineId": baselineId, "inputProtocolSha256": hash, "tasks": pending, "excludedFiles": baseline["excludedFiles"] ?? []])
        }
    }
    static func processIsRunning(_ value:Any?) -> Bool? {
        guard let pid=value as? Int,pid>0,pid<=Int(Int32.max) else{return nil}
        return Darwin.kill(Int32(pid),0)==0 || errno==EPERM
    }
    private func writeSuiteBytes(_ suite:[String:Any])throws {
        let data=try JSONSerialization.data(withJSONObject:suite,options:[.sortedKeys]);guard data.count<=1_000_000 else{throw SettingsError.message("验收记录过大。")}
        try data.write(to:suiteFile,options:[.atomic])
    }
    func readSuite(recoverInterrupted:Bool=false)throws->Any {
        return try suiteLock {
            guard var suite=try suiteUnlocked() else{return NSNull()}
            if recoverInterrupted,var tasks=suite["tasks"] as? [[String:Any]] {
                var changed=false
                for i in tasks.indices where tasks[i]["status"] as? String=="processing" {
                    // A running PID is an authoritative live handle. Unknown ownership is never guessed dead.
                    guard Self.processIsRunning(tasks[i]["ownerPID"])==false else{continue}
                    let started=tasks[i]["startedAt"] as? Double ?? Date().timeIntervalSince1970*1000
                    let record=(tasks[i]["recordId"] as? String).flatMap{try? read($0)}
                    let versions=record?["versions"] as? [[String:Any]] ?? []
                    let match=versions.first{version in
                        guard let created=version["createdAt"] as? Double,created>=started,version["description"] as? String==tasks[i]["description"] as? String,let result=version["result"] as? [String:Any],let receipt=result["receipt"] as? [String:Any],receipt["provider"] as? String=="kimi-code",let region=version["selection"] as? NSDictionary,let expected=tasks[i]["selection"] as? NSDictionary else{return false}
                        return region.isEqual(expected) && record?["originalSha256"] as? String==tasks[i]["originalSha256"] as? String && receipt["engine"] as? String == suite["engine"] as? String
                    }
                    if let version=match,let result=version["result"] as? [String:Any],let receipt=result["receipt"] as? [String:Any] {
                        tasks[i]["status"]="revealed";tasks[i]["versionId"]=version["id"];tasks[i]["receipt"]=receipt;tasks[i]["elapsedMs"]=max(0,(version["createdAt"] as! Double)-started)
                    } else {
                        tasks[i]["status"]="failed";tasks[i]["failure"]="发起任务的应用进程已结束，未保存有效结果；未知用量仍保守预留。";tasks[i]["elapsedMs"]=max(0,Date().timeIntervalSince1970*1000-started)
                    }
                    changed=true
                }
                if changed{suite["tasks"]=tasks;suite["revision"]=(suite["revision"] as? Int ?? 0)+1;try writeSuiteBytes(suite)}
            }
            return suite
        }
    }
    @discardableResult func writeSuite(_ supplied:[String:Any])throws->[String:Any] {
        return try suiteLock {
            guard supplied["schemaVersion"] as? Int==1,var tasks=supplied["tasks"] as? [[String:Any]],tasks.count==20,Set(tasks.compactMap{$0["id"] as? String}).count==20 else{throw SettingsError.message("验收任务需要固定的 20 个编号。")}
            let current=try suiteUnlocked(),revision=current?["revision"] as? Int ?? 0
            if let id = qualityRunId { guard supplied["id"] as? String == id, supplied["engine"] as? String == ContourGuidance.engine else { throw SettingsError.message("对照引擎身份不一致。") } }
            if let current=current {
                guard supplied["id"] as? String==current["id"] as? String,(supplied["revision"] as? Int ?? 0)==revision else{throw SettingsError.message("验收记录已在另一窗口更新，请重新读取后继续。当前写入未覆盖已有结果。")}
                for field in ["engine", "baselineId", "inputProtocolSha256", "createdAt"] {
                    guard NSDictionary(dictionary: [field: supplied[field] ?? NSNull()]).isEqual(NSDictionary(dictionary: [field: current[field] ?? NSNull()])) else { throw SettingsError.message("验收基线及引擎不可替换。") }
                }
                let oldTasks=current["tasks"] as! [[String:Any]]
                for i in tasks.indices {
                    for field in ["id","recordId","filename","description","selection","originalSha256"] {
                        guard let old=oldTasks[i][field],let new=tasks[i][field],(old as AnyObject).isEqual(new) else{throw SettingsError.message("固定照片、联想和选区不可替换。")}
                    }
                    if NSDictionary(dictionary:oldTasks[i]).isEqual(NSDictionary(dictionary:tasks[i])) { continue }
                    let oldStatus=oldTasks[i]["status"] as? String,newStatus=tasks[i]["status"] as? String
                    guard ["pending","processing","failed","revealed"].contains(newStatus ?? "") else{throw SettingsError.message("验收状态无效。")}
                    if newStatus == "revealed" {
                        guard let receipt = tasks[i]["receipt"] as? [String: Any], receipt["provider"] as? String == "kimi-code", receipt["engine"] as? String == supplied["engine"] as? String else { throw SettingsError.message("对照需要对应引擎的真实请求凭据。") }
                        if supplied["engine"] as? String == ContourGuidance.engine { guard receipt["skillVersion"] as? String == ContourGuidance.version else { throw SettingsError.message("增强对照需要对应版本的轮廓指引。") } }
                    }
                    if ["failed","revealed"].contains(oldStatus ?? "") {
                        var old=oldTasks[i],new=tasks[i];old.removeValue(forKey:"assessment");new.removeValue(forKey:"assessment")
                        guard NSDictionary(dictionary:old).isEqual(NSDictionary(dictionary:new)) else{throw SettingsError.message("首次验收结果不可被重试替换；评阅可以修改。")}
                    }
                    if newStatus=="processing" {
                        if oldStatus=="pending" {tasks[i]["ownerPID"]=Int(getpid())}
                        else {guard oldStatus=="processing",oldTasks[i]["ownerPID"] as? Int==Int(getpid()) else{throw SettingsError.message("此任务在另一窗口处理中，请等待原窗口完成。")};tasks[i]["ownerPID"]=oldTasks[i]["ownerPID"]}
                    }
                    if oldStatus=="processing" && newStatus=="pending" {throw SettingsError.message("已发起的首次任务不能退回待发起。")}
                    if oldStatus=="processing" && ["revealed","failed"].contains(newStatus ?? ""),oldTasks[i]["ownerPID"] as? Int != Int(getpid()){throw SettingsError.message("此任务由另一应用窗口发起，请在原窗口完成。")}
                }
            }
            if let pairs=supplied["pairAssessments"] as? [String:[String:Any]] {
                for (id,assessment) in pairs {
                    let pair=tasks.filter{$0["recordId"] as? String==id}
                    guard pair.count==2,pair.allSatisfy({$0["status"] as? String=="revealed"}),assessment["distinct"] is Bool,assessment["reviewedAt"] is Double else{throw SettingsError.message("照片的两次显影完成后才能保存对比评阅。")}
                }
            }
            var saved=supplied;saved["tasks"]=tasks;saved["revision"]=revision+1;try writeSuiteBytes(saved);return saved
        }
    }
    func folder(_ id: String) throws -> URL {
        guard UUID(uuidString: id) != nil else { throw SettingsError.message("记录编号无效。") }
        return directory.appendingPathComponent(id)
    }
    func read(_ id: String) throws -> [String: Any] {
        let data = try Data(contentsOf: folder(id).appendingPathComponent("record.json"))
        guard data.count <= 8_000_000, let record = try JSONSerialization.jsonObject(with: data) as? [String: Any], record["id"] as? String == id, record["schemaVersion"] as? Int == 1,let image=record["image"] as? [String:Any],let width=image["width"] as? Int,let height=image["height"] as? Int,width>0,height>0,max(width,height)<=1600,["upload","sample"].contains(image["mode"] as? String ?? ""),record["versions"] is [[String:Any]],record["uploadedAt"] is Double,record["occurredAt"] is Double,record["description"] is String,record["originalSha256"] is String else { throw SettingsError.message("记录格式损坏，请保留文件并检查。") }
        return record
    }
    func changed(){DispatchQueue.main.async{NotificationCenter.default.post(name:NSNotification.Name("glimpseRecordChanged"),object:nil,userInfo:["directory":self.directory.path])}}
    func write(_ record: [String: Any], to folder: URL) throws { try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]).write(to: folder.appendingPathComponent("record.json"), options: [.atomic]) }
    func hydrated(_ record: [String: Any], preview: Bool) throws -> [String: Any] {
        let id = record["id"] as! String, root = try folder(id)
        var result = record, image = record["image"] as! [String: Any]
        let thumb = "data:image/jpeg;base64," + (try Data(contentsOf: root.appendingPathComponent("thumbnail.jpg"))).base64EncodedString()
        image["src"] = preview ? "data:image/jpeg;base64," + (try Data(contentsOf: root.appendingPathComponent("preview.jpg"))).base64EncodedString() : thumb
        result["image"] = image; result["thumbnail"] = thumb
        return result
    }
    func list() throws -> [[String: Any]] {
        if !FileManager.default.fileExists(atPath: directory.path) { return [] }
        let folders = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).filter { UUID(uuidString: $0.lastPathComponent) != nil }
        var records: [[String: Any]] = []
        for root in folders {
            var record = try read(root.lastPathComponent)
            if !recovered && record["status"] as? String == "processing", Self.processIsRunning(record["processingOwnerPID"])==false {
                record = try lockedRecord(root.lastPathComponent) {
                    var current = try read(root.lastPathComponent)
                    if current["status"] as? String=="processing", Self.processIsRunning(current["processingOwnerPID"])==false {
                        current["status"]="draft";current.removeValue(forKey:"processingOwnerPID");current["updatedAt"]=Date().timeIntervalSince1970*1000
                        try write(current,to:root)
                    }
                    return current
                }
            }
            records.append(try hydrated(record, preview: false))
        }
        recovered = true
        return records.sorted { ($0["occurredAt"] as? Double ?? 0) > ($1["occurredAt"] as? Double ?? 0) }
    }
    func decode(_ value: Any?, max: Int) throws -> (Data, String) {
        guard let text = value as? String, text.count <= max * 2, let comma = text.firstIndex(of: ","), text.hasPrefix("data:image/"), text[..<comma].hasSuffix(";base64"), let data = Data(base64Encoded: String(text[text.index(after: comma)...])), !data.isEmpty, data.count <= max, CGImageSourceCreateWithData(data as CFData, nil) != nil else { throw SettingsError.message("照片数据无效或超过大小限制。") }
        let source = CGImageSourceCreateWithData(data as CFData, nil)!
        let type = CGImageSourceGetType(source).map { String($0) }
        let mime = type.flatMap { UTType($0)?.preferredMIMEType } ?? String(text[..<comma].dropFirst(5).dropLast(7))
        return (data, mime)
    }
    func prepare(_ encoded: Any?) throws -> [String: Any] {
        let (original, _) = try decode(encoded, max: 30 * 1024 * 1024)
        let source = CGImageSourceCreateWithData(original as CFData,nil)!
        guard let image = CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceCreateThumbnailWithTransform:true,kCGImageSourceThumbnailMaxPixelSize:1600] as CFDictionary) else { throw SettingsError.message("这张照片无法解码，请重试。") }
        let data=NSMutableData()
        guard let destination=CGImageDestinationCreateWithData(data,"public.jpeg" as CFString,1,nil) else { throw SettingsError.message("预览无法生成。") }
        CGImageDestinationAddImage(destination,image,[kCGImageDestinationLossyCompressionQuality:0.88] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw SettingsError.message("预览无法生成。") }
        return ["src":"data:image/jpeg;base64,"+(data as Data).base64EncodedString(),"width":image.width,"height":image.height,"mode":"upload"]
    }
    static func metadata(_ data: Data) -> [String: Any] {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil), let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] else { return [:] }
        var result: [String: Any] = [:]
        let exif = props[kCGImagePropertyExifDictionary] as? [String: Any]
        if let local = exif?["DateTimeOriginal"] as? String {
            result["capturedLocal"] = local
            if let offset = exif?["OffsetTimeOriginal"] as? String {
                result["capturedOffset"] = offset
                let format = DateFormatter(); format.locale = Locale(identifier: "en_US_POSIX"); format.dateFormat = "yyyy:MM:dd HH:mm:ssXXXXX"; format.isLenient = false
                if let date = format.date(from: local + offset) { result["capturedAt"] = date.timeIntervalSince1970 * 1000 }
            }
        }
        if let gps = props[kCGImagePropertyGPSDictionary] as? [String: Any], let lat = gps["Latitude"] as? Double, let lon = gps["Longitude"] as? Double, let latRef = gps["LatitudeRef"] as? String, let lonRef = gps["LongitudeRef"] as? String, ["N", "S"].contains(latRef), ["E", "W"].contains(lonRef), lat.isFinite, lon.isFinite, (0...90).contains(lat), (0...180).contains(lon) {
            result["location"] = ["latitude": lat * (latRef == "S" ? -1 : 1), "longitude": lon * (lonRef == "W" ? -1 : 1), "coordinateSystem": "WGS84", "source": "exif", "recordedAt": Date().timeIntervalSince1970 * 1000]
        }
        return result
    }
    func create(_ body: [String: Any]) throws -> [String: Any] {
        let (original, mime) = try decode(body["original"], max: 30 * 1024 * 1024)
        let (preview, _) = try decode((body["image"] as? [String: Any])?["src"], max: 8_000_000)
        let (thumbnail, _) = try decode(body["thumbnail"], max: 500_000)
        guard var image = body["image"] as? [String: Any], let width = image["width"] as? Int, let height = image["height"] as? Int, width > 0, height > 0, max(width, height) <= 1600, ["sample", "upload"].contains(image["mode"] as? String ?? "") else { throw SettingsError.message("照片尺寸无效。") }
        image.removeValue(forKey: "src")
        let id = UUID().uuidString, now = Date().timeIntervalSince1970 * 1000
        var record: [String: Any] = ["schemaVersion": 1, "id": id, "status": "draft", "image": image, "originalMime": mime, "originalSha256": SHA256.hash(data: original).map { String(format: "%02x", $0) }.joined(), "uploadedAt": now, "occurredAt": now, "updatedAt": now, "timezone": String((body["timezone"] as? String ?? TimeZone.current.identifier).prefix(100)), "placeName": "", "description": "", "selection": NSNull(), "versions": []]
        if image["mode"] as? String == "upload" { for (key, value) in Self.metadata(original) { record[key] = value }; if let captured = record["capturedAt"] { record["occurredAt"] = captured } }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let temporary = directory.appendingPathComponent(".import-" + id), destination = try folder(id)
        do {
            try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: false)
            try original.write(to: temporary.appendingPathComponent("original.bin"), options: [.atomic])
            try preview.write(to: temporary.appendingPathComponent("preview.jpg"), options: [.atomic])
            try thumbnail.write(to: temporary.appendingPathComponent("thumbnail.jpg"), options: [.atomic])
            try write(record, to: temporary)
            try FileManager.default.moveItem(at: temporary, to: destination)
        } catch { try? FileManager.default.removeItem(at: temporary); throw SettingsError.message("照片保存失败，可能磁盘空间不足。请重试；已有记录不会被清空。") }
        changed();return try hydrated(record, preview: true)
    }
    private func lockedRecord<T>(_ id:String,_ operation:()throws->T)throws->T{
        let descriptor=Darwin.open(try folder(id).appendingPathComponent("record.lock").path,O_CREAT|O_RDWR,S_IRUSR|S_IWUSR)
        guard descriptor>=0 else{throw SettingsError.message("记录无法锁定，请重新打开后重试。")}
        defer{_ = flock(descriptor,LOCK_UN);_ = Darwin.close(descriptor)}
        guard flock(descriptor,LOCK_EX)==0 else{throw SettingsError.message("另一窗口正在保存这条记录，请重试。")}
        return try operation()
    }
    func patch(_ id: String, values: [String: Any], expectedUpdatedAt:Double? = nil) throws -> [String: Any] {
        return try lockedRecord(id){
        var record = try read(id)
        if let expected=expectedUpdatedAt,record["updatedAt"] as? Double != expected{throw SettingsError.message("这条记录已在另一窗口更新，请查看新版本后再编辑。当前修改未覆盖磁盘记录。") }
        if record["status"] as? String=="processing",let owner=record["processingOwnerPID"] as? Int,owner != Int(getpid()),Self.processIsRunning(owner)==true {throw SettingsError.message("这条照片正在另一窗口显影，请等待原窗口完成。")}
        let allowed = Set(["status", "occurredAt", "placeName", "location", "description", "selection", "mask", "versions"])
        guard Set(values.keys).isSubset(of: allowed), (try JSONSerialization.data(withJSONObject: values)).count <= 8_000_000 else { throw SettingsError.message("记录更新参数无效。") }
        if let description = values["description"] as? String, description.count > 100 { throw SettingsError.message("描述请保持在 100 字以内。") }
        if let place = values["placeName"] as? String, place.count > 200 { throw SettingsError.message("地点名称过长。") }
        if let status = values["status"] as? String, !["draft", "processing", "revealed", "failed"].contains(status) { throw SettingsError.message("记录状态无效。") }
        if let date = values["occurredAt"] as? Double, !date.isFinite || abs(date) > 8_640_000_000_000_000 { throw SettingsError.message("发现时间无效。") }
        if let location = values["location"] as? [String: Any] { guard let lat = location["latitude"] as? Double, let lon = location["longitude"] as? Double, lat.isFinite, lon.isFinite, (-90...90).contains(lat), (-180...180).contains(lon), location["coordinateSystem"] as? String == "WGS84", ["exif", "current", "manual"].contains(location["source"] as? String ?? "") else { throw SettingsError.message("位置需要有效的 WGS-84 经纬度。") } }
        for (key, value) in values { record[key] = value }
        if let status=values["status"] as? String {
            if status=="processing" { record["processingOwnerPID"]=Int(getpid()) }
            else { record.removeValue(forKey:"processingOwnerPID") }
        }
        record["updatedAt"] = Date().timeIntervalSince1970 * 1000
        try write(record, to: folder(id))
        changed();return try hydrated(record, preview: true)
        }
    }
    func original(_ id: String) throws -> String {
        let record = try read(id), data = try Data(contentsOf: folder(id).appendingPathComponent("original.bin"))
        guard SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == record["originalSha256"] as? String else { throw SettingsError.message("原照片校验失败，请保留记录并检查磁盘。") }
        return "data:" + (record["originalMime"] as? String ?? "image/jpeg") + ";base64," + data.base64EncodedString()
    }
    func remove(_ id: String) throws { try FileManager.default.trashItem(at: folder(id), resultingItemURL: nil);changed() }
}

final class InspirationBridge: NSObject, WKScriptMessageHandlerWithReply {
    let store: InspirationStore, resourceFolder: URL
    let queue = DispatchQueue(label: "local.glimpse.records")
    init(store: InspirationStore, resourceFolder: URL) { self.store = store; self.resourceFolder = resourceFolder }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url, url.isFileURL, url.standardizedFileURL == resourceFolder.appendingPathComponent("index.html").standardizedFileURL, let body = message.body as? [String: Any], let action = body["action"] as? String else { replyHandler(nil, "无法识别照片仓库请求。"); return }
        if action=="qualityExport" {
            guard let report=body["report"] as? [String:Any],let data=try? JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]),data.count<=1_000_000 else{replyHandler(nil,"验收导出内容无效。");return}
            let panel=NSSavePanel();panel.nameFieldStringValue="glimpse-quality-report.json";panel.allowedContentTypes=[.json]
            panel.begin {response in guard response == .OK,let url=panel.url else{replyHandler(["saved":false],nil);return};self.queue.async{do{try data.write(to:url,options:[.atomic]);DispatchQueue.main.async{replyHandler(["saved":true],nil)}}catch{DispatchQueue.main.async{replyHandler(nil,"验收报告导出失败，请重试。")}}}}
            return
        }
        queue.async {
            do {
                let result: Any
                switch action {
                case "list": result = try self.store.list()
                case "create": result = try self.store.create(body)
                case "prepare": result = try self.store.prepare(body["original"])
                case "qualityRead": result = try (body["runId"] as? String).map { try self.store.comparisonStore($0) }.map { try $0.readSuite(recoverInterrupted: true) } ?? self.store.readSuite(recoverInterrupted:true)
                case "qualityComparisonRead": result = try self.store.comparisonSuite()
                case "qualityComparisonCreate": result = try self.store.comparisonSuite(create: true)
                case "qualitySave": guard let suite=body["suite"] as? [String:Any] else{throw SettingsError.message("验收记录缺失。")};let target = try (suite["engine"] as? String == ContourGuidance.engine ? (suite["id"] as? String).map { try self.store.comparisonStore($0) } : nil) ?? self.store;if suite["engine"] != nil && !FileManager.default.fileExists(atPath:target.suiteFile.path) {throw SettingsError.message("请先从基线建立固定的增强对照任务。")} ;result=try target.writeSuite(suite)
                default:
                    guard let id = body["id"] as? String else { throw SettingsError.message("记录编号缺失。") }
                    switch action {
                    case "get": result = try self.store.hydrated(self.store.read(id), preview: true)
                    case "original": result = try self.store.original(id)
                    case "patch": guard let patch = body["patch"] as? [String: Any] else { throw SettingsError.message("更新内容缺失。") }; guard let expected=body["expectedUpdatedAt"] as? Double else{throw SettingsError.message("记录版本缺失，请重新打开后编辑。")};result = try self.store.patch(id, values: patch,expectedUpdatedAt:expected)
                    case "remove": try self.store.remove(id); result = ["removed": true]
                    default: throw SettingsError.message("不支持此仓库操作。")
                    }
                }
                DispatchQueue.main.async { replyHandler(result, nil) }
            } catch SettingsError.message(let detail) { DispatchQueue.main.async { replyHandler(nil, detail) } }
            catch { DispatchQueue.main.async { replyHandler(nil, "记录读取或保存失败，请检查磁盘空间与权限。已有照片不会被清空。") } }
        }
    }
}
