import AVFoundation
import MediaPlayer
import ObjectiveC
import UIKit
import WebKit

enum KeyboardFix {
  static func install() {
    guard let contentView = NSClassFromString("WKContentView") else { return }
    let names = [
      "_elementDidFocus:userIsInteracting:blurPreviousNode:activityStateChanges:userObject:",
      "_elementDidFocus:userIsInteracting:blurPreviousNode:changingActivityState:userObject:",
      "_startAssistingNode:userIsInteracting:blurPreviousNode:changingActivityState:userObject:"
    ]
    for name in names {
      let selector = NSSelectorFromString(name)
      guard let method = class_getInstanceMethod(contentView, selector),
            let rawEncoding = method_getTypeEncoding(method),
            String(cString: rawEncoding).contains("BBB") else { continue }
      let original = method_getImplementation(method)
      let block: @convention(block) (AnyObject, AnyObject?, Bool, Bool, Bool, AnyObject?) -> Void = { me, info, _, blur, activity, userObject in
        typealias Function = @convention(c) (AnyObject, Selector, AnyObject?, Bool, Bool, Bool, AnyObject?) -> Void
        unsafeBitCast(original, to: Function.self)(me, selector, info, true, blur, activity, userObject)
        DispatchQueue.main.async { showSoftwareKeyboard() }
      }
      method_setImplementation(method, imp_implementationWithBlock(block))
    }
  }

  static func showSoftwareKeyboard() {
    guard let impl = NSClassFromString("UIKeyboardImpl") else { return }
    let classObject = impl as AnyObject
    let sharedSelector = NSSelectorFromString("sharedInstance")
    guard classObject.responds(to: sharedSelector),
          let keyboard = classObject.perform(sharedSelector)?.takeUnretainedValue() else { return }
    func setBool(_ name: String, _ value: Bool) {
      let selector = NSSelectorFromString(name)
      guard let method = class_getInstanceMethod(impl, selector) else { return }
      typealias SetBool = @convention(c) (AnyObject, Selector, Bool) -> Void
      unsafeBitCast(method_getImplementation(method), to: SetBool.self)(keyboard, selector, value)
    }
    func call(_ name: String) {
      let selector = NSSelectorFromString(name)
      guard let method = class_getInstanceMethod(impl, selector) else { return }
      typealias Call = @convention(c) (AnyObject, Selector) -> Void
      unsafeBitCast(method_getImplementation(method), to: Call.self)(keyboard, selector)
    }
    setBool("setInHardwareKeyboardMode:", false)
    setBool("setAutomaticMinimizationEnabled:", false)
    setBool("_setShouldSuppressSoftwareKeyboard:", false)
    call("showKeyboardWithoutSuppressionPolicy")
    call("showKeyboard")
  }
}

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
    let config = UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
    config.delegateClass = SceneDelegate.self
    return config
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    KeyboardFix.install()
    guard let windowScene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: windowScene)
    window.makeKeyAndVisible()
    window.rootViewController = WebController()
    self.window = window
  }
}

