import ExpoModulesCore
import MediaPlayer

/**
 * The lock screen's and Control Center's next and previous track buttons.
 * expo-audio offers only its 10-second skips there, while Coptic Vine plays
 * a queue: this turns the track buttons on in their place and passes each
 * press to JavaScript, which moves through the queue (PlaybackContext.tsx).
 *
 * expo-audio never touches these two commands, so the two can share the
 * remote command center; with its skips switched off, iOS shows these.
 */
public class TrackControlsModule: Module {
  private var nextTarget: Any?
  private var previousTarget: Any?

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
  }

  private func removeTargets() {
    let commands = MPRemoteCommandCenter.shared()
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
