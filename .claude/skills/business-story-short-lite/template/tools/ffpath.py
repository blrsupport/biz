# Where the studio's ffmpeg is. A full build is needed (loudness meter, limiter, tile): Remotion's own is cut down.
# Set STUDIO_FFMPEG to use one that lives somewhere else.
import os

HERE = os.path.dirname(os.path.abspath(__file__))
FFMPEG = os.environ.get("STUDIO_FFMPEG") or os.path.join(HERE, "bin", "ffmpeg.exe" if os.name == "nt" else "ffmpeg")


def unlocked(path, tries=8):
    """Waits until `path` can be written. On Windows a file that was written a moment ago may still be held by the
    virus scanner (or by a player that has it open), and opening it for writing then fails."""
    import time

    for k in range(tries):
        try:
            if os.path.exists(path):
                with open(path, "ab"):
                    pass
            return path
        except PermissionError:
            if k == tries - 1:
                raise SystemExit(f"FAILED: {path} is held by another program (a player? the virus scanner?): close it and run again")
            time.sleep(0.5 * (k + 1))
    return path
