import Foundation
import WebKit

/// Independent presentation preferences; never touches photographs, scores or credentials.
final class PresentationBridge: NSObject, WKScriptMessageHandlerWithReply {
    let folder: URL
    let file: URL
    init(folder: URL, directory: URL) { self.folder = folder; file = directory.appendingPathComponent("presentation.json"); super.init() }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url, url.isFileURL, url.standardizedFileURL == folder.appendingPathComponent("index.html").standardizedFileURL, let body = message.body as? [String:Any] else { replyHandler(nil,"无法识别开屏设置请求。"); return }
        do {
            switch body["action"] as? String {
            case "read":
                if !FileManager.default.fileExists(atPath:file.path) { replyHandler(["complete":false],nil); return }
                guard let value = try JSONSerialization.jsonObject(with: Data(contentsOf:file)) as? [String:Any], let complete = value["complete"] as? Bool else { replyHandler(nil,"开屏设置无法读取，请重试。"); return }
                replyHandler(["complete":complete],nil)
            case "complete":
                try FileManager.default.createDirectory(at:file.deletingLastPathComponent(),withIntermediateDirectories:true)
                try JSONSerialization.data(withJSONObject:["schemaVersion":1,"complete":true]).write(to:file,options:.atomic)
                replyHandler(["complete":true],nil)
            default: replyHandler(nil,"不支持的开屏设置操作。")
            }
        } catch { replyHandler(nil,"开屏设置保存失败，请检查本机存储权限。"); }
    }
}