final class ShellMic: NSObject, WKScriptMessageHandler {
  static let shared = ShellMic()
  weak var web: WKWebView?
  private let engine = AVAudioEngine()
  private var player: AVAudioPlayerNode?
  private var running = false
  private var lastLog = Date.distantPast
  private var maxPeak = 0
  private var maxFloat: Float = 0
  private var probeChirp = false
  private var loggedRaw = false
  var showingLevel = false
  private var recorder: AVAudioRecorder?
  private let speaker = AVAudioPlayerNode()
  private var speakerAttached = false
  private var recording = false
  private var tapInstalled = false
  private var speakerVolumeRaised = false
  private var sessionReady = false
  private var routeObserver: NSObjectProtocol?
  private var clip: AVPlayer?
  private var clipObserver: Any?
  private var clipEnd: NSObjectProtocol?
  private var clipStatus: NSKeyValueObservation?
  private var didProbe = false
  private var pendingMeasure: ((Float, Bool) -> Void)?
  private var monitorInput = false
  private let playbackFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 24000, channels: 1, interleaved: false)!

  func measureBeforePage(_ done: @escaping (Float, Bool) -> Void) {
    maxFloat = 0
    probeChirp = false
    monitorInput = true
    pendingMeasure = done
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in self?.start() }
    DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
      guard let self, let pending = self.pendingMeasure else { return }
      self.pendingMeasure = nil
      pending(self.maxFloat, false)
    }
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    let command = String(describing: message.body)
    if command == "start" { start() }
    else if command == "stop" { stop() }
    else if command == "play-stop" { stopSpeaker() }
    else if command == "play-pause" { if speaker.engine != nil { speaker.pause() } }
    else if command == "play-resume" { if speaker.engine != nil, engine.isRunning { speaker.play() } }
    else if command.hasPrefix("play:") { playPcm(String(command.dropFirst(5))) }
    else if command.hasPrefix("listen:") { playClip(String(command.dropFirst(7))) }
    else if command == "listen-pause" { clip?.pause(); pushListen("paused") }
    else if command == "listen-resume" { clip?.play(); pushListen("playing") }
    else if command == "listen-stop" { stopClip() }
    else if command.hasPrefix("listen-seek:"), let seconds = Double(command.dropFirst(12)) {
      clip?.seek(to: CMTime(seconds: max(0, seconds), preferredTimescale: 600))
    }
    else if command.hasPrefix("listen-rate:"), let rate = Float(command.dropFirst(12)), rate > 0 {
      clip?.rate = rate
    }
  }

  func startProbe() {
    show("正在听手机麦克风…")
    start()
  }

  private func show(_ text: String) {
    print(text)
    showingLevel = true
    DispatchQueue.main.async {
      guard let controller = self.web?.window?.rootViewController as? WebController else { return }
      controller.status.isHidden = false
      controller.status.backgroundColor = .black
      controller.status.textColor = .white
      controller.status.text = text
    }
  }

  /// Leave the phone's side-button volume alone after the first audible start.
  /// Only lift near-silent levels so a first reply is not missed.
  private func ensureAudibleVolume() {
    if speakerVolumeRaised { return }
    speakerVolumeRaised = true
    let current = AVAudioSession.sharedInstance().outputVolume
    if current >= 0.25 { return }
    let window = web?.window ?? UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
    guard let window else { return }
    let volumeView = MPVolumeView(frame: CGRect(x: -200, y: -200, width: 20, height: 20))
    window.addSubview(volumeView)
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
      if let slider = volumeView.subviews.compactMap({ $0 as? UISlider }).first {
        slider.value = 0.45
      }
      volumeView.removeFromSuperview()
    }
  }

  private func probeRecorder() {
    let audio = AVAudioSession.sharedInstance()
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("mindy-mic-probe.caf")
    try? FileManager.default.removeItem(at: url)
    do {
      try audio.setCategory(.record, mode: .measurement)
      try audio.setPreferredSampleRate(48000)
      try audio.setActive(true)
      if let builtIn = audio.availableInputs?.first(where: { $0.portType == .builtInMic }) {
        try audio.setPreferredInput(builtIn)
      }
      let settings: [String: Any] = [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVSampleRateKey: 48000,
        AVNumberOfChannelsKey: 1,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false
      ]
      let recorder = try AVAudioRecorder(url: url, settings: settings)
      recorder.isMeteringEnabled = true
      recorder.prepareToRecord()
      let started = recorder.record()
      self.recorder = recorder
      let inputs = audio.currentRoute.inputs.map { "\($0.portType.rawValue):\($0.portName)" }.joined(separator: ",")
      let line = "started=\(started) channels=\(audio.inputNumberOfChannels) rate=\(audio.sampleRate) inputs=\(inputs)"
      show("录音中\n\(line)")
      DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
        recorder.updateMeters()
        let peak = recorder.peakPower(forChannel: 0)
        recorder.stop()
        let bytes = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? -1
        let samples = self?.peakOfRecording(url) ?? -1
        self?.show("手机麦克风 peak=\(samples)\n分贝=\(peak)\n文件=\(bytes)字节")
        try? audio.setActive(false, options: [.notifyOthersOnDeactivation])
      }
    } catch {
      print("ShellMic recorder failed \(error.localizedDescription)")
    }
  }

  private func writeChirp(_ url: URL) {
    try? FileManager.default.removeItem(at: url)
    let rate = 16000.0
    let count = 16000
    guard let format = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: rate, channels: 1, interleaved: true),
          let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count)),
          let channel = buffer.int16ChannelData?[0],
          let file = try? AVAudioFile(forWriting: url, settings: format.settings, commonFormat: .pcmFormatInt16, interleaved: true) else { return }
    buffer.frameLength = AVAudioFrameCount(count)
    for index in 0..<count {
      channel[index] = Int16(sin(2 * Double.pi * 880 * Double(index) / rate) * 28000)
    }
    try? file.write(from: buffer)
  }

  private func peakOfRecording(_ url: URL) -> Int {
    guard let file = try? AVAudioFile(forReading: url),
          let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)) else { return -1 }
    do { try file.read(into: buffer) } catch { return -1 }
    let frames = Int(buffer.frameLength)
    var peak = 0
    if let channel = buffer.int16ChannelData?[0] {
      for index in 0..<frames { peak = max(peak, Int(channel[index].magnitude)) }
    } else if let channel = buffer.floatChannelData?[0] {
      for index in 0..<frames { peak = max(peak, Int(abs(channel[index]) * 32767)) }
    }
    return peak
  }

  func probeToFile() {
    if didProbe { return }
    didProbe = true
    let audio = AVAudioSession.sharedInstance()
    let file = FileManager.default.temporaryDirectory.appendingPathComponent("mindy-mic-probe.caf")
    try? FileManager.default.removeItem(at: file)
    do {
      try audio.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
      try audio.setPreferredSampleRate(48000)
      try audio.setActive(true)
      if let builtIn = audio.availableInputs?.first(where: { $0.portType == .builtInMic }) {
        try audio.setPreferredInput(builtIn)
      }
      let settings: [String: Any] = [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVSampleRateKey: 48000,
        AVNumberOfChannelsKey: 1,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false
      ]
      let recorder = try AVAudioRecorder(url: file, settings: settings)
      recorder.isMeteringEnabled = true
      recorder.prepareToRecord()
      let started = recorder.record()
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
        recorder.updateMeters()
        let power = recorder.averagePower(forChannel: 0)
        recorder.stop()
        let peak = self?.peakOfRecording(file) ?? -1
        let muted: String
        if #available(iOS 17.0, *) {
          muted = String(AVAudioApplication.shared.isInputMuted)
        } else {
          muted = "unknown"
        }
        let inputs = audio.currentRoute.inputs.map { "\($0.portType.rawValue):\($0.portName)" }.joined(separator: ",")
        let outputs = audio.currentRoute.outputs.map { "\($0.portType.rawValue):\($0.portName)" }.joined(separator: ",")
        let available = (audio.availableInputs ?? []).map { port in
          let sources = (port.dataSources ?? []).map { $0.dataSourceName }.joined(separator: "|")
          return "\(port.portType.rawValue):\(port.portName):\(sources)"
        }.joined(separator: ";")
        let text = "started=\(started) peak=\(peak) power=\(power) muted=\(muted) channels=\(audio.inputNumberOfChannels) inputs=\(inputs) outputs=\(outputs) available=\(available) permission=\(audio.recordPermission.rawValue)"
        let doc = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("mic-probe.txt")
        try? text.write(to: doc, atomically: true, encoding: .utf8)
        try? audio.setActive(false, options: [.notifyOthersOnDeactivation])
        print("ShellMic probe \(text)")
      }
    } catch {
      let doc = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("mic-probe.txt")
      try? "failed \(error.localizedDescription)".write(to: doc, atomically: true, encoding: .utf8)
    }
  }

  func start() {
    let begin = { [weak self] in
      DispatchQueue.main.async { self?.startEngine() }
    }
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission { granted in
        if granted { begin() } else { print("ShellMic permission denied") }
      }
    } else {
      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        if granted { begin() } else { print("ShellMic permission denied") }
      }
    }
  }

  private func activateSession() throws {
    let audio = AVAudioSession.sharedInstance()
    // Reapplying the category while a reply is queued restarts the engine and
    // drops every buffer except the one just scheduled, so the sentence comes
    // out as clicks.
    if !(sessionReady && audio.category == .playAndRecord) {
      let canRecord = audio.recordPermission == .granted
      if canRecord {
        try audio.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
      } else {
        try audio.setCategory(.playback, mode: .default)
      }
      try audio.setPreferredSampleRate(48000)
      try audio.setActive(true)
      if canRecord, let builtIn = audio.availableInputs?.first(where: { $0.portType == .builtInMic }) {
        try audio.setPreferredInput(builtIn)
        if let source = builtIn.dataSources?.first(where: { $0.orientation == .bottom }) ?? builtIn.dataSources?.first {
          try? builtIn.setPreferredDataSource(source)
        }
      }
      sessionReady = true
    }
    pinPhoneSpeaker()
    observeSpeakerRoute()
  }

  private func observeSpeakerRoute() {
    if routeObserver != nil { return }
    routeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main
    ) { [weak self] _ in
      self?.pinPhoneSpeaker()
    }
  }

  // A cable to the Mac can become the media route. PlayAndRecord then follows
  // that route, so the sentence comes out of the computer. Pull it back to the
  // handset speaker without reapplying the category, which would drop the queue.
  private func pinPhoneSpeaker() {
    let audio = AVAudioSession.sharedInstance()
    let outputs = audio.currentRoute.outputs
    if outputs.contains(where: { $0.portType == .builtInSpeaker }) && outputs.allSatisfy({ $0.portType == .builtInSpeaker }) {
      return
    }
    try? audio.overrideOutputAudioPort(.speaker)
    let described = outputs.map { "\($0.portType.rawValue):\($0.portName)" }.joined(separator: ",")
    print("ShellAudio route \(described) -> phone speaker")
  }

  private func ensureSpeaker() {
    if speaker.engine != nil { return }
    speakerAttached = false
    engine.attach(speaker)
    engine.connect(speaker, to: engine.mainMixerNode, format: playbackFormat)
    engine.mainMixerNode.outputVolume = 1
    speakerAttached = true
  }

  private func playPcm(_ payload: String) {
    guard let data = Data(base64Encoded: payload, options: .ignoreUnknownCharacters), data.count >= 2 else { return }
    let count = data.count / 2
    do { try activateSession() } catch {
      print("ShellSpeaker session failed \(error.localizedDescription)")
      return
    }
    ensureSpeaker()
    guard let buffer = AVAudioPCMBuffer(pcmFormat: playbackFormat, frameCapacity: AVAudioFrameCount(count)),
          let channel = buffer.floatChannelData?[0] else { return }
    buffer.frameLength = AVAudioFrameCount(count)
    var samples = [Int16](repeating: 0, count: count)
    samples.withUnsafeMutableBytes { raw in
      data.copyBytes(to: raw, count: count * 2)
    }
    for index in 0..<count {
      channel[index] = Float(samples[index]) / 32768
    }
    if !engine.isRunning {
      engine.prepare()
      do { try engine.start() } catch {
        print("ShellSpeaker engine failed \(error.localizedDescription)")
        return
      }
    }
    guard speaker.engine != nil, engine.isRunning else { return }
    speaker.scheduleBuffer(buffer, completionHandler: nil)
    if !speaker.isPlaying { speaker.play() }
    ensureAudibleVolume()
  }

  private func stopSpeaker() {
    if speaker.engine != nil { speaker.stop() }
  }

  private func playClip(_ urlString: String) {
    stopClip(notify: false)
    guard let url = URL(string: urlString), let scheme = url.scheme?.lowercased(),
          scheme == "http" || scheme == "https" else {
      pushListen("error")
      return
    }
    if !recording {
      stopSpeaker()
      if engine.isRunning { engine.stop() }
    }
    do { try activateSession() } catch {
      print("ShellListen session failed \(error.localizedDescription)")
      pushListen("error")
      return
    }
    let item = AVPlayerItem(url: url)
    let player = AVPlayer(playerItem: item)
    player.allowsExternalPlayback = false
    player.volume = 1
    clip = player
    clipStatus = item.observe(\.status, options: [.new]) { [weak self] item, _ in
      if item.status == .readyToPlay { self?.pushListen("ready") }
      if item.status == .failed { self?.pushListen("error") }
    }
    clipEnd = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
    ) { [weak self] _ in
      self?.pushListen("ended")
    }
    clipObserver = player.addPeriodicTimeObserver(
      forInterval: CMTime(seconds: 0.25, preferredTimescale: 600), queue: .main
    ) { [weak self] _ in
      self?.pushListen("time")
    }
    player.play()
    ensureAudibleVolume()
    pushListen("playing")
  }

  private func stopClip(notify: Bool = true) {
    if let observer = clipObserver, let player = clip {
      player.removeTimeObserver(observer)
    }
    clipObserver = nil
    if let clipEnd { NotificationCenter.default.removeObserver(clipEnd) }
    clipEnd = nil
    clipStatus = nil
    clip?.pause()
    clip = nil
    if notify { pushListen("paused") }
  }

  private func pushListen(_ event: String) {
    let current = clip?.currentTime().seconds ?? 0
    let duration = clip?.currentItem?.duration.seconds ?? 0
    let safeCurrent = current.isFinite ? current : 0
    let safeDuration = duration.isFinite ? duration : 0
    let script = "window.__mindyListen&&window.__mindyListen({event:'\(event)',current:\(safeCurrent),duration:\(safeDuration)})"
    DispatchQueue.main.async { [weak self] in
      self?.web?.evaluateJavaScript(script, completionHandler: nil)
    }
  }

  private func startEngine() {
    if recording { return }
    if #available(iOS 17.0, *) {
      let muted = AVAudioApplication.shared.isInputMuted
      print("ShellMic inputMuted=\(muted)")
      if muted {
        do {
          try AVAudioApplication.shared.setInputMuted(false)
          print("ShellMic unmuted")
        } catch {
          print("ShellMic unmute failed \(error.localizedDescription)")
        }
      }
    }
    let audio = AVAudioSession.sharedInstance()
    do {
      try activateSession()
    } catch {
      print("ShellMic session failed \(error.localizedDescription)")
      return
    }
    let input = engine.inputNode
    let hardware = input.inputFormat(forBus: 0)
    print("ShellMic hardware rate=\(hardware.sampleRate) channels=\(hardware.channelCount) available=\(audio.isInputAvailable) permission=\(audio.recordPermission.rawValue)")
    ensureSpeaker()
    engine.prepare()
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else {
      print("ShellMic hardware format unavailable \(format)")
      return
    }
    if monitorInput {
      do {
        try engine.connect(input, to: engine.mainMixerNode, format: format)
      } catch {
        print("ShellMic monitor failed \(error.localizedDescription)")
      }
    }
    if probeChirp { attachChirp(sampleRate: format.sampleRate) }
    if tapInstalled { input.removeTap(onBus: 0) }
    input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak self] buffer, _ in
      self?.consume(buffer)
    }
    tapInstalled = true
    if !engine.isRunning {
      do {
        try engine.start()
      } catch {
        print("ShellMic engine failed \(error.localizedDescription)")
        return
      }
    }
    recording = true
    running = true
    if engine.inputNode.isVoiceProcessingEnabled {
      engine.inputNode.isVoiceProcessingInputMuted = false
    }
    player?.play()
    if pendingMeasure != nil {
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { [weak self] in
        guard let self, let pending = self.pendingMeasure else { return }
        self.pendingMeasure = nil
        let muted: Bool
        if #available(iOS 17.0, *) {
          muted = AVAudioApplication.shared.isInputMuted
        } else {
          muted = false
        }
        let peak = self.maxFloat
        self.stop()
        pending(peak, muted)
      }
    }
    let inputs = audio.currentRoute.inputs.map { "\($0.portType.rawValue):\($0.portName)" }.joined(separator: ",")
    let outputs = audio.currentRoute.outputs.map { "\($0.portType.rawValue):\($0.portName)" }.joined(separator: ",")
    print("ShellMic started rate=\(format.sampleRate) channels=\(format.channelCount) inputs=\(inputs) outputs=\(outputs)")
  }

  private func attachChirp(sampleRate: Double) {
    let rate = sampleRate > 0 ? sampleRate : 48000
    let frames = AVAudioFrameCount(rate * 0.8)
    guard let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 1),
          let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
          let data = buffer.floatChannelData else { return }
    buffer.frameLength = frames
    for index in 0..<Int(frames) {
      data[0][index] = sin(2 * Float.pi * 880 * Float(index) / Float(rate)) * 0.9
    }
    let chirp = AVAudioPlayerNode()
    engine.attach(chirp)
    engine.connect(chirp, to: engine.mainMixerNode, format: format)
    chirp.scheduleBuffer(buffer, at: nil, options: .interrupts, completionHandler: nil)
    player = chirp
  }

  func stop() {
    if !recording { return }
    if tapInstalled {
      engine.inputNode.removeTap(onBus: 0)
      tapInstalled = false
    }
    recording = false
    running = false
    if !speaker.isPlaying {
      player?.stop()
      engine.stop()
    }
  }

  private func consume(_ buffer: AVAudioPCMBuffer) {
    let frames = Int(buffer.frameLength)
    let rate = buffer.format.sampleRate
    guard frames > 0, rate > 0 else { return }
    let step = rate / 16000
    var samples = [Int16]()
    samples.reserveCapacity(Int(Double(frames) / step) + 1)
    var peak = 0
    var position = 0.0
    if let channel = buffer.floatChannelData?[0] {
      var loudest: Float = 0
      for index in 0..<frames { loudest = max(loudest, abs(channel[index])) }
      maxFloat = max(maxFloat, loudest)
      while Int(position) < frames {
        let unit = Double(channel[Int(position)])
        let sample = Int16(max(-1, min(1, unit)) * 32767)
        peak = max(peak, Int(sample.magnitude))
        samples.append(sample)
        position += step
      }
    } else if let channel = buffer.int16ChannelData?[0] {
      while Int(position) < frames {
        let sample = channel[Int(position)]
        peak = max(peak, Int(sample.magnitude))
        samples.append(sample)
        position += step
      }
    } else {
      return
    }
    guard !samples.isEmpty else { return }
    maxPeak = max(maxPeak, peak)
    let now = Date()
    if now.timeIntervalSince(lastLog) >= 0.4 {
      lastLog = now
      print("ShellMic peak=\(peak) max=\(maxPeak) frames=\(frames) rate=\(rate)")
    }
    let encoded = samples.withUnsafeBufferPointer { Data(buffer: $0).base64EncodedString() }
    DispatchQueue.main.async { [weak self] in
      self?.web?.evaluateJavaScript("window.__mindyPushMic && window.__mindyPushMic('\(encoded)')", completionHandler: nil)
    }
  }
}

