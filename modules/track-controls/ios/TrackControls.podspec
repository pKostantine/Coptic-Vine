Pod::Spec.new do |s|
  s.name           = 'TrackControls'
  s.version        = '1.0.0'
  s.summary        = 'Next and previous track buttons on the lock screen for the Coptic Vine queue.'
  s.description    = 'Turns on the lock screen and Control Center next and previous track commands and sends each press to JavaScript.'
  s.author         = 'Coptic Vine'
  s.homepage       = 'https://github.com/pKostantine/Coptic-Vine'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
