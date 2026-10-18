import Foundation
import ExpoModulesCore
import MediaPlayer

/**
 * The lock screen's and Control Center's next and previous track buttons.
 * expo-audio and expo-video offer only their 10-second skips there, while
 * Coptic Vine plays a queue: this turns the track buttons on in their place
 * and passes each press to JavaScript, which moves through the queue
 * (PlaybackContext.tsx).
 *
 * Neither player touches these two commands, so they can share the remote
 * command center; iOS shows them once the skips are off. expo-audio leaves its
 * skips off when asked to, but expo-video turns its skips back on every time
 * a lesson loads, plays or becomes ready (its NowPlayingManager), so while
 * anything plays this keeps the skips off, whoever turned them on.
 */
public class TrackControlsModule: Module {
  private var nextTarget: Any?
  private var previousTarget: Any?
  private var skipObservers: [NSKeyValueObservation] = []
  // While anything plays the track buttons stand in for the skips.
  private var holdingSkipsOff = false

  public func definition() -> ModuleDefinition {
    Name("TrackControls")

    Events("onNextTrack", "onPreviousTrack")

    // Which of the two buttons can be pressed: at the end of the queue there
    // is no next track, and with nothing playing there is neither.
    Function("setTrackControls") { (canGoNext: Bool, canGoPrevious: Bool) in
      DispatchQueue.main.async {
        self.apply(canGoNext: canGoNext, canGoPrevious: canGoPrevious)
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.removeTargets()
      }
    }
  }

  private func apply(canGoNext: Bool, canGoPrevious: Bool) {
    let commands = MPRemoteCommandCenter.shared()
    if nextTarget == nil {
      nextTarget = commands.nextTrackCommand.addTarget { [weak self] _ in
        self?.sendEvent("onNextTrack")
        return .success
      }
    }
    if previousTarget == nil {
      previousTarget = commands.previousTrackCommand.addTarget { [weak self] _ in
        self?.sendEvent("onPreviousTrack")
        return .success
      }
    }
    commands.nextTrackCommand.isEnabled = canGoNext
    commands.previousTrackCommand.isEnabled = canGoPrevious

    holdingSkipsOff = canGoPrevious
    guard holdingSkipsOff else {
      return
    }
    observeSkips(commands)
    turnSkipsOff()
    // expo-video turns its skips on from a block it queues on the main thread;
    // one queued just before this call runs after it, so look once more.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
      self?.turnSkipsOff()
    }
  }

  // Turns a skip off again as soon as anything turns it on.
  private func observeSkips(_ commands: MPRemoteCommandCenter) {
    guard skipObservers.isEmpty else {
      return
    }
    skipObservers = [commands.skipForwardCommand, commands.skipBackwardCommand].map { command in
      command.observe(\.isEnabled, options: [.new]) { [weak self] _, change in
        guard change.newValue == true else {
          return
        }
        DispatchQueue.main.async {
          self?.turnSkipsOff()
        }
      }
    }
  }

  private func turnSkipsOff() {
    guard holdingSkipsOff else {
      return
    }
    let commands = MPRemoteCommandCenter.shared()
    if commands.skipForwardCommand.isEnabled {
      commands.skipForwardCommand.isEnabled = false
    }
    if commands.skipBackwardCommand.isEnabled {
      commands.skipBackwardCommand.isEnabled = false
    }
  }

  private func removeTargets() {
    let commands = MPRemoteCommandCenter.shared()
    holdingSkipsOff = false
    skipObservers.forEach { $0.invalidate() }
    skipObservers = []
    if let target = nextTarget {
      commands.nextTrackCommand.removeTarget(target)
    }
    if let target = previousTarget {
      commands.previousTrackCommand.removeTarget(target)
    }
    commands.nextTrackCommand.isEnabled = false
    commands.previousTrackCommand.isEnabled = false
    nextTarget = nil
    previousTarget = nil
  }
}