class WebController: UIViewController, WKNavigationDelegate, WKUIDelegate {
  // Wi-Fi goes through the cluster's Nginx entry; the USB page stays as a fallback.
  static let pages = [
    URL(string: "https://wendydemacbook-air.local:8443/#/pages/auth/login")!,
    URL(string: "http://169.254.87.53:18174/#/pages/auth/login")!
  ]
  var pageIndex = 0
  var page: URL { Self.pages[pageIndex] }
  let web: WKWebView = {
    let configuration = WKWebViewConfiguration()
    configuration.allowsInlineMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    let content = WKUserContentController()
    content.add(ShellMic.shared, name: "mindyMic")
    configuration.userContentController = content
    return WKWebView(frame: .zero, configuration: configuration)
  }()
  let status = UILabel()
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    status.text = "正在打开这台 Mac 上的心享AI\n\(page.host ?? "")"
    status.textColor = .white
    status.textAlignment = .center
    status.numberOfLines = 0
    status.frame = view.bounds
    status.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    ShellMic.shared.web = web
    web.navigationDelegate = self
    web.uiDelegate = self
    web.isOpaque = false
    web.backgroundColor = .black
    web.scrollView.contentInsetAdjustmentBehavior = .automatic
    web.frame = view.bounds
    web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(web)
    view.addSubview(status)
    loadPage()
  }
  func loadPage() {
    status.isHidden = false
    status.text = "正在打开这台 Mac 上的心享AI\n\(page.host ?? "")"
    web.load(URLRequest(url: page, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8))
  }
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    view.window?.makeKey()
  }
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    status.isHidden = true
  }
  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    print("MindyPocket page failed \(page.absoluteString): \(error.localizedDescription)")
    if pageIndex + 1 < Self.pages.count {
      pageIndex += 1
      loadPage()
    } else {
      fail(error)
    }
  }
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(error) }
  func webView(_ webView: WKWebView,
               requestMediaCapturePermissionFor origin: WKSecurityOrigin,
               initiatedByFrame frame: WKFrameInfo,
               type: WKMediaCaptureType,
               decisionHandler: @escaping (WKPermissionDecision) -> Void) {
    decisionHandler(.grant)
  }
  func fail(_ error: Error) {
    status.isHidden = false
    status.text = "打不开这台 Mac 上的页面\n\(Self.pages.map(\.absoluteString).joined(separator: "\n"))\n\(error.localizedDescription)"
  }
}
