import Foundation
import CoreLocation

// WGS-84/GCJ-02 formula adapted from wandergis/coordtransform (MIT).
// See licenses/coordtransform-MIT.txt. The inverse uses iterative refinement.
// Stored photo coordinates and CoreLocation remain WGS-84. Only MapKit's
// mainland rendering/point picking cross this adapter boundary.
enum MapCoordinates {
    private static let polygons: [[[[Double]]]] = {
        let url = ProcessInfo.processInfo.environment["GLIMPSE_MAP_REGION_FILE"].map { URL(fileURLWithPath: $0) }
            ?? Bundle.main.resourceURL?.appendingPathComponent("mainland-map-region.json")
        guard let url, let data = try? Data(contentsOf: url),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let geometry = root["geometry"] as? [String: Any],
              let coordinates = geometry["coordinates"] as? [[[[Double]]]] else { return [] }
        return coordinates
    }()
    private static func inside(_ coordinate: CLLocationCoordinate2D, ring: [[Double]]) -> Bool {
        guard ring.count >= 3 else { return false }
        let x = coordinate.longitude, y = coordinate.latitude
        var result = false, j = ring.count - 1
        for i in ring.indices {
            let a = ring[i], b = ring[j]
            if (a[1] > y) != (b[1] > y), x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0] { result.toggle() }
            j = i
        }
        return result
    }
    static func usesMainlandMap(_ coordinate: CLLocationCoordinate2D) -> Bool {
        guard CLLocationCoordinate2DIsValid(coordinate), (18...54).contains(coordinate.latitude), (73...135).contains(coordinate.longitude) else { return false }
        return polygons.contains { polygon in
            guard let outer = polygon.first, inside(coordinate, ring: outer) else { return false }
            return !polygon.dropFirst().contains { inside(coordinate, ring: $0) }
        }
    }
    private static func latitudeOffset(_ x: Double, _ y: Double) -> Double {
        var result = -100 + 2*x + 3*y + 0.2*y*y + 0.1*x*y + 0.2*sqrt(abs(x))
        result += (20*sin(6*x*Double.pi) + 20*sin(2*x*Double.pi))*2/3
        result += (20*sin(y*Double.pi) + 40*sin(y/3*Double.pi))*2/3
        result += (160*sin(y/12*Double.pi) + 320*sin(y*Double.pi/30))*2/3
        return result
    }
    private static func longitudeOffset(_ x: Double, _ y: Double) -> Double {
        var result = 300 + x + 2*y + 0.1*x*x + 0.1*x*y + 0.1*sqrt(abs(x))
        result += (20*sin(6*x*Double.pi) + 20*sin(2*x*Double.pi))*2/3
        result += (20*sin(x*Double.pi) + 40*sin(x/3*Double.pi))*2/3
        result += (150*sin(x/12*Double.pi) + 300*sin(x/30*Double.pi))*2/3
        return result
    }
    private static func forward(_ wgs: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        let a = 6378245.0, ee = 0.00669342162296594323
        let rad = wgs.latitude/180*Double.pi, sine = sin(rad), magic = 1-ee*sine*sine, root = sqrt(magic)
        let lat = latitudeOffset(wgs.longitude-105, wgs.latitude-35)*180/((a*(1-ee))/(magic*root)*Double.pi)
        let lon = longitudeOffset(wgs.longitude-105, wgs.latitude-35)*180/(a/root*cos(rad)*Double.pi)
        return CLLocationCoordinate2D(latitude: wgs.latitude+lat, longitude: wgs.longitude+lon)
    }
    static func display(_ wgs: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        usesMainlandMap(wgs) ? forward(wgs) : wgs
    }
    static func storage(_ displayed: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        // First compute a candidate, then classify its WGS-84 coverage. This also
        // handles points whose display offset crosses a coastline/border.
        var candidate = displayed
        for _ in 0..<10 {
            let projected = forward(candidate)
            let lat = projected.latitude-displayed.latitude, lon = projected.longitude-displayed.longitude
            candidate.latitude -= lat; candidate.longitude -= lon
            if max(abs(lat), abs(lon)) < 1e-10 { break }
        }
        return usesMainlandMap(candidate) ? candidate : displayed
    }
}
