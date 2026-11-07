import Foundation
import AppKit
let a = CommandLine.arguments
let dir = a[1]; let outd = a[3]
let items = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: a[2]))) as! [[String: Any]]
var cache: [String: CGImage] = [:]
for it in items {
  let k = it["k"] as! String
  var crops: [CGImage] = []
  for p in it["p"] as! [[Any]] {
    let f = p[0] as! String
    if cache[f] == nil { let ns = NSImage(contentsOfFile: dir + "/" + f)!; var r = CGRect(origin: .zero, size: ns.size); cache[f] = ns.cgImage(forProposedRect: &r, context: nil, hints: nil)! }
    let cg = cache[f]!
    let sc = Double(cg.height) / (p[3] as! NSNumber).doubleValue
    if let c = cg.cropping(to: CGRect(x: 0, y: (p[1] as! NSNumber).doubleValue*sc, width: Double(cg.width), height: (p[2] as! NSNumber).doubleValue*sc)) { crops.append(c) }
  }
  let W = crops.map{$0.width}.max()!, H = crops.map{$0.height}.reduce(0,+)
  let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.setFillColor(.white); ctx.fill(CGRect(x:0,y:0,width:W,height:H))
  var y = H
  for c in crops { y -= c.height; ctx.draw(c, in: CGRect(x: 0, y: y, width: c.width, height: c.height)) }
  let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: outd + "/" + k + ".png"))
}
print(items.count)
