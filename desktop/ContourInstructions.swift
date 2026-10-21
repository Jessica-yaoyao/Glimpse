import Foundation
import ImageIO
import CryptoKit

struct ContourGuidance {
    static let engine = "vision-guided-v1", version = "glimpse-photo-grounding-v1"
    let photo: String, candidates: String, prompt: String, receipt: [String: Any]
    init(_ value: Any, width: Int, height: Int, resourceFolder: URL) throws {
        guard let body = value as? [String: Any], body["engine"] as? String == Self.engine, body["skillVersion"] as? String == Self.version,
              let photo = body["photo"] as? String, photo.hasPrefix("data:image/jpeg;base64,"), photo.utf8.count <= 4_000_000,
              let data = Data(base64Encoded: String(photo.dropFirst("data:image/jpeg;base64,".count))),
              let source = CGImageSourceCreateWithData(data as CFData, nil), CGImageSourceGetType(source) as String? == "public.jpeg",
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              props[kCGImagePropertyPixelWidth] as? Int == width, props[kCGImagePropertyPixelHeight] as? Int == height,
              let candidates = body["candidates"] as? String, candidates.utf8.count <= 30_000,
              let edges = try? JSONSerialization.jsonObject(with: Data(candidates.utf8)) as? [[String: Any]], (1...24).contains(edges.count) else { throw SettingsError.message("轮廓参考图或候选列表无效，未发送请求。") }
        var ids = Set<String>()
        func number(_ value: Any?) -> Double? {
            guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite, (0...1).contains(n.doubleValue) else { return nil }
            return n.doubleValue
        }
        for edge in edges {
            guard let id = edge["id"] as? String, id.range(of: "^e(0[1-9]|1[0-9]|2[0-4])$", options: .regularExpression) != nil, ids.insert(id).inserted,
                  let closed = edge["closed"] as? NSNumber, CFGetTypeID(closed) == CFBooleanGetTypeID(),
                  let nodes = edge["nodes"] as? [[Any]], (2...8).contains(nodes.count), nodes.allSatisfy({ $0.count == 2 && $0.allSatisfy({ number($0) != nil }) }),
                  let bounds = edge["bounds"] as? [String: Any], let x = number(bounds["x"]), let y = number(bounds["y"]), let w = number(bounds["width"]), let h = number(bounds["height"]), x + w <= 1.0001, y + h <= 1.0001 else { throw SettingsError.message("候选编号、节点或范围无效，未发送请求。") }
        }
        let instructions = try Data(contentsOf: resourceFolder.deletingLastPathComponent().appendingPathComponent(Self.version + ".md"))
        guard instructions.count <= 20_000, let prompt = String(data: instructions, encoding: .utf8), !prompt.isEmpty else { throw SettingsError.message("本地轮廓指引缺失，请重新安装增强版应用。") }
        func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
        self.photo = photo; self.candidates = candidates; self.prompt = prompt
        receipt = ["engine": Self.engine, "skillVersion": Self.version, "guidanceSha256": hash(data), "candidateSummarySha256": hash(Data(candidates.utf8)), "instructionSha256": hash(instructions)]
    }
}
