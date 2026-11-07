import Foundation
import Vision
import AppKit
// usage: ocr <imgdir> <in.json> <out.json>   in: [{"k":key,"p":[[file,y,h],...]}]
let a = CommandLine.arguments
let dir = a[1]
let items = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: a[2]))) as! [[String: Any]]
var cache: [String: CGImage] = [:]
func img(_ f: String) -> CGImage {
  if let c = cache[f] { return c }
  let ns = NSImage(contentsOfFile: dir + "/" + f)!
  var r = CGRect(origin: .zero, size: ns.size)
  let cg = ns.cgImage(forProposedRect: &r, context: nil, hints: nil)!
  cache[f] = cg; return cg
}
var out: [String: String] = [:]
for it in items {
  let k = it["k"] as! String
  var lines: [String] = []
  for p in it["p"] as! [[Any]] {
    let cg = img(p[0] as! String)
    let y = (p[1] as! NSNumber).doubleValue, h = (p[2] as! NSNumber).doubleValue
    let H = Double(cg.height)
    let sc = H / (p[3] as! NSNumber).doubleValue
    let rect = CGRect(x: 0, y: y*sc, width: Double(cg.width), height: h*sc)
    guard let crop = cg.cropping(to: rect) else { continue }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["ko-KR", "en-US"]
    req.usesLanguageCorrection = true
    try? VNImageRequestHandler(cgImage: crop, options: [:]).perform([req])
    let obs = (req.results ?? []).sorted { $0.boundingBox.minY > $1.boundingBox.minY }
    for o in obs { if let t = o.topCandidates(1).first?.string { lines.append(t) } }
  }
  out[k] = lines.joined(separator: "\n")
}
let d = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted])
try! d.write(to: URL(fileURLWithPath: a[3]))
print(out.count)
