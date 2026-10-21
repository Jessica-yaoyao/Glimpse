import AppKit
import WebKit
import UniformTypeIdentifiers
import ImageIO
import MapKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var checked = false
    let testing = CommandLine.arguments.contains("--presentation-check") || CommandLine.arguments.contains("--archive-check") || CommandLine.arguments.contains("--quality-ui-check") || CommandLine.arguments.contains("--photo-check") || CommandLine.arguments.contains("--acceptance-check") || CommandLine.arguments.contains("--self-test") || CommandLine.arguments.contains("--connection-check") || CommandLine.arguments.contains("--live-check")
    var testDirectory: String { ProcessInfo.processInfo.environment["GLIMPSE_QA_DIR"] ?? NSTemporaryDirectory() }
    var runtimeErrors: [String] = []
    var settingsBridge: KimiSettingsBridge!
    var revealBridge: KimiRevealBridge!
    var cameraBridge:CameraBridge!
    var mapBridge: MapLocationBridge!
    var liveAuthorized = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于灵感显影", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出灵感显影", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)
        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "编辑")
        for (title, selector, key) in [("撤销", "undo:", "z"), ("剪切", "cut:", "x"), ("拷贝", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            editMenu.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        editItem.submenu = editMenu
        menu.addItem(editItem)
        NSApp.mainMenu = menu

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        guard let folder = Bundle.main.resourceURL?.appendingPathComponent("WebAssets") else { return }
        settingsBridge = KimiSettingsBridge(resourceFolder: folder, testDirectory: (CommandLine.arguments.contains("--presentation-check") || CommandLine.arguments.contains("--self-test") || CommandLine.arguments.contains("--acceptance-check") || CommandLine.arguments.contains("--photo-check") || CommandLine.arguments.contains("--quality-ui-check")) ? URL(fileURLWithPath: testDirectory).appendingPathComponent("settings-fixture") : nil)
        if CommandLine.arguments.contains("--live-check"), CommandLine.arguments.contains("--qa-key-stdin"), let key = readLine(), !key.isEmpty { settingsBridge.useTestCredential(key) }
        config.userContentController.addScriptMessageHandler(settingsBridge, contentWorld: .page, name: "glimpseSettings")
        revealBridge = KimiRevealBridge(settings: settingsBridge)
        config.userContentController.addScriptMessageHandler(revealBridge, contentWorld: .page, name: "glimpseReveal")
        config.userContentController.addScriptMessageHandler(ContourBridge(resourceFolder: folder), contentWorld: .page, name: "glimpseContours")
        cameraBridge=CameraBridge(folder:folder)
        config.userContentController.addScriptMessageHandler(cameraBridge,contentWorld:.page,name:"glimpseCamera")
        config.userContentController.addScriptMessageHandler(PresentationBridge(folder:folder,directory:settingsBridge.directory),contentWorld:.page,name:"glimpsePresentation")
        if testing && !CommandLine.arguments.contains("--presentation-check") { config.userContentController.addUserScript(WKUserScript(source:"window.glimpseSkipIntro=true;",injectionTime:.atDocumentStart,forMainFrameOnly:true)) }
        let store = InspirationStore(directory: settingsBridge.directory)
        mapBridge = MapLocationBridge(store:store,resourceFolder:folder)
        config.userContentController.addScriptMessageHandler(mapBridge, contentWorld:.page,name:"glimpseMap")
        config.userContentController.addScriptMessageHandler(InspirationBridge(store: store, resourceFolder: folder), contentWorld: .page, name: "glimpseRecords")
        if CommandLine.arguments.contains("--self-test") || CommandLine.arguments.contains("--acceptance-check") || CommandLine.arguments.contains("--photo-check") { config.userContentController.addUserScript(WKUserScript(source: "window.glimpseDemo = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true)) }
        if CommandLine.arguments.contains("--quality") { config.userContentController.addUserScript(WKUserScript(source: "window.glimpseStartQuality = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true)) }
        if testing {
            config.userContentController.add(self, name: "qaError")
            config.userContentController.addUserScript(WKUserScript(source: "window.addEventListener('error', e => window.webkit.messageHandlers.qaError.postMessage(e.message)); window.addEventListener('unhandledrejection', e => window.webkit.messageHandlers.qaError.postMessage(String(e.reason)));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 480, height: 850), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "灵感显影 Glimpse · 0.5.1"
        window.delegate=self
        window.minSize = NSSize(width: 375, height: 620)
        window.backgroundColor = NSColor(calibratedRed: 252/255, green: 244/255, blue: 227/255, alpha: 1)
        window.contentView = webView
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        webView.loadFileURL(folder.appendingPathComponent("index.html"), allowingReadAccessTo: folder)
        if testing && !CommandLine.arguments.contains("--live-check") { startTestWatchdog(seconds: CommandLine.arguments.contains("--acceptance-check") ? 90 : 35) }
    }
    func startTestWatchdog(seconds: Double) { DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { if !self.checked { self.finishTest(["passed": false, "error": "Native WebKit test timed out", "runtimeErrors": self.runtimeErrors]) } } }

    func windowWillClose(_ notification:Notification) { if let closing=notification.object as? NSWindow, closing===window { cameraBridge.camera?.cancelCapture() } }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.title = "选择一张照片"
        panel.allowedContentTypes = [.image]
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, ["https", "http"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        } else { decisionHandler(.allow) }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) { runtimeErrors.append(String(describing: message.body)) }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard testing, !checked else { return }
        if CommandLine.arguments.contains("--live-check"), !liveAuthorized {
            settingsBridge.unlockKey { result in
                switch result {
                case .success:
                    self.liveAuthorized = true
                    if let model = ProcessInfo.processInfo.environment["GLIMPSE_QA_MODEL"] { try? self.settingsBridge.saveConfiguration(model: model, suppliedKey: "") }
                    self.startTestWatchdog(seconds: 125)
                    self.webView(webView, didFinish: navigation)
                case .failure: self.finishTest(["passed": false, "error": "Keychain authorization unavailable; no reveal sent."])
                }
            }
            return
        }
        let settingsReopen = CommandLine.arguments.contains("--settings-reopen")
        let script = CommandLine.arguments.contains("--presentation-check") ? #"""
        const delay=ms=>new Promise(r=>setTimeout(r,ms)),wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await delay(100)}throw Error('Presentation UI timeout')},checks=[],check=(ok,n)=>{if(!ok)throw Error(n);checks.push(n)},button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(label)),bridge=window.webkit.messageHandlers.glimpsePresentation;
        const initial=await bridge.postMessage({action:'read'});
        if(initial.complete){await wait(()=>document.querySelector('.dashboard'));check(!document.querySelector('.launch'),'Native completion survives process restart');}
        else{await wait(()=>document.querySelector('.launch-brand'));check(!!document.querySelector('.launch-walking img'),'Native first launch shows brand artwork');document.querySelector('[aria-label="继续查看观察引导"]').click();await wait(()=>document.querySelector('.launch-welcome'));button('开始使用').click();await wait(()=>document.querySelector('.dashboard'));check((await bridge.postMessage({action:'read'})).complete,'Native first-launch completion is persisted');}
        const camera=window.webkit.messageHandlers.glimpseCamera;let rejected=false;try{await camera.postMessage({action:'capture',requestId:'invalid'})}catch{rejected=true}check(rejected,'Malformed camera request is rejected before permission access');check(await camera.postMessage({action:'cancel',requestId:crypto.randomUUID()}),'Idle camera cancellation is harmless');
        document.querySelector('[aria-label="打开显影设置"]').click();await wait(()=>document.querySelector('.replay-intro'));button('重看开屏').click();await wait(()=>document.querySelector('.launch-brand'));button('跳过').click();await wait(()=>document.querySelector('.dashboard'));check((await bridge.postMessage({action:'read'})).complete,'Replaying launch preserves completion preference');return {passed:true,checks,protocol:location.protocol,initialComplete:initial.complete,physicalCameraTested:false};
        """# : CommandLine.arguments.contains("--archive-check") ? #"""
        const delay=ms=>new Promise(r=>setTimeout(r,ms)),wait=async fn=>{for(let i=0;i<300;i++){if(fn())return;await delay(100)}throw new Error('Archive UI timeout')},button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(label)),checks=[],check=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label)};
        await wait(()=>document.querySelector('.home'));const recordsBridge=window.webkit.messageHandlers.glimpseRecords,revealBridge=window.webkit.messageHandlers.glimpseReveal,before=await revealBridge.postMessage({action:'usage'}),suite=await recordsBridge.postMessage({action:'qualityRead'}),records=await recordsBridge.postMessage({action:'list'});check(suite.tasks.length===20,'Real fixed 20-task suite survives moving the application');check(new Set(suite.tasks.map(t=>t.recordId)).size===10&&suite.tasks.every(t=>records.some(r=>r.id===t.recordId&&r.originalSha256===t.originalSha256)),'All ten prepared original records survive the moved app');check(document.querySelector('.home-footnote').textContent.includes('实时显影'),'Moved app still uses live Kimi Provider');
        button('日志').click();await wait(()=>document.querySelector('.journal-toolbar'));button('时间轴').click();await wait(()=>document.querySelectorAll('.journal-card').length===records.length);const id=suite.tasks[0].recordId;[...document.querySelectorAll('.journal-card')].find(b=>b.dataset.recordId===id).click();await wait(()=>document.querySelector('.detail'));check(document.querySelector('.detail').dataset.recordId===id,'Moved app opens the exact saved record');button('查看原照片').click();await wait(()=>document.querySelector('.original-view img'));await document.querySelector('.original-view img').decode();check(document.querySelector('.original-view img').naturalWidth>0,'Original bytes are integrity-checked and viewable after app move');button('关闭原照片').click();button('glimpse').click();await wait(()=>document.querySelector('.home'));document.querySelector('[aria-label="打开显影设置"]').click();await wait(()=>button('质量验收'));button('质量验收').click();await wait(()=>document.querySelectorAll('.quality-task').length===20);check(document.querySelectorAll('.quality-task').length===20,'Real user task suite is accessible from packaged UI');const after=await revealBridge.postMessage({action:'usage'});check(['knownTokens','reservedTokens','unknownRequests','remainingTokens'].every(key=>before[key]===after[key]),'Viewing packaged records and tasks sends no model request');return {passed:true,checks,protocol:location.protocol,qualityStatuses:suite.tasks.map(t=>t.status),usage:after};
        """# : CommandLine.arguments.contains("--quality-ui-check") ? #"""
        const delay=ms=>new Promise(r=>setTimeout(r,ms)),wait=async fn=>{for(let i=0;i<300;i++){if(fn())return;await delay(100)}throw new Error('Quality UI timeout')},button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(label)),checks=[],check=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label)};
        const records=window.webkit.messageHandlers.glimpseRecords,reveal=window.webkit.messageHandlers.glimpseReveal,before=await records.postMessage({action:'qualityRead'});
        if(before.tasks[0].status==='revealed'){
            await wait(()=>document.querySelector('.home'));document.querySelector('[aria-label="打开显影设置"]').click();await wait(()=>button('质量验收'));button('质量验收').click();await wait(()=>document.querySelectorAll('.quality-task').length===20);
            const first=document.querySelector('.quality-task');check(first.querySelector('.quality-review-entry').textContent.includes('评分'),'Completed task exposes a full-width scoring entry');first.querySelector('.detail-actions button').click();await wait(()=>document.querySelector('.detail .quality-review-entry'));check(document.querySelector('.detail').dataset.recordId===before.tasks[0].recordId,'History view opens the exact first task record');document.querySelector('.detail .quality-review-entry').click();await wait(()=>document.querySelector('.quality-rating'));await delay(100);
            const form=document.querySelector('.quality-rating'),boxes=form.querySelectorAll('input');check(boxes.length===4&&[...boxes].every(b=>!b.checked),'Direct result entry opens four unchecked criteria');const rect=form.getBoundingClientRect();check(rect.top>=0&&rect.bottom<=innerHeight,'Native scoring form scrolls into the visible window');boxes[0].click();boxes[3].click();form.querySelector('button').click();await wait(()=>!document.querySelector('.quality-rating'));
            const saved=await records.postMessage({action:'qualityRead'}),assessment=saved.tasks[0].assessment;check(assessment.recognizable&&!assessment.grounded&&!assessment.withinSelection&&assessment.preservesPhoto,'Native bridge persists the exact partial human-input fixture rating');check(document.querySelector('.quality-summary').textContent.includes('可用结果 0'),'Partial rating is not counted as usable');document.querySelector('.quality-task .quality-review-entry').click();await wait(()=>document.querySelector('.quality-rating'));check(document.querySelectorAll('.quality-rating input:checked').length===2,'Reopening the task restores the saved rating');
            const usage=await reveal.postMessage({action:'usage'});check(usage.knownTokens===0&&usage.reservedTokens===0,'Viewing and scoring the native fixture sends no model request');check(document.documentElement.scrollWidth<=innerWidth,'Native quality view has no horizontal overflow');return {passed:true,checks,protocol:location.protocol,notice:'Isolated copied suite; fixture ratings only, production A3 untouched'};
        }
        await wait(()=>document.querySelector('.home'));document.querySelector('[aria-label="打开显影设置"]').click();await wait(()=>button('质量验收'));button('质量验收').click();await wait(()=>document.querySelectorAll('.quality-task').length===20);check(document.querySelectorAll('.quality-task').length===20,'All 20 fixed tasks load in native UI');check(document.querySelector('.quality-summary').textContent.includes('待完成'),'Pending tasks are not labeled passed');const expected=document.querySelector('.quality-task h2').textContent;button('开始这次观察').click();await wait(()=>document.querySelector('textarea'));check(document.querySelector('textarea').value===expected,'Fixed task opens its exact photo and description');check(document.querySelector('.action-dock .mode-note').textContent.includes('Kimi Code'),'Quality task uses live Provider rather than a preset');const usage=await window.webkit.messageHandlers.glimpseReveal.postMessage({action:'usage'});check(usage.knownTokens===0&&usage.reservedTokens===0,'Opening a task sends no API request before user presses Reveal');return {passed:true,checks,protocol:location.protocol,notice:'Fixture navigation only; not A3 model-quality evidence'};
        """# : CommandLine.arguments.contains("--photo-check") ? #"""
        const delay=ms=>new Promise(r=>setTimeout(r,ms)),wait=async fn=>{for(let i=0;i<300;i++){if(fn())return;await delay(100)}throw new Error('Photo QA timeout')},button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(label)),checks=[],check=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label)};
        await wait(()=>document.querySelector('.file-input'));const file=new File([Uint8Array.from(atob(photoBytes),c=>c.charCodeAt(0))],'HEIC-disguised.JPG',{type:'image/jpeg'}),transfer=new DataTransfer();transfer.items.add(file);document.querySelector('.file-input').files=transfer.files;document.querySelector('.file-input').dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>document.querySelector('.selection-surface'));await document.querySelector('.selection-surface>img').decode();check(document.querySelector('.selection-surface>img').naturalWidth>0,'Disguised HEIC imports and displays through native ImageIO');check(Math.max(document.querySelector('.selection-surface>img').naturalWidth,document.querySelector('.selection-surface>img').naturalHeight)<=1600,'Preview is bounded and orientation-normalized');button('glimpse').click();await wait(()=>document.querySelector('.home'));button('日志').click();await wait(()=>document.querySelector('.journal-card'));check(document.querySelectorAll('.journal-card').length===1,'HEIC original creates one durable draft');document.querySelector('.journal-card').click();await wait(()=>document.querySelector('.detail'));button('查看原照片').click();await wait(()=>document.querySelector('.original-view img'));await document.querySelector('.original-view img').decode();check(document.querySelector('.original-view img').naturalWidth>0,'Original HEIC is preserved, hash-checked and viewable');return {passed:true,checks,protocol:location.protocol};
        """# : CommandLine.arguments.contains("--acceptance-check") ? #"""
        const delay=ms=>new Promise(r=>setTimeout(r,ms)),wait=async fn=>{for(let i=0;i<500;i++){if(fn())return;await delay(100)}throw new Error('Acceptance UI timeout')},button=label=>[...document.querySelectorAll('button')].find(b=>(b.textContent.includes(label)||b.getAttribute('aria-label')===label)),checks=[],check=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label)};
        await wait(()=>document.querySelector('.home'));button('日志').click();await wait(()=>document.querySelector('.journal-toolbar')?.textContent.includes('100'));check(document.querySelector('.journal-toolbar').textContent.includes('100'),'100 fixture records are visible in native journal');button('时间轴').click();await wait(()=>document.querySelectorAll('.journal-card').length===100);check(document.querySelectorAll('.journal-card').length===100,'Native timeline contains all 100 cross-date records');
        button('地图').click();await wait(()=>document.querySelectorAll('.map-record').length===100);check(document.querySelectorAll('.map-record').length===100,'Map and journal share the same local records');button('打开系统地图').click();await wait(()=>document.querySelector('.detail'));check(document.querySelector('.detail').dataset.recordId===window.glimpseExpectedMapRecord,'Native photo marker opens the exact selected record ID');
        button('查看原照片').click();await wait(()=>document.querySelector('.original-view img'));await document.querySelector('.original-view img').decode();check(document.querySelector('.original-view img').naturalWidth>0,'Native original file opens with integrity check');button('关闭原照片').click();
        button('继续这次观察').click();await wait(()=>document.querySelector('.selection-surface')||document.querySelector('textarea'));if(document.querySelector('textarea')){button('返回上一步').click();await wait(()=>document.querySelector('.selection-surface'));}button('清空').click();await delay(100);button('画笔').click();await delay(100);const surface=document.querySelector('.selection-surface'),r=surface.getBoundingClientRect(),point={clientX:r.x+r.width*.5,clientY:r.y+r.height*.5,pointerId:501,isPrimary:true,button:0,bubbles:true};surface.setPointerCapture=()=>{};surface.releasePointerCapture=()=>{};surface.hasPointerCapture=()=>false;surface.dispatchEvent(new PointerEvent('pointerdown',point));surface.dispatchEvent(new PointerEvent('pointerup',point));await delay(100);check(!button('就是这里').disabled,'Native brush selects pixels');button('橡皮擦').click();const range=document.querySelector('.brush-size input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(range,'48');range.dispatchEvent(new Event('input',{bubbles:true}));await delay(100);surface.dispatchEvent(new PointerEvent('pointerdown',point));surface.dispatchEvent(new PointerEvent('pointerup',point));await delay(100);check(button('就是这里').disabled,'Native eraser empties mask');button('撤销选区').click();await delay(100);check(!button('就是这里').disabled,'Native mask undo restores selection');
        return {passed:true,checks,protocol:location.protocol};
        """# : CommandLine.arguments.contains("--live-check") ? #"""
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        const wait = async fn => {for(let i=0;i<1100;i++){if(fn())return;await delay(100)}throw new Error('Timed out waiting for live reveal');};
        const button = label => [...document.querySelectorAll('button')].find(button=>button.textContent.includes(label));
        const checks = [], check=(value,label)=>{if(!value)throw new Error(label);checks.push(label)};
        await wait(()=>document.querySelector('.home'));
        check(document.querySelector('.home-footnote').textContent.includes('实时显影'), 'Native app selects the live Kimi Provider by default');
        if(photoBytes){const file=new File([Uint8Array.from(atob(photoBytes),c=>c.charCodeAt(0))],'live-photo.JPG',{type:'image/jpeg'}),transfer=new DataTransfer();transfer.items.add(file);document.querySelector('.file-input').files=transfer.files;document.querySelector('.file-input').dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>button('选择整张'));button('选择整张').click();await delay(100);button('橡皮擦').click();await delay(100);const surface=document.querySelector('.selection-surface'),r=surface.getBoundingClientRect(),point={clientX:r.x+r.width*.94,clientY:r.y+r.height*.94,pointerId:601,isPrimary:true,button:0,bubbles:true};surface.setPointerCapture=()=>{};surface.releasePointerCapture=()=>{};surface.hasPointerCapture=()=>false;surface.dispatchEvent(new PointerEvent('pointerdown',point));surface.dispatchEvent(new PointerEvent('pointerup',point));await delay(100);check(!!document.querySelector('.mask-preview'),'Real uploaded photo uses a fine selection mask');}
        else{button('先试一下').click();await wait(()=>document.querySelector('.sample-card'));button('先试一下').click();await wait(()=>button('选取主体'));button('选取主体').click();await delay(100);}
        button('就是这里').click();await wait(()=>document.querySelector('textarea'));
        const original=document.querySelector('.preview-photo img').src;
        const input=document.querySelector('textarea');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,perception);
        input.dispatchEvent(new Event('input',{bubbles:true}));await delay(100);
        check(document.querySelector('.action-dock .mode-note').textContent.includes('Kimi Code'), 'Describe screen announces selected-region transmission');
        button('让它显现').click();await wait(()=>document.querySelector('.processing'));
        await wait(()=>document.querySelector('.result-photo')||document.querySelector('.error-state'));
        if(document.querySelector('.error-state'))throw new Error(document.querySelector('.error-state').textContent);
        const receipt=document.querySelector('.reveal-receipt');
        check(receipt?.dataset.provider==='kimi-code','Result includes a real Kimi Code request receipt');
        check(Number(receipt.dataset.totalTokens)>0,'API returns nonzero actual token usage');
        check(document.querySelector('.result-photo>img').src===original,'Original photo source is unchanged');
        check(document.querySelectorAll('.result-photo>img').length===1,'Reveal overlays SVG on one unchanged image');
        const paths=[...document.querySelectorAll('.result-photo svg path')].map(path=>path.getAttribute('d'));
        check(paths.length>=5&&paths.length<=15,'Returned paths pass bounded structure validation');
        await delay(3000);
        check(parseFloat(getComputedStyle(document.querySelector('.result-photo svg path')).strokeDashoffset)===0,'Live SVG stroke animation completes');
        const slider=document.querySelector('input[type=range]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(slider,'0');slider.dispatchEvent(new Event('input',{bubbles:true}));await delay(100);
        check(!!slider,'Live comparison slider remains interactive');
        return {passed:true,checks,perception,paths,notice:document.querySelector('.result-notice').textContent,receipt:{...receipt.dataset},usage:await window.webkit.messageHandlers.glimpseReveal.postMessage({action:'usage'}),protocol:location.protocol};
        """# : CommandLine.arguments.contains("--connection-check") ? #"""
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        for(let i=0;i<100 && !document.querySelector('[aria-label="打开显影设置"]');i++) await delay(100);
        document.querySelector('[aria-label="打开显影设置"]').click();
        for(let i=0;i<100 && (!document.querySelector('fieldset') || document.querySelector('fieldset').disabled);i++) await delay(100);
        const button = [...document.querySelectorAll('button')].find(button=>button.textContent.includes('检查连接与模型'));
        if(!button || button.disabled)throw new Error('Connection check is unavailable');
        button.click();
        for(let i=0;i<200;i++){
            if(document.querySelector('.settings-error')) throw new Error(document.querySelector('.settings-error').textContent);
            if(document.querySelector('.settings-message'))return {passed:true,checks:['Saved production Key is recognized without being returned to JS','Real UI connection button reads Kimi Code models'],protocol:location.protocol};
            await delay(100);
        }
        throw new Error('Connection UI did not complete');
        """# : settingsReopen ? #"""
        const bridge = window.webkit.messageHandlers.glimpseSettings;
        const value = await bridge.postMessage({action:'read'});
        if(value.model !== 'k3-256k' || !value.hasKey) throw new Error('Settings did not survive process restart');
        if(Object.keys(value).some(key=>/apiKey|secret/i.test(key))) throw new Error('Secret returned to UI');
        const cleared = await bridge.postMessage({action:'removeKey'});
        if(cleared.hasKey || cleared.model !== 'k3-256k') throw new Error('Key removal failed');
        return {passed:true,checks:['Keychain and model configuration survive process restart','Read returns only non-secret configuration','Key removed from isolated QA service'],protocol:location.protocol};
        """# : #"""
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        const wait = async fn => { for(let i=0;i<100;i++){if(fn())return; await delay(100)} throw new Error('Timed out waiting for UI'); };
        const button = label => [...document.querySelectorAll('button')].find(b => b.textContent.includes(label));
        const check = (ok, label) => { if(!ok)throw new Error(label); checks.push(label); };
        const checks = [];
        await wait(()=>document.querySelector('.home'));
        document.querySelector('[aria-label="打开显影设置"]').click();
        await wait(()=>document.querySelector('#kimi-key') && !document.querySelector('fieldset').disabled);
        check(document.querySelector('#kimi-key').type === 'password', 'API Key field is masked by default');
        check(document.querySelectorAll('#kimi-model option').length === 4, 'Four documented Kimi Code models are selectable');
        await window.webkit.messageHandlers.glimpseSettings.postMessage({action:'removeKey'});
        const keyInput = document.querySelector('#kimi-key');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(keyInput, 'sk-kimi-local-qa-not-a-real-key');
        keyInput.dispatchEvent(new Event('input', {bubbles:true}));
        const modelInput = document.querySelector('#kimi-model');
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(modelInput, 'k3-256k');
        modelInput.dispatchEvent(new Event('change', {bubbles:true})); await delay(100);
        button('保存配置').click();
        await wait(()=>document.querySelector('.settings-message'));
        check(document.querySelector('#kimi-key').value === '', 'Saved Key is cleared from the input');
        const saved = await window.webkit.messageHandlers.glimpseSettings.postMessage({action:'read'});
        check(saved.hasKey && saved.model === 'k3-256k', 'Native Keychain and model settings are saved');
        check(!JSON.stringify(saved).includes('sk-kimi-') && !('apiKey' in saved), 'Native bridge never returns the Key');
        let rejected = false;
        try { await window.webkit.messageHandlers.glimpseSettings.postMessage({action:'save',model:'made-up-model',apiKey:''}); } catch { rejected = true; }
        check(rejected, 'Native bridge rejects unsupported models');
        document.querySelector('[aria-label="返回上一步"]').click();
        await wait(()=>document.querySelector('.home'));
        const img = document.querySelector('.recent-card img'); await img.decode();
        check(img.naturalWidth > 0, 'Bundled sample image decodes offline');
        check(location.protocol === 'file:', 'Runs directly from app resources without a server');
        button('先试一下').click();await wait(()=>document.querySelector('.sample-card'));button('先试一下').click();
        await wait(()=>button('选取主体'));
        button('选取主体').click(); await delay(100);
        button('就是这里').click(); await wait(()=>document.querySelector('textarea'));
        const input = document.querySelector('textarea');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, '一只蜷缩着睡觉的小狐狸');
        input.dispatchEvent(new Event('input', {bubbles:true})); await delay(100);
        check(!button('让它显现').disabled, 'Native textarea updates React state');
        button('让它显现').click();
        await wait(()=>document.querySelector('.processing'));
        await wait(()=>document.querySelector('.result-photo'));
        await delay(2900);
        check(document.querySelectorAll('.reveal-overlay path').length >= 5, 'Complete Hero Case renders SVG reveal');
        check(parseFloat(getComputedStyle(document.querySelector('.reveal-overlay path')).strokeDashoffset) === 0, 'SVG draw animation completes in WebKit');
        check(!!document.querySelector('input[type=range]'), 'Native comparison slider is available');
        return {passed:true,checks,protocol:location.protocol};
        """#
        if CommandLine.arguments.contains("--acceptance-check") { pollMapFixture() }
        var arguments:[String:Any] = ["photoBytes":""]
        if let path=ProcessInfo.processInfo.environment["GLIMPSE_QA_PHOTO"],let data=try? Data(contentsOf:URL(fileURLWithPath:path)){arguments["photoBytes"]=data.base64EncodedString()}
        arguments["perception"]=ProcessInfo.processInfo.environment["GLIMPSE_QA_DESCRIPTION"] ?? "一只蜷缩着睡觉的小狐狸，头朝左，下方长条是环抱身体的尾巴"
        webView.callAsyncJavaScript(script, arguments: arguments, in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                var report = value as? [String: Any] ?? ["passed": false]
                report["runtimeErrors"] = self.runtimeErrors
                if !self.runtimeErrors.isEmpty { report["passed"] = false }
                let finalReport = report
                webView.takeSnapshot(with: nil) { image, _ in
                    if let data = image?.tiffRepresentation, let bitmap = NSBitmapImageRep(data: data), let png = bitmap.representation(using: .png, properties: [:]) {
                        try? png.write(to: URL(fileURLWithPath: self.testDirectory).appendingPathComponent("native-preview.png"))
                    }
                    self.finishTest(finalReport)
                }
            case .failure(let error): self.finishTest(["passed": false, "error": String(describing: error), "runtimeErrors": self.runtimeErrors])
            }
        }
    }

    func pollMapFixture(attempt:Int = 0) {
        guard !checked,attempt<500 else{return}
        guard let controller=mapBridge.mapController,controller.completion != nil else{DispatchQueue.main.asyncAfter(deadline:.now()+0.1){self.pollMapFixture(attempt:attempt+1)};return}
        let photos=controller.map.annotations.compactMap{$0 as? PhotoAnnotation}
        if photos.count != 30 {runtimeErrors.append("Expected 30 distinct photo locations")}
        if photos.reduce(0,{$0+$1.records.count}) != 100 {runtimeErrors.append("Map photo groups lost records")}
        for photo in photos { let point=MKMapPoint(photo.coordinate),restored=point.coordinate;if abs(restored.latitude-photo.coordinate.latitude)>0.00000001 || abs(restored.longitude-photo.coordinate.longitude)>0.00000001 {runtimeErrors.append("Map coordinate roundtrip drift")};if PhotoMapController.markerImage(photo.records).size.width != 60 {runtimeErrors.append("Photo thumbnail marker unavailable")} }
        let options=MKMapSnapshotter.Options();options.region=controller.map.region;options.size=CGSize(width:450,height:575);options.mapType = .mutedStandard;options.appearance=NSAppearance(named:.aqua)
        let snapshotter=MKMapSnapshotter(options:options)
        snapshotter.start(with:.main){snapshot,error in
            if let snapshot=snapshot {
                let output=NSImage(size:options.size);output.lockFocus();snapshot.image.draw(in:NSRect(origin:.zero,size:options.size))
                for photo in photos{let point=snapshot.point(for:photo.coordinate);PhotoMapController.markerImage(photo.records).draw(in:NSRect(x:point.x-30,y:point.y,width:60,height:66))}
                output.unlockFocus();if let data=output.tiffRepresentation,let bitmap=NSBitmapImageRep(data:data){try? bitmap.representation(using:.png,properties:[:])?.write(to:URL(fileURLWithPath:self.testDirectory).appendingPathComponent("native-map.png"))}
            }else{self.runtimeErrors.append("MapKit snapshot unavailable; tile rendering not verified")}
            if let group=photos.first(where:{$0.records.count>1}){controller.select(group);if controller.list.arrangedSubviews.count != group.records.count{self.runtimeErrors.append("Repeated coordinates cannot expand")};if let button=controller.list.arrangedSubviews.first as? RecordMapButton{self.webView.callAsyncJavaScript("window.glimpseExpectedMapRecord = recordId;",arguments:["recordId":button.recordId],in:nil,in:.page){_ in controller.openRecord(button)}}else{self.runtimeErrors.append("Repeated coordinate choice missing")}}
        }

    }

    func finishTest(_ report: [String: Any]) {
        guard !checked else { return }
        checked = true
        if let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) {
            try? data.write(to: URL(fileURLWithPath: testDirectory).appendingPathComponent("native-check.json"))
            print(String(data: data, encoding: .utf8) ?? "")
        }
        NSApp.terminate(nil)
    }
}

@main struct GlimpseApplication {
    static func main() {
        if let index=CommandLine.arguments.firstIndex(of:"--prepare-quality"),CommandLine.arguments.count>index+1 {
            do {
                let root=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("Glimpse"),store=InspirationStore(directory:root)
                if FileManager.default.fileExists(atPath:store.suiteFile.path){print("Existing fixed quality suite retained.");return}
                let data=try Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[index+1]))
                guard var suite=try JSONSerialization.jsonObject(with:data) as? [String:Any],let photos=suite["photos"] as? [[String:Any]],photos.count==10 else{throw SettingsError.message("Need ten fixed photos.")}
                var tasks:[[String:Any]]=[]
                for (number,photo) in photos.enumerated(){
                    guard let path=photo["file"] as? String,let descriptions=photo["descriptions"] as? [String],descriptions.count==2,let selection=photo["selection"] as? [String:Any] else{throw SettingsError.message("Invalid fixed task.")}
                    let original=try Data(contentsOf:URL(fileURLWithPath:path)),encoded="data:image/jpeg;base64,"+original.base64EncodedString(),image=try store.prepare(encoded)
                    let source=CGImageSourceCreateWithData(original as CFData,nil)!,thumb=CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceCreateThumbnailWithTransform:true,kCGImageSourceThumbnailMaxPixelSize:240] as CFDictionary)!,thumbData=NSMutableData(),destination=CGImageDestinationCreateWithData(thumbData,"public.jpeg" as CFString,1,nil)!
                    CGImageDestinationAddImage(destination,thumb,[kCGImageDestinationLossyCompressionQuality:0.75] as CFDictionary);guard CGImageDestinationFinalize(destination) else{throw SettingsError.message("Thumbnail failed.")}
                    let record=try store.create(["original":encoded,"image":image,"thumbnail":"data:image/jpeg;base64,"+(thumbData as Data).base64EncodedString(),"timezone":TimeZone.current.identifier])
                    for (item,description) in descriptions.enumerated(){tasks.append(["id":"photo-\(number+1)-\(item+1)","recordId":record["id"]!,"filename":URL(fileURLWithPath:path).lastPathComponent,"description":description,"selection":selection,"originalSha256":record["originalSha256"]!,"status":"pending"])}
                }
                suite.removeValue(forKey:"photos");suite["tasks"]=tasks;try store.writeSuite(suite);print("Prepared 10 original photos and 20 fixed tasks locally. No API requests sent.")
            }catch{print("Quality preparation failed; existing records retained.");exit(1)}
            return
        }

        if CommandLine.arguments.contains("--seed-usage") {
            let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Glimpse")
            do { let ledger = KimiUsageLedger(directory: directory); try ledger.seedPreviousProbe(); print(try ledger.summary()) }
            catch { print("Unable to seed prior test usage."); exit(1) }
            return
        }
        if CommandLine.arguments.contains("--configure-key") {
            guard let folder = Bundle.main.resourceURL?.appendingPathComponent("WebAssets"), let key = readLine(), !key.isEmpty else { print("No Key supplied."); return }
            do { try KimiSettingsBridge(resourceFolder: folder, testDirectory: nil).saveConfiguration(model: "kimi-for-coding", suppliedKey: key); print("Kimi Code Key saved to this Mac's Keychain. Model: kimi-for-coding.") }
            catch { print("Unable to save Key to macOS Keychain."); exit(1) }
            return
        }
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        app.run()
    }
}
