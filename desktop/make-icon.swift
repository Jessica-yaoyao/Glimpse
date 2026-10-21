import AppKit
let image = NSImage(size: NSSize(width: 1024, height: 1024))
image.lockFocus()
NSColor(calibratedRed: 252/255, green: 244/255, blue: 227/255, alpha: 1).setFill()
let frame = NSBezierPath(roundedRect: NSRect(x: 32, y: 32, width: 960, height: 960), xRadius: 210, yRadius: 210)
frame.fill()
frame.addClip()
if CommandLine.arguments.count > 2, let art = NSImage(contentsOfFile: CommandLine.arguments[2]) {
    // Preserve the original reference illustration, without a newly drawn mascot.
    art.draw(in: NSRect(x: 206, y: 124, width: 612, height: 776), from: .zero, operation: .sourceOver, fraction: 1)
}
image.unlockFocus()
let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
