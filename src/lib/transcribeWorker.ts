/**
 * transcribeWorker.ts - bare minimum debug version
 */

// Post immediately on load so we know the worker file itself loads
self.postMessage({ type: 'progress', data: { status: 'worker_loaded' } });

self.onmessage = async (event: MessageEvent) => {
  const { type, arrayBuffer, model } = event.data;

  if (type !== 'transcribe') return;

  try {
    // Step 1: confirm message received
    self.postMessage({ type: 'progress', data: { status: 'decoding' } });

    // Step 2: check arrayBuffer
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Empty arrayBuffer received');
    }
    self.postMessage({ type: 'progress', data: { status: 'buffer_ok', progress: arrayBuffer.byteLength } });

    // Step 3: check OfflineAudioContext
    if (typeof OfflineAudioContext === 'undefined') {
      throw new Error('OfflineAudioContext not available in worker');
    }
    self.postMessage({ type: 'progress', data: { status: 'oac_ok' } });

    // Step 4: try decode
    const tmpCtx = new OfflineAudioContext(1, 44100, 44100);
    const decoded = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
    self.postMessage({ type: 'progress', data: { status: 'decoded', progress: decoded.duration } });

    // Step 5: load transformers (this triggers model download)
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache  = true;
    self.postMessage({ type: 'progress', data: { status: 'transformers_imported' } });

    const pipe = await pipeline(
      'automatic-speech-recognition',
      model ?? 'Xenova/whisper-small',
      {
        progress_callback: (data: unknown) => {
          self.postMessage({ type: 'progress', data });
        },
      }
    );
    self.postMessage({ type: 'progress', data: { status: 'ready' } });

    // Step 6: resample to 16kHz
    const native       = decoded.sampleRate;
    const frames       = decoded.length;
    const targetFrames = Math.ceil(frames * (16000 / native));
    const offCtx       = new OfflineAudioContext(1, targetFrames, 16000);
    const src          = offCtx.createBufferSource();
    src.buffer         = decoded;
    src.connect(offCtx.destination);
    src.start(0);
    const rendered = await offCtx.startRendering();
    const mono     = rendered.getChannelData(0);

    // Step 7: transcribe
    const output = await pipe(mono, {
      language: 'japanese', task: 'transcribe',
      return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5,
    }) as { chunks?: { timestamp: [number, number | null]; text: string }[] };

    const lines = (output.chunks ?? []).map((c, i) => ({
      index:    i + 1,
      start_ms: Math.round(c.timestamp[0] * 1000),
      end_ms:   Math.round((c.timestamp[1] ?? c.timestamp[0] + 2) * 1000),
      text:     c.text.trim(),
    })).filter(l => l.text);

    self.postMessage({ type: 'result', lines });
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err as Error)?.message ?? err) });
  }
};
