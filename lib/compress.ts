// Browser-side video compression for drop uploads. Runs on WebCodecs through
// mediabunny, so the original never leaves the machine and no server time is used.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality } from "mediabunny";

const MAX_SIDE = 480; // "480p": the short side, so portrait clips become 480 wide
const MAX_FPS = 60;


const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Re-encode a video as H.264/AAC MP4 at no more than 480p and 60 fps. Smaller
 * or slower videos keep their size and frame rate. A video that was already
 * within both limits is left alone if re-encoding wouldn't make it smaller.
 */
export async function compressVideo(file: File, onProgress: (pct: number) => void): Promise<File> {
  if (typeof VideoEncoder === "undefined") throw new Error("This browser can't compress video");

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("No video track found");

    const w = track.displayWidth;
    const h = track.displayHeight;
    const scale = Math.min(1, MAX_SIDE / Math.min(w, h));
    const { averagePacketRate: fps } = await track.computePacketStats(120);
    const smooth = fps > 40;
    const withinLimits = scale === 1 && fps <= MAX_FPS + 0.5;

    const target = new BufferTarget();
    // fastStart puts the index at the front so Discord and browsers can stream it.
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        width: even(w * scale),
        height: even(h * scale),
        fit: "fill",
        frameRate: fps > MAX_FPS + 0.5 ? MAX_FPS : undefined,
        codec: "avc",
        quality: new Quality({ bitrate: smooth ? 1_800_000 : 1_200_000 }),
        forceTranscode: true,
      },
      audio: { quality: new Quality({ bitrate: 128_000 }) },
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error("This browser can't convert that video");

    conversion.onProgress = (p) => onProgress(p * 100);
    await conversion.execute();

    const buffer = target.buffer;
    if (!buffer) throw new Error("Compression produced no output");
    if (withinLimits && buffer.byteLength >= file.size) return file;
    return new File([buffer], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}
