import json
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
AUDIO = ROOT / "audio"
SEGMENTS = ROOT / "segments"
OUTPUT = ROOT / "architecture-decision-hackathon-20min.mp4"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def audio_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as source:
        return source.getnframes() / source.getframerate()


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> None:
    scenes = json.loads((ROOT / "narration.json").read_text(encoding="utf-8"))
    total_duration = sum(scene["duration"] for scene in scenes)
    if total_duration != 1200:
        raise ValueError(f"Scene schedule must total 1200 seconds, got {total_duration}")

    SEGMENTS.mkdir(exist_ok=True)
    segment_paths: list[Path] = []
    for index, scene in enumerate(scenes, start=1):
        image = ASSETS / scene["scene"]
        audio = AUDIO / Path(scene["scene"]).with_suffix(".wav").name
        if not image.exists() or not audio.exists():
            raise FileNotFoundError(f"Missing scene media: {image} or {audio}")
        spoken_duration = audio_duration(audio)
        duration = float(scene["duration"])
        if spoken_duration > duration - 1:
            raise ValueError(f"Narration for {scene['scene']} is {spoken_duration:.1f}s, longer than its {duration}s slot")

        segment = SEGMENTS / f"{index:02d}.mp4"
        video_filter = (
            "scale=1920:1080:force_original_aspect_ratio=decrease,"
            "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1f33,"
            "format=yuv420p"
        )
        run([
            FFMPEG, "-y", "-loop", "1", "-framerate", "1", "-i", str(image),
            "-i", str(audio), "-vf", video_filter, "-af", "apad",
            "-t", str(duration), "-r", "24", "-c:v", "libx264",
            "-preset", "veryfast", "-tune", "stillimage", "-crf", "21",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(segment),
        ])
        segment_paths.append(segment)
        print(f"Rendered {segment.name}: {scene['title']} ({duration:.0f}s)")

    concat_file = SEGMENTS / "concat.txt"
    concat_file.write_text("".join(f"file '{path.as_posix()}'\n" for path in segment_paths), encoding="utf-8")
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c", "copy", "-movflags", "+faststart", str(OUTPUT)])
    print(f"Created {OUTPUT}")


if __name__ == "__main__":
    main()
