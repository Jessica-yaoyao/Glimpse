import AppKit
import AVFoundation
import WebKit
import CoreText

private func cameraTexture(_ name:String, size:CGFloat, fallback:NSColor)->NSColor {
    guard let folder=Bundle.main.resourceURL?.appendingPathComponent("WebAssets/assets"),let files=try? FileManager.default.contentsOfDirectory(at:folder,includingPropertiesForKeys:nil),let url=files.first(where:{$0.lastPathComponent.hasPrefix(name+"-")&&$0.pathExtension=="png"}),let image=NSImage(contentsOf:url) else{return fallback}
    image.size=NSSize(width:size,height:size);return NSColor(patternImage:image)
}
final class CameraPaper:NSView {
    let paper=cameraTexture("paper",size:100,fallback:NSColor(calibratedRed:252/255,green:244/255,blue:227/255,alpha:1))
    override func draw(_ dirtyRect:NSRect){paper.setFill();NSBezierPath(rect:bounds).fill()}
}
final class CameraShutter:NSButton {
    let green=cameraTexture("green",size:65,fallback:NSColor(calibratedRed:180/255,green:202/255,blue:112/255,alpha:1))
    override func draw(_ dirtyRect:NSRect){green.setFill();NSBezierPath(roundedRect:bounds.insetBy(dx:1,dy:1),xRadius:26,yRadius:26).fill();let font=NSFont(name:"Xiaolai",size:23) ?? NSFont.systemFont(ofSize:23),ink=NSColor(calibratedRed:22/255,green:24/255,blue:21/255,alpha:isEnabled ? 1:0.45),attributes:[NSAttributedString.Key:Any]=[.font:font,.foregroundColor:ink],size=title.size(withAttributes:attributes);title.draw(at:NSPoint(x:(bounds.width-size.width)/2,y:(bounds.height-size.height)/2),withAttributes:attributes)}
}

final class CameraPreview: NSView {
    let preview: AVCaptureVideoPreviewLayer
    init(session: AVCaptureSession) { preview = AVCaptureVideoPreviewLayer(session: session); super.init(frame:.zero); wantsLayer=true; layer?.backgroundColor=NSColor.black.cgColor; layer?.cornerRadius=9; layer?.borderWidth=1.6; layer?.borderColor=NSColor(calibratedRed:22/255,green:24/255,blue:21/255,alpha:1).cgColor; layer?.masksToBounds=true; preview.videoGravity = .resizeAspect; layer?.addSublayer(preview) }
    required init?(coder:NSCoder) { fatalError() }
    override func layout() { super.layout(); preview.frame=bounds }
}

