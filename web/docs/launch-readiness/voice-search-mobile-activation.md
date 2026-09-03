# Mobile voice search activation repair

Production acceptance after #213 showed that the homepage microphone control could remain non-interactive for an end user on mobile even though the same-origin microphone policy was correct.

This residual repair keeps the existing voice-search UI and transcript-to-results behavior, but moves browser speech-recognition capability detection to a post-mount effect, keeps the microphone control clickable so unsupported browsers can surface an explicit status instead of appearing dead, and requests microphone permission through `getUserMedia` before starting recognition when the browser exposes that API.

The flow continues to preserve Tamil (`ta-IN`) and English (`en-IN`) recognition, entered location, and direct navigation to Explore after a recognized transcript.

No Cashfree or online gateway activation is included. Cash on Service behavior is unchanged. Supabase Pro remains on hold.
