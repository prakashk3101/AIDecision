param(
  [string]$Voice = 'Microsoft Heera',
  [int]$Rate = -1
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$audioDir = Join-Path $root 'audio'
New-Item -ItemType Directory -Force -Path $audioDir | Out-Null
$scenes = Get-Content -Raw (Join-Path $root 'narration.json') | ConvertFrom-Json

foreach ($scene in $scenes) {
  $outputName = [System.IO.Path]::ChangeExtension($scene.scene, '.wav')
  $outputPath = Join-Path $audioDir $outputName
  $speech = [System.Speech.Synthesis.SpeechSynthesizer]::new()
  try {
    $speech.SelectVoice($Voice)
    $speech.Rate = $Rate
    $speech.Volume = 100
    $speech.SetOutputToWaveFile($outputPath)
    $speech.Speak($scene.narration)
  }
  finally {
    $speech.Dispose()
  }
  Write-Host "Generated $outputName"
}
