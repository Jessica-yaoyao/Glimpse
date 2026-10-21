import AppKit
import MapKit
import CoreLocation
import WebKit
import CoreText

// The native map chrome shares the web presentation's locked reference palette.
private enum MapVisualTheme {
    static let paper = NSColor(calibratedRed:252/255,green:244/255,blue:227/255,alpha:1)
    static let ink = NSColor(calibratedRed:22/255,green:24/255,blue:21/255,alpha:1)
    static let green = NSColor(calibratedRed:180/255,green:202/255,blue:112/255,alpha:1)
    static let fontRegistered: Bool = {
        guard let url=Bundle.main.url(forResource:"Xiaolai-Regular",withExtension:"ttf") else{return false}
        return CTFontManagerRegisterFontsForURL(url as CFURL,.process,nil)
    }()
    static func font(_ size:CGFloat)->NSFont { _ = fontRegistered; return NSFont(name:"Xiaolai",size:size) ?? .systemFont(ofSize:size) }
}

final class PhotoAnnotation: NSObject, MKAnnotation {
    dynamic var coordinate: CLLocationCoordinate2D
    let records: [[String: Any]]
    var title: String? { records.count > 1 ? "\(records.count) 次发现" : (records.first?["placeName"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "灵感发现" }
    init(coordinate: CLLocationCoordinate2D, records: [[String: Any]]) { self.coordinate = coordinate; self.records = records }
}
final class RecordMapButton: NSButton { var recordId = "" }
final class PhotoMapController: NSObject, MKMapViewDelegate, NSWindowDelegate {
    let window: NSWindow, map = MKMapView(), status = NSTextField(labelWithString: "底图需要联网。记录与照片保存在本机。"), list = NSStackView()
    var completion: (([String: Any]?, String?) -> Void)?
    var choosing = false, selectedCoordinate: CLLocationCoordinate2D?
    init(records: [[String: Any]], picking: Bool, completion: @escaping ([String: Any]?, String?) -> Void) {
        self.completion = completion; choosing = picking
        window = NSWindow(contentRect: NSRect(x:0,y:0,width:480,height:650),styleMask:[.titled,.closable,.resizable],backing:.buffered,defer:false)
        super.init(); window.appearance=NSAppearance(named:.aqua); window.backgroundColor=MapVisualTheme.paper; window.title = picking ? "选择灵感位置 · 双击地图" : "Glimpse · 灵感地图"; window.minSize = NSSize(width:375,height:450); window.delegate = self
        let root = NSStackView();root.orientation = .vertical;root.spacing = 10;root.edgeInsets = NSEdgeInsets(top:12,left:12,bottom:12,right:12);root.alignment = .leading
        map.delegate = self;map.translatesAutoresizingMaskIntoConstraints = false;map.mapType = .mutedStandard;map.showsUserLocation = false
        root.addArrangedSubview(map);map.heightAnchor.constraint(greaterThanOrEqualToConstant:300).isActive=true;map.widthAnchor.constraint(equalTo:root.widthAnchor,constant:-24).isActive=true
        status.font = MapVisualTheme.font(15);status.textColor = MapVisualTheme.ink;status.maximumNumberOfLines = 3;root.addArrangedSubview(status)
        list.orientation = .vertical;list.alignment = .leading;list.spacing = 6;root.addArrangedSubview(list)
        window.contentView = root
        if picking {
            status.stringValue = "双击地图放置标记，再点「使用这个位置」。当前位置不会自动当作拍摄地。"
            let gesture = NSClickGestureRecognizer(target:self,action:#selector(pick(_:)));gesture.numberOfClicksRequired=2;map.addGestureRecognizer(gesture)
            let confirm = NSButton(title:"使用这个位置",target:self,action:#selector(confirmLocation));confirm.font=MapVisualTheme.font(18);confirm.bezelColor=MapVisualTheme.green;root.addArrangedSubview(confirm)
        }
        setRecords(records,fit:true)
        window.center();window.makeKeyAndOrderFront(nil)
    }
    func setRecords(_ records:[[String:Any]],fit:Bool){
        map.removeAnnotations(map.annotations)
        list.arrangedSubviews.forEach{list.removeArrangedSubview($0);$0.removeFromSuperview()}
        var groups: [String: [[String: Any]]] = [:]
        for record in records { if let location = record["location"] as? [String:Any], let lat = location["latitude"] as? Double, let lon = location["longitude"] as? Double, location["coordinateSystem"] as? String == "WGS84", CLLocationCoordinate2DIsValid(CLLocationCoordinate2D(latitude:lat,longitude:lon)) { let key = String(format:"%.8f,%.8f",lat,lon);groups[key,default:[]].append(record) } }
        for group in groups.values { let location = group[0]["location"] as! [String:Any];map.addAnnotation(PhotoAnnotation(coordinate:MapCoordinates.display(CLLocationCoordinate2D(latitude:location["latitude"] as! Double,longitude:location["longitude"] as! Double)),records:group)) }
        if fit && !map.annotations.isEmpty { map.showAnnotations(map.annotations,animated:false) } else if fit { map.setRegion(MKCoordinateRegion(center:MapCoordinates.display(CLLocationCoordinate2D(latitude:31.2168,longitude:121.4694)),span:MKCoordinateSpan(latitudeDelta:0.1,longitudeDelta:0.1)),animated:false) }
    }
    @objc func pick(_ gesture:NSClickGestureRecognizer) { choose(map.convert(gesture.location(in:map),toCoordinateFrom:map)) }
    func choose(_ displayed:CLLocationCoordinate2D) { guard CLLocationCoordinate2DIsValid(displayed) else{return};let coordinate=MapCoordinates.storage(displayed);selectedCoordinate=coordinate;map.removeAnnotations(map.annotations);let pin=MKPointAnnotation();pin.coordinate=displayed;pin.title="待确认位置";map.addAnnotation(pin);status.stringValue=String(format:"%.5f, %.5f · WGS-84",coordinate.latitude,coordinate.longitude) }
    @objc func confirmLocation() { guard let coordinate=selectedCoordinate else{status.stringValue="请先双击地图选择位置。";return};finish(["latitude":coordinate.latitude,"longitude":coordinate.longitude,"coordinateSystem":"WGS84","source":"manual","recordedAt":Date().timeIntervalSince1970*1000],nil) }
    static func markerImage(_ records:[[String:Any]]) -> NSImage {
        let output=NSImage(size:NSSize(width:60,height:66));output.lockFocus();MapVisualTheme.paper.setFill();let frame=NSBezierPath(roundedRect:NSRect(x:2,y:6,width:56,height:56),xRadius:6,yRadius:6);frame.fill();MapVisualTheme.ink.setStroke();frame.lineWidth=1.2;frame.stroke()
        if let root=records.first?["thumbnail"] as? String,let comma=root.firstIndex(of:","),let data=Data(base64Encoded:String(root[root.index(after:comma)...])),let image=NSImage(data:data) { image.draw(in:NSRect(x:5,y:9,width:50,height:50),from:.zero,operation:.sourceOver,fraction:1) }
        MapVisualTheme.ink.setFill();let pointer=NSBezierPath();pointer.move(to:NSPoint(x:25,y:6));pointer.line(to:NSPoint(x:30,y:0));pointer.line(to:NSPoint(x:35,y:6));pointer.close();pointer.fill()
        if records.count>1 { let badge=NSRect(x:36,y:42,width:22,height:22);MapVisualTheme.green.setFill();let circle=NSBezierPath(ovalIn:badge);circle.fill();MapVisualTheme.ink.setStroke();circle.lineWidth=1.2;circle.stroke();String(records.count).draw(at:NSPoint(x:42,y:46),withAttributes:[.font:MapVisualTheme.font(12),.foregroundColor:MapVisualTheme.ink]) }
        output.unlockFocus();return output
    }
    func mapView(_ mapView:MKMapView,viewFor annotation:MKAnnotation)->MKAnnotationView? { guard let photo=annotation as? PhotoAnnotation else{return nil};let view=MKAnnotationView(annotation:photo,reuseIdentifier:nil);view.image=Self.markerImage(photo.records);view.centerOffset=NSPoint(x:0,y:-33);view.canShowCallout=false;return view }
    func mapView(_ mapView:MKMapView,didSelect view:MKAnnotationView) { guard let photo=view.annotation as? PhotoAnnotation else{return};select(photo) }
    func select(_ photo:PhotoAnnotation) {
        if photo.records.count==1 { finish(["id":photo.records[0]["id"] as! String],nil);return }
        list.arrangedSubviews.forEach { list.removeArrangedSubview($0);$0.removeFromSuperview() }
        status.stringValue="这个位置有 \(photo.records.count) 次发现，选择要回看的照片。"
        for record in photo.records { let button=RecordMapButton(title:(record["description"] as? String).flatMap{$0.isEmpty ? nil:$0} ?? "未描述的观察",target:self,action:#selector(openRecord(_:)));button.font=MapVisualTheme.font(18);button.recordId=record["id"] as! String;button.image=Self.markerImage([record]);button.imagePosition = .imageLeft;button.imageScaling = .scaleProportionallyDown;list.addArrangedSubview(button) }
    }
    @objc func openRecord(_ button:RecordMapButton) { finish(["id":button.recordId],nil) }
    func mapViewDidFailLoadingMap(_ mapView:MKMapView,withError error:Error) { status.stringValue="底图未能加载。照片与坐标仍可在 Glimpse 日志查看，也可手工修改地点。" }
    func finish(_ value:[String:Any]?,_ error:String?) { let reply=completion;completion=nil;window.close();reply?(value,error) }
    func windowWillClose(_ notification:Notification) { let reply=completion;completion=nil;reply?(nil,"地图已关闭。") }
}
final class MapLocationBridge: NSObject, WKScriptMessageHandlerWithReply, CLLocationManagerDelegate {
    let store: InspirationStore, resourceFolder:URL
    var mapController: PhotoMapController?
    let manager = CLLocationManager()
    var month = "all"
    var observer: NSObjectProtocol?
    var locationReply: ((Any?,String?)->Void)?
    init(store:InspirationStore,resourceFolder:URL) { self.store=store;self.resourceFolder=resourceFolder;super.init();manager.delegate=self
        observer=NotificationCenter.default.addObserver(forName:NSNotification.Name("glimpseRecordChanged"),object:nil,queue:.main){[weak self] note in
            guard let self=self,note.userInfo?["directory"] as? String==self.store.directory.path,let controller=self.mapController,controller.completion != nil,!controller.choosing else{return}
            if let records=try? self.store.list(){controller.setRecords(self.filtered(records),fit:false)}
        }
    }
    deinit{if let observer=observer{NotificationCenter.default.removeObserver(observer)}}
    func filtered(_ records:[[String:Any]])->[[String:Any]]{guard month != "all" else{return records};let formatter=DateFormatter();formatter.dateFormat="yyyy-MM";return records.filter{guard let time=$0["occurredAt"] as? Double else{return false};return formatter.string(from:Date(timeIntervalSince1970:time/1000))==month}}
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage,replyHandler:@escaping(Any?,String?)->Void) {
        guard message.frameInfo.isMainFrame,let url=message.frameInfo.request.url,url.isFileURL,url.standardizedFileURL==resourceFolder.appendingPathComponent("index.html").standardizedFileURL,let body=message.body as? [String:Any],let action=body["action"] as? String else{replyHandler(nil,"无法识别地图请求。");return}
        if action=="current" { guard locationReply==nil else{replyHandler(nil,"正在定位，请稍候。");return};locationReply=replyHandler;manager.requestWhenInUseAuthorization();manager.requestLocation();DispatchQueue.main.asyncAfter(deadline:.now()+15){if let reply=self.locationReply{self.locationReply=nil;reply(nil,"定位未完成。你仍可手工标注或不记录位置。")}};return }
        guard action=="open" || action=="pick" else{replyHandler(nil,"不支持此地图操作。");return}
        guard mapController?.completion==nil else{replyHandler(nil,"地图已打开，请先完成或关闭当前地图。");return}
        do { let ids=body["ids"] as? [String] ?? [];guard ids.count<=1000 else{throw SettingsError.message("单次地图记录过多，请按月筛选。")};month=body["month"] as? String ?? "all";let records=try ids.map { try store.hydrated(store.read($0),preview:false) };mapController=PhotoMapController(records:records,picking:action=="pick"){value,error in replyHandler(value,error)} }
        catch{replyHandler(nil,"地图记录无法读取。照片仍保存在日志中，请重试。")}
    }
    func locationManager(_ manager:CLLocationManager,didUpdateLocations locations:[CLLocation]) { guard let location=locations.last,location.horizontalAccuracy>=0,abs(location.timestamp.timeIntervalSinceNow)<120 else{return};let reply=locationReply;locationReply=nil;reply?(["latitude":location.coordinate.latitude,"longitude":location.coordinate.longitude,"coordinateSystem":"WGS84","source":"current","recordedAt":location.timestamp.timeIntervalSince1970*1000,"accuracy":location.horizontalAccuracy],nil) }
    func locationManager(_ manager:CLLocationManager,didFailWithError error:Error) { let reply=locationReply;locationReply=nil;reply?(nil,"当前位置不可用或未获授权。你仍可手工标注或不记录位置。") }
}
