# Kitten TTS Web — Browser Text-to-Speech in Cute Voices

[![Releases](https://img.shields.io/badge/Downloads-Releases-blue?logo=github&logoColor=white)](https://github.com/LuanLima2907/kitten-tts-web/releases)

![Kitten TTS Hero](https://images.unsplash.com/photo-1518791841217-8f162f1e1131?ixlib=rb-4.0.3&q=80&w=1400&auto=format&fit=crop&crop=faces)

A browser-first implementation of KittenTTS. This repo packages a lightweight WebAudio + WebAssembly stack and a small inference engine that runs a kitten-voice TTS model in the browser. You will find code, demo pages, model assets, and helper tools to run text-to-speech locally in your browser without a server.

Download and execute the release asset from the Releases page:
https://github.com/LuanLima2907/kitten-tts-web/releases  
The release contains an archive with a bundled web app. Download the file and open index.html (or run the provided local server script) to start the demo.

Table of contents
- Badges
- What this repo contains
- Demo and screenshots
- Quick start (download + run)
- Full build from source
- Browser support and requirements
- Key features
- How the system works (architecture)
- Voice tuning and parameters
- Integrations and embedding
- API and example calls
- Performance and memory tips
- Testing and benchmarks
- Troubleshooting
- Contributing guide
- Release process and how to publish assets
- Roadmap
- Changelog
- Credits and license
- FAQ

Badges
- [![Releases](https://img.shields.io/badge/Releases-Releases-blue?logo=github)](https://github.com/LuanLima2907/kitten-tts-web/releases)
- [![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
- [![Web Audio](https://img.shields.io/badge/API-WebAudio-yellowgreen)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [![WebAssembly](https://img.shields.io/badge/Runtime-WebAssembly-blueviolet)](https://webassembly.org/)

What this repo contains
- A browser demo app (static HTML/CSS/JS) that runs KittenTTS in the browser.
- A small inference runtime in WASM that loads the model and runs synthesis.
- Pre-compiled frontend bundles and a minimal local server script in the release.
- Tools to convert checkpoints into browser-friendly binary shards.
- Example integrations for React, Vue, and plain JS.
- A documented API that lets you synthesize audio, stream audio, and modify voice parameters.

Demo and screenshots

Live demo (local)
- Download the release from the Releases page and run the bundled demo. The release includes a prebuilt index.html and assets that run locally without a remote server.

Screenshots
![Demo UI](https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?ixlib=rb-4.0.3&q=80&w=1200&auto=format&fit=crop)
(Sample UI for text input, voice controls, and waveform display.)

Audio waveform display
![Waveform](https://upload.wikimedia.org/wikipedia/commons/0/0b/WaveformExample.png)

Quick start (download and run)
1. Visit the Releases page and download the latest release:
   https://github.com/LuanLima2907/kitten-tts-web/releases
2. Unpack the release archive. You will see:
   - index.html
   - static/ (JS, CSS)
   - model/ (binary shards and metadata)
   - run-local.sh or run-local.bat
3. Run the local server script in the release:
   - On macOS / Linux: ./run-local.sh
   - On Windows: run-local.bat
4. Open your browser at http://localhost:8000 (or the port shown by the script).
5. Enter text, pick a preset voice, and press Generate.

If you prefer not to run a script, open index.html directly. Some browsers restrict WebAssembly or fetch of local files when you open a file:// URL. Use a simple HTTP server for full support.

Full build from source (dev)
Requirements
- Node.js 18+ and npm
- Emscripten or wasm-pack for building native parts (if you rebuild the WASM runtime)
- Python 3.8+ for model conversion scripts

Steps
1. Clone the repo:
   git clone https://github.com/LuanLima2907/kitten-tts-web.git
   cd kitten-tts-web
2. Install frontend deps:
   npm install
3. Build frontend:
   npm run build
4. Convert model checkpoint (optional):
   python tools/convert_checkpoint.py --input model_ckpt/ --output model/web/
   The tools folder contains scripts to shard weights and produce metadata.
5. Build or reuse the WASM runtime:
   - If you want the prebuilt runtime, skip to step 6.
   - To build from source, follow build instructions in wasm/README.md.
6. Start dev server:
   npm run dev
7. Open http://localhost:3000

You can run unit tests and lint rules:
- npm test
- npm run lint

Browser support and requirements
- Modern Chromium-based browsers (Chrome, Edge) work best.
- Firefox supports most features but may require different audio latency settings.
- Safari has WebAudio and WASM support, but may impose different memory limits.
- Mobile browsers work if they support WebAssembly and WebAudio. iOS Safari may require user interaction to start audio.

Minimum device specs for real-time playback
- Desktop CPU: 4 logical cores
- Memory: 4GB free for small models; 8GB+ for larger models
- Prefer hardware with AVX2 for desktop model conversion tasks (not required in browser)

Key features
- Client-side TTS: No server inference required for small and medium models.
- Low-latency streaming: Synthesize audio in chunks and stream to WebAudio.
- Multiple presets: Kitten whisper, playful, sleepy, standard cat timbre.
- Dynamic pitch and speed controls: Modify f0 and rate in real time.
- On-device privacy: Text and voice never leave the browser.
- Sharded models: Support for larger models via weight sharding and lazy load.
- WASM inference runtime: Small runtime optimized for WebAssembly.
- Simple JS API for integration and automation.

How the system works (architecture)
The system divides into three main parts: frontend UI, WASM runtime, and model assets.

Frontend UI
- Handles text input, UI controls, presets, and streaming playback.
- Connects to the WASM runtime via calls and shared memory.
- Manages audio graph with WebAudio: ScriptProcessorNode or AudioWorkletNode.
- Exposes API for other scripts to call synthesize, stop, pause.

WASM runtime
- Loads model shards (Float32 or quantized int8).
- Runs lightweight neural nets for mel spectrogram prediction.
- Runs a vocoder to convert mel to waveform.
- Supports streaming inference: produce mel frames and push to WebAudio.

Model assets
- Stored in model/ as JSON metadata and binary shards.
- Metadata lists layer shapes, tokenizer, phonemes, and sample rate.
- Shards load on demand to reduce initial download.

Data flow
1. Frontend converts text to a token sequence (grapheme-to-phoneme step).
2. Tokens feed into the generator in WASM.
3. WASM outputs mel-spectrogram frames asynchronously.
4. The vocoder converts frames to PCM samples.
5. Frontend reads PCM samples and writes into an AudioWorklet for playback.

Voice tuning and parameters
Preset voices
- kitten-standard: Balanced tone and clarity.
- kitten-whisper: Lower volume, breathy texture.
- kitten-playful: Higher pitch and more vibrato.
- kitten-slow: Lower rate for long phrases.

Adjustable parameters
- pitch_shift (float): [-12, +12] semitones
- speed (float): [0.5, 2.0] relative rate
- energy (float): [0.0, 2.0] amplitude control
- breathiness (float): [0.0, 1.0] adds noise to higher frequencies
- prosody_map (object): Per-phrase emphasis map

Examples
- Lower pitch by an octave:
  api.synthesize({ text: "Hello", pitch_shift: -12 })
- Speed up 1.5x:
  api.synthesize({ text: "Fast words", speed: 1.5 })

Presets and mixing
- You can interpolate between presets by weight. Each preset maps to a parameter vector. Interpolate vectors and apply to the runtime for a hybrid voice.

Integrations and embedding
Simple embed (plain JS)
- Include static/js/kitten-tts.min.js in your page.
- Call:
  const tts = new KittenTTS({ modelPath: '/model' });
  await tts.load();
  tts.speak("Hello world");

React
- Use the KittenTTS hook:
  import useKittenTTS from 'kitten-tts-web/react';
  const { speak, loaded } = useKittenTTS({ modelPath: '/model' });

Vue
- Use the plugin:
  app.use(KittenTTS, { modelPath: '/model' });

API and example calls
Main classes
- KittenTTS: Top-level object that manages model load and synth.
- KittenPlayer: Plays PCM buffers via AudioWorklet.
- KittenConverter: Tokenizer and g2p converter.

KittenTTS API (core)
- constructor(opts)
  - modelPath: string
  - sampleRate: number (default 22050)
- load(): Promise<void>
- synthesize(opts): Promise<SynthesisHandle>
  - text: string
  - preset: string
  - pitch_shift: number
  - speed: number
  - onAudioChunk(chunk: Float32Array): void
- stop(): void

Example: Streaming synthesis
const tts = new KittenTTS({ modelPath: '/model' });
await tts.load();
const handle = await tts.synthesize({
  text: "This is a streaming test",
  preset: "kitten-playful",
  onAudioChunk(chunk) {
    // push chunk to AudioWorklet buffer
    player.enqueue(chunk);
  }
});

Synthesis handle
- handle.cancel(): Stop generation.
- handle.onDone(): Promise<void> resolves when done.

Performance and memory tips
- Use smaller models for mobile. The release includes tiny, small, and medium variants.
- Prefer quantized shards (int8) to save memory.
- Use CHUNKED streaming to reduce peak memory use.
- Reuse the WASM instance for multiple requests to avoid reinitialization.
- Pre-warm the model by running a short dummy inference on load.
- Use OfflineAudioContext in browsers when you need non-real-time rendering.

Benchmarks
Sample client: Desktop i7, Chrome
- Tiny model: 2x real-time synthesis (faster than playback)
- Small model: 0.6–1.2x real-time depending on CPU
- Medium model: 0.25–0.7x real-time

Real numbers vary by CPU, browser, and available threads.

Testing and benchmarks
Automated tests
- Unit tests for tokenizer and converter (npm test).
- End-to-end tests run headless Chrome and verify audio output length.

Manual benchmarks
- Use tools/bench.sh to run repeat tests.
- Measure time to first audio frame and time to full synthesis.

Troubleshooting
- If audio does not play: ensure the page had a user gesture before starting audio in some browsers.
- If WASM fails to load: serve over HTTP and check console for CORS or fetch errors.
- High latency: switch from ScriptProcessorNode to AudioWorklet for lower latency.
- OutOfMemory: use smaller model variant or enable swap / increase browser allocation.
- Model mismatch: ensure model/metadata.json matches the release runtime version.

Contributing guide
- Fork the repo and create branches per feature or bugfix.
- Run tests locally: npm test
- Keep changes small and focused.
- Document API changes and update docs in /docs.
- For model changes, include conversion scripts and metadata updates.
- Open PRs against main. Use clear commit messages.

Code style
- JavaScript: follow ESLint rules provided.
- WASM: include build flags and tested toolchain versions.

Release process and how to publish assets
- Tag release with semantic version: vX.Y.Z
- Build frontend: npm run build
- Build WASM runtime and package model shards.
- Create a ZIP archive with:
  - index.html
  - static/
  - model/
  - run-local.sh and run-local.bat
- Upload the ZIP as an asset to the GitHub Release.
- Update the Releases page and add changelog.

Download link and usage
- The Releases page holds packaged builds. Download the bundled archive and run the included index.html or run-local script.
- Releases: https://github.com/LuanLima2907/kitten-tts-web/releases  
  If the releases link does not work, check the Releases section on the repo page.

Roadmap
Planned items
- Expand preset library with user-contributed voices.
- Add WebTransport/HTTP/2 server-side fallback for heavy models.
- Add a WASM runtime with SIMD and multi-thread support.
- Add model pruning tools to shrink large models for mobile.
- Improve tokenizer for multilingual support.
- Add offline packaging for progressive web app (PWA) installs.

Changelog (high-level)
v1.2.0
- Added playful preset.
- Streaming API improvements.
- Reduced memory use for small model.

v1.1.0
- WASM runtime optimizations.
- Added WebAudio AudioWorklet player.

v1.0.0
- Initial release with tiny and small models.
- Basic UI and API.

Credits and license
- Model design based on KittenTTS research ideas.
- WASM runtime adapted from open inference projects under permissive licenses.
- Images used in demo are from Unsplash and Wikimedia Commons as placeholders.
- License: MIT (see LICENSE file)

Acknowledgements
- WebAudio API team for the platform.
- Open-source tooling for WASM and model conversion.
- Community contributors for presets and testing.

Security
- Avoid exposing the model or runtime internals over untrusted origins.
- Sanitize user input in embeds when integrating with third-party content.
- Use secure hosting for larger models that you host on the network.

FAQ
Q: Can I run this offline?
A: Yes. Download the release archive. The demo runs offline in the browser once assets load. For full offline use, host the archive locally and ensure the app loads from file:// or a local HTTP server.

Q: Does the app send text to remote servers?
A: No. The default release runs inference in the browser. If you add server-side features, those may send data.

Q: How do I convert my own model?
A: Use tools/convert_checkpoint.py to shard weights into the web format. The metadata file must list shapes and tokenizer info. See tools/README.md for details.

Q: What sample rate does the system use?
A: Default 22050 Hz. Some vocoder variants support 24000 Hz. Check model metadata for exact sample rate.

Q: Can I use this in production?
A: The code aims for production readiness. Test performance and memory in your target environment before deploying.

Examples and scripts
- Example server: server/simple-serve.js serves built files with proper MIME types.
- run-local.sh example:
  #!/bin/sh
  python3 -m http.server 8000
  echo "Serving at http://localhost:8000"

- Example embed snippet:
  <script src="/static/kitten-tts.min.js"></script>
  <script>
    (async () => {
      const tts = new KittenTTS({ modelPath: '/model' });
      await tts.load();
      tts.speak('Hi, I am a kitten voice.');
    })();
  </script>

Model packaging tips
- Split weights into small shards to allow parallel fetch.
- Use content hashing for cache busting.
- Host model shards on a CDN for global performance.

Localization and i18n
- Tokenizer supports multiple languages via language packs.
- Provide language model assets in model/lang/<code>/.
- UI supports translation via i18n JSON files.

Accessibility
- Provide keyboard shortcuts for common actions.
- Add ARIA labels and alt text for images.
- Expose synthesized audio as downloadable files for screen readers.

Testing your setup
- After loading, open DevTools > Network to confirm model shards load.
- Check Console for errors about CORS or missing files.
- Use the demo to synthesize a short phrase and inspect the audio buffer length.

Appendix: internal file layout (release)
- index.html
- static/
  - js/kitten-tts.min.js
  - js/player.js
  - css/style.css
- model/
  - metadata.json
  - vocab.json
  - shard_000.bin
  - shard_001.bin
- run-local.sh
- run-local.bat
- LICENSE
- README.md (this file)

Further reading and references
- WebAudio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- WebAssembly: https://webassembly.org/
- KittenTTS research: (fictitious internal reference included in repo docs)

Contact and support
- Open an issue on the repo for bugs and feature requests.
- Submit pull requests for fixes and improvements.

Releases link (again) and download
[Download releases and run the bundled app](https://github.com/LuanLima2907/kitten-tts-web/releases) — download the release archive, extract it, and run the provided index.html or run-local script to start the demo.