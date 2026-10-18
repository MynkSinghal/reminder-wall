// Prints the largest face box for each image as JSON lines, using Apple's Vision.
//   swift scripts/detect_faces.swift a.jpg b.jpg ...
// → {"file":"a.jpg","w":1600,"h":2000,"face":[x,y,w,h]}   (pixels, origin top-left)
import Foundation
import Vision
import AppKit

for path in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        print("{\"file\":\"\(path)\",\"error\":\"unreadable\"}"); continue
    }
    let W = Double(cg.width), H = Double(cg.height)
    let req = VNDetectFaceRectanglesRequest()
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
    let faces = (req.results ?? []).sorted { $0.boundingBox.width * $0.boundingBox.height > $1.boundingBox.width * $1.boundingBox.height }
    if let f = faces.first?.boundingBox {
        let x = f.minX * W, y = (1 - f.maxY) * H, w = f.width * W, h = f.height * H
        print(String(format: "{\"file\":\"%@\",\"w\":%.0f,\"h\":%.0f,\"face\":[%.0f,%.0f,%.0f,%.0f]}", path, W, H, x, y, w, h))
    } else {
        print("{\"file\":\"\(path)\",\"w\":\(Int(W)),\"h\":\(Int(H)),\"face\":null}")
    }
}