/// A local client capture window. No automatic permission request or image capture.
final class PhotoCamera: NSObject, NSWindowDelegate, AVCapturePhotoCaptureDelegate {
    let session=AVCaptureSession(), output=AVCapturePhotoOutput(), queue=DispatchQueue(label:"glimpse.camera")
    var window:NSWindow!, captureButton:NSButton!, callback:((Data?,String?)->Void)?
    private let stopLock=NSLock()
    private var cancelled=false
    var stopped:Bool { get {stopLock.lock();defer{stopLock.unlock()};return cancelled} set {stopLock.lock();cancelled=newValue;stopLock.unlock()} }
    var finished=false
    init(parent:NSWindow?, completion:@escaping(Data?,String?)->Void) {
        callback=completion; super.init()
        if let font=Bundle.main.url(forResource:"Xiaolai-Regular",withExtension:"ttf") { CTFontManagerRegisterFontsForURL(font as CFURL,.process,nil) }
        window=NSWindow(contentRect:NSRect(x:0,y:0,width:440,height:610),styleMask:[.titled,.closable],backing:.buffered,defer:false)
        window.title="留住这个瞬间 · Glimpse";window.appearance=NSAppearance(named:.aqua); window.isReleasedWhenClosed=false; window.delegate=self
        window.backgroundColor=NSColor(calibratedRed:252/255,green:244/255,blue:227/255,alpha:1)
        let root=CameraPaper(), preview=CameraPreview(session:session), title=NSTextField(labelWithString:"留住这个瞬间"),note=NSTextField(labelWithString:"仅在你点击拍摄后保存照片。")
        title.font=NSFont(name:"Xiaolai",size:30); note.font=NSFont(name:"Xiaolai",size:15); note.textColor = .secondaryLabelColor
        captureButton=CameraShutter(title:"拍摄照片",target:self,action:#selector(takePhoto)); captureButton.font=NSFont(name:"Xiaolai",size:23); captureButton.isBordered=false; captureButton.wantsLayer=true; captureButton.layer?.backgroundColor=NSColor(calibratedRed:180/255,green:202/255,blue:112/255,alpha:1).cgColor; captureButton.layer?.cornerRadius=26; captureButton.isEnabled=false
        let cancel=NSButton(title:"取消，返回上传",target:self,action:#selector(cancelCapture));cancel.isBordered=false;cancel.font=NSFont(name:"Xiaolai",size:17)
        for view in [title,preview,captureButton!,note,cancel] { view.translatesAutoresizingMaskIntoConstraints=false;root.addSubview(view) }
        NSLayoutConstraint.activate([title.topAnchor.constraint(equalTo:root.topAnchor,constant:22),title.leadingAnchor.constraint(equalTo:root.leadingAnchor,constant:24),preview.topAnchor.constraint(equalTo:title.bottomAnchor,constant:20),preview.leadingAnchor.constraint(equalTo:root.leadingAnchor,constant:24),preview.trailingAnchor.constraint(equalTo:root.trailingAnchor,constant:-24),preview.heightAnchor.constraint(equalToConstant:345),captureButton.topAnchor.constraint(equalTo:preview.bottomAnchor,constant:20),captureButton.leadingAnchor.constraint(equalTo:preview.leadingAnchor),captureButton.trailingAnchor.constraint(equalTo:preview.trailingAnchor),captureButton.heightAnchor.constraint(equalToConstant:53),note.topAnchor.constraint(equalTo:captureButton.bottomAnchor,constant:12),note.centerXAnchor.constraint(equalTo:root.centerXAnchor),cancel.topAnchor.constraint(equalTo:note.bottomAnchor,constant:12),cancel.centerXAnchor.constraint(equalTo:root.centerXAnchor)])
        window.contentView=root;window.center();if let parent=parent {parent.addChildWindow(window,ordered:.above)};window.makeKeyAndOrderFront(nil)
        queue.async { self.configure() }
    }
    func configure() {
        guard !stopped else{return}
        guard let device=AVCaptureDevice.default(for:.video) else {fail("没有可用摄像头，请从相册选择照片。");return}
        do {
            let input=try AVCaptureDeviceInput(device:device);session.beginConfiguration()
            guard session.canAddInput(input),session.canAddOutput(output) else {session.commitConfiguration();fail("摄像头无法打开，请从相册选择照片。");return}
            session.addInput(input);session.addOutput(output);if session.canSetSessionPreset(.photo){session.sessionPreset = .photo}else if session.canSetSessionPreset(.high){session.sessionPreset = .high};session.commitConfiguration();guard !stopped else{return};session.startRunning()
            DispatchQueue.main.async { if !self.finished {self.captureButton.isEnabled=self.session.isRunning;if !self.session.isRunning {self.finish(nil,"摄像头未能启动，请从相册选择照片。")}} }
        } catch { fail("摄像头被占用或不可用，请从相册选择照片。") }
    }
    @objc func takePhoto() {guard !finished,session.isRunning,captureButton.isEnabled else{return};captureButton.isEnabled=false;output.capturePhoto(with:AVCapturePhotoSettings(format:[AVVideoCodecKey:AVVideoCodecType.jpeg]),delegate:self)}
    func photoOutput(_ output:AVCapturePhotoOutput,didFinishProcessingPhoto photo:AVCapturePhoto,error:Error?) {guard error==nil,let data=photo.fileDataRepresentation(),!data.isEmpty,data.count<=30*1024*1024 else {fail("照片生成失败，请重新拍摄或从相册选择。");return};DispatchQueue.main.async{self.finish(data,nil)}}
    func fail(_ message:String){DispatchQueue.main.async{self.finish(nil,message)}}
    @objc func cancelCapture(){finish(nil,nil)}
    func windowShouldClose(_ sender:NSWindow)->Bool {finish(nil,nil);return false}
    func finish(_ data:Data?,_ error:String?) {guard !finished else{return};finished=true;stopped=true;captureButton.isEnabled=false;window.parent?.removeChildWindow(window);window.delegate=nil;window.close();queue.async{if self.session.isRunning{self.session.stopRunning()}};let done=callback;callback=nil;done?(data,error)}
}

final class CameraBridge: NSObject, WKScriptMessageHandlerWithReply {
    let folder:URL
    var pending:String?, reply:((Any?,String?)->Void)?, camera:PhotoCamera?
    init(folder:URL){self.folder=folder;super.init()}
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage,replyHandler:@escaping(Any?,String?)->Void) {
        guard message.frameInfo.isMainFrame,let url=message.frameInfo.request.url,url.isFileURL,url.standardizedFileURL==folder.appendingPathComponent("index.html").standardizedFileURL,let body=message.body as? [String:Any],let id=body["requestId"] as? String,UUID(uuidString:id) != nil else{replyHandler(nil,"无法识别拍照请求。");return}
        if body["action"] as? String == "cancel" {if pending==id{if let camera=camera{camera.cancelCapture()}else{finish(id,data:nil,error:nil)}};replyHandler(true,nil);return}
        guard body["action"] as? String == "capture",pending==nil else{replyHandler(nil,"相机正在使用，请关闭后重试。");return}
        pending=id;reply=replyHandler
        switch AVCaptureDevice.authorizationStatus(for:.video) {
        case .authorized:show(id,parent:(message.webView?.window))
        case .notDetermined:AVCaptureDevice.requestAccess(for:.video){allowed in DispatchQueue.main.async{guard self.pending==id else{return};if allowed{self.show(id,parent:message.webView?.window)}else{self.finish(id,data:nil,error:"相机权限未开启，你仍可以从相册选择照片。")}}}
        default:finish(id,data:nil,error:"相机权限未开启，可在系统设置允许摄像头，或从相册选择照片。")
        }
    }
    func show(_ id:String,parent:NSWindow?){guard pending==id else{return};camera=PhotoCamera(parent:parent){data,error in self.finish(id,data:data,error:error)}}
    func finish(_ id:String,data:Data?,error:String?){guard pending==id else{return};let done=reply;pending=nil;reply=nil;camera=nil;done?(data.map{"data:image/jpeg;base64,"+$0.base64EncodedString()},error)}
}
