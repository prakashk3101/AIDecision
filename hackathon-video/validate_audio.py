import json
import wave
from pathlib import Path

root = Path(__file__).resolve().parent
scenes = json.loads((root / "narration.json").read_text(encoding="utf-8"))
total = 0.0
overflows = []
for scene in scenes:
    path = root / "audio" / Path(scene["scene"]).with_suffix(".wav").name
    with wave.open(str(path), "rb") as source:
        duration = source.getnframes() / source.getframerate()
    total += duration
    remaining = scene["duration"] - duration
    print(f"{path.name}: {duration:.1f}s / {scene['duration']}s ({remaining:.1f}s remaining)")
    if remaining < 1:
        overflows.append((path.name, remaining))
print(f"TOTAL: {total:.1f}s spoken / {sum(scene['duration'] for scene in scenes)}s scheduled")
if overflows:
    raise SystemExit(f"Tracks do not fit: {overflows}")
print("All tracks fit with at least 1 second remaining.")
