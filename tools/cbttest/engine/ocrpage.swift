import Foundation
import Vision
import AppKit
import ImageIO
// usage: ocrpage <out.json> <img1> <img2> ...   → {file: [{t,x,y,w,h}]} (픽셀 좌표, 위쪽 기준)
let a = CommandLine.arguments
var out: [String: [[String: Any]]] = [:]
for f in a[2...] {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: f) as CFURL, nil),
        let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }
  let W = Double(cg.width), H = Double(cg.height)
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["ko-KR", "en-US"]
  req.usesLanguageCorrection = false
  try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
  var L: [[String: Any]] = []
  for o in req.results ?? [] {
    guard let t = o.topCandidates(1).first?.string else { continue }
    let b = o.boundingBox
    L.append(["t": t, "x": b.minX * W, "y": (1 - b.maxY) * H, "w": b.width * W, "h": b.height * H])
  }
  out[(f as NSString).lastPathComponent] = L
}
let d = try! JSONSerialization.data(withJSONObject: out)
try! d.write(to: URL(fileURLWithPath: a[1]))
print(out.count)
