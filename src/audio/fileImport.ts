// audio/fileImport.ts
// Validiert und bereitet vom User per Datei-Dialog ausgewählte Audiodateien
// für den Sampler-Upload vor. Unterstützt .wav/.mp3/.ogg/.webm bis 10 MB
// (geprüft an der Original-Datei, VOR jeder Kompression). WAV-Dateien
// werden dabei immer zu komprimiertem Opus/WebM transkodiert -- ein
// unkomprimiertes WAV ist typischerweise 5-10x größer als ein gleichwertig
// klingendes Opus-Encode, was sowohl für den 10-MB-Limit als auch für
// Supabase-Storage/Bandbreite relevant ist. MP3/OGG/WebM sind bereits
// komprimiert und werden unverändert hochgeladen.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export type AudioFileErrorReason = "fileTooLarge" | "unsupportedFormat";

export class AudioFileImportError extends Error {
  reason: AudioFileErrorReason;
  constructor(reason: AudioFileErrorReason) {
    super(reason);
    this.reason = reason;
  }
}

type ExtInfo = { extension: string; contentType: string };

// Erkennung anhand der Dateiendung statt file.type -- der vom Browser
// gelieferte MIME-Type ist je nach OS/Browser oft leer oder uneinheitlich
// (z.B. "audio/x-wav" statt "audio/wav"), die Endung ist verlässlicher.
const EXT_INFO: Record<string, ExtInfo> = {
  wav: { extension: "wav", contentType: "audio/wav" },
  mp3: { extension: "mp3", contentType: "audio/mpeg" },
  ogg: { extension: "ogg", contentType: "audio/ogg" },
  webm: { extension: "webm", contentType: "audio/webm" },
};

function extensionOf(filename: string): string | null {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : null;
}

/** Wirft AudioFileImportError bei zu großer Datei oder unbekanntem Format. */
export function validateAudioFile(file: File): ExtInfo {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AudioFileImportError("fileTooLarge");
  }
  const ext = extensionOf(file.name);
  const info = ext ? EXT_INFO[ext] : undefined;
  if (!info) {
    throw new AudioFileImportError("unsupportedFormat");
  }
  return info;
}

/**
 * Dekodiert die WAV-Datei zu PCM und spielt sie einmal in Echtzeit über
 * einen MediaStreamAudioDestinationNode ab, während ein MediaRecorder den
 * Stream als Opus/WebM mitschneidet. Läuft in Echtzeit (Dauer == Sample-
 * Länge) -- für die kurzen Ein-Schuss-Samples/Loops des Samplers unkritisch,
 * vermeidet aber jede zusätzliche Dependency für Audio-Encoding.
 */
async function compressWavToOpus(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(dest.stream, {
      mimeType,
      audioBitsPerSecond: 96_000,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recordingDone = new Promise<Blob>((resolve, reject) => {
      recorder.onerror = (e) => reject(e);
      recorder.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" }));
    });

    recorder.start();
    source.start();
    source.onended = () => recorder.stop();

    return await recordingDone;
  } finally {
    // AudioContext schließen, nicht nur die Nodes -- sonst bleibt pro
    // Upload ein Audio-Kontext offen und der Browser wirft irgendwann
    // "too many AudioContexts".
    await audioCtx.close();
  }
}

/**
 * Validiert eine vom User ausgewählte Datei und bereitet sie für
 * uploadSamplerRecording() vor. WAV wird zu Opus/WebM komprimiert,
 * alle anderen unterstützten Formate unverändert durchgereicht.
 */
export async function prepareAudioFileForUpload(
  file: File,
): Promise<{ blob: Blob; extension: string; contentType: string }> {
  const info = validateAudioFile(file);

  if (info.extension === "wav") {
    const compressed = await compressWavToOpus(file);
    return { blob: compressed, extension: "webm", contentType: "audio/webm" };
  }

  return {
    blob: file,
    extension: info.extension,
    contentType: info.contentType,
  };
}
