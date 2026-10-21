import Foundation
import Vision
import ImageIO
import CryptoKit
import WebKit

enum VisionContours {
    static func extract(_ data: Data, cancelled: () -> Bool = { false }) throws -> [String: Any] {
        guard data.count <= 3_000_000, let source = CGImageSourceCreateWithData(data as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = props[kCGImagePropertyPixelWidth] as? Int, let height = props[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0, max(width, height) <= 1280,
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            throw SettingsError.message("轮廓提取需要有效的照片选区。")
        }
        let started = Date()
        var edges: [(score: Double, points: [[Double]], closed: Bool)] = []
        for dark in [true, false] {
            guard !cancelled() else { throw SettingsError.message("轮廓提取已取消。") }
            let request = VNDetectContoursRequest()
            request.maximumImageDimension = 512
            request.contrastAdjustment = 1
            request.detectsDarkOnLight = dark
            try VNImageRequestHandler(cgImage: image, orientation: .up, options: [:]).perform([request])
            guard let observation = request.results?.first else { continue }
            for index in 0..<observation.contourCount {
                guard !cancelled() else { throw SettingsError.message("轮廓提取已取消。") }
                let contour = try observation.contour(at: index)
                guard contour.pointCount >= 4, contour.pointCount <= 16_000 else { continue }
                let points = contour.normalizedPoints.map { [Double($0.x), 1 - Double($0.y)] }
                guard points.allSatisfy({ $0.allSatisfy({ $0.isFinite && $0 >= 0 && $0 <= 1 }) }) else { continue }
                let xs = points.map { $0[0] }, ys = points.map { $0[1] }
                let span = hypot((xs.max()! - xs.min()!) * Double(width), (ys.max()! - ys.min()!) * Double(height))
                guard span >= 5 else { continue }
                var closed = false
                contour.normalizedPath.applyWithBlock { if $0.pointee.type == .closeSubpath { closed = true } }
                edges.append((span, points, closed))
            }
        }
        guard !cancelled() else { throw SettingsError.message("轮廓提取已取消。") }
        edges.sort { $0.score > $1.score }
        // Bound native reply size before the front-end performs mask filtering and simplification.
        var selected = [[String: Any]](), pointCount = 0
        for edge in edges {
            guard selected.count < 96 else { break }
            guard pointCount + edge.points.count <= 60_000 else { continue }
            pointCount += edge.points.count
            selected.append(["points": edge.points, "closed": edge.closed])
        }
        return ["width": width, "height": height, "edges": selected,
                "elapsedMs": Int(Date().timeIntervalSince(started) * 1000),
                "photoSha256": SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()]
    }
}

final class ContourBridge: NSObject, WKScriptMessageHandlerWithReply {
    let folder: URL
    private let queue = DispatchQueue(label: "glimpse.contours", qos: .userInitiated)
    private let lock = NSLock()
    private var active: String?
    private var cancelled = false
    init(resourceFolder: URL) { folder = resourceFolder; super.init() }
    private func isCancelled(_ id: String) -> Bool { lock.lock(); defer { lock.unlock() }; return active != id || cancelled }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.standardizedFileURL == folder.appendingPathComponent("index.html").standardizedFileURL,
              let body = message.body as? [String: Any], let action = body["action"] as? String,
              let id = body["id"] as? String, id.range(of: "^contours-[A-Za-z0-9-]{5,100}$", options: .regularExpression) != nil else {
            replyHandler(nil, "无法识别轮廓提取请求。"); return
        }
        if action == "cancel" { lock.lock(); if active == id { cancelled = true }; lock.unlock(); replyHandler(["cancelled": true], nil); return }
        guard action == "extract", let photo = body["photo"] as? String, photo.hasPrefix("data:image/jpeg;base64,"), photo.utf8.count <= 4_000_000,
              let data = Data(base64Encoded: String(photo.dropFirst("data:image/jpeg;base64,".count))) else { replyHandler(nil, "照片选区格式无效。"); return }
        lock.lock()
        guard active == nil else { lock.unlock(); replyHandler(nil, "上一轮廓提取仍在结束，请稍后重试。"); return }
        active = id; cancelled = false; lock.unlock()
        queue.async {
            let result: Result<[String: Any], Error> = Result { try VisionContours.extract(data, cancelled: { self.isCancelled(id) }) }
            self.lock.lock(); self.active = nil; self.cancelled = false; self.lock.unlock()
            DispatchQueue.main.async {
                switch result {
                case .success(let value): replyHandler(value, nil)
                case .failure(SettingsError.message(let text)): replyHandler(nil, text)
                case .failure: replyHandler(nil, "本机未能提取照片轮廓，请调整选区后重试。")
                }
            }
        }
    }
}
