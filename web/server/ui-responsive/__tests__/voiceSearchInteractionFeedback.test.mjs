import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [voiceSource, polishSource] = await Promise.all([
  readFile(new URL('components/discovery/HomepageSearchForm.tsx', root), 'utf8'),
  readFile(new URL('app/ui-polish.css', root), 'utf8'),
]);

test('voice search exposes immediate starting feedback before microphone permission resolves', () => {
  assert.ok(voiceSource.includes('const [voiceActivating, setVoiceActivating] = useState(false)'));
  assert.ok(voiceSource.includes('if (listening || voiceActivating) return'));
  const activatingIndex = voiceSource.indexOf('setVoiceActivating(true)');
  const permissionIndex = voiceSource.indexOf('navigator.mediaDevices?.getUserMedia');
  assert.ok(activatingIndex >= 0, 'voice activating state missing');
  assert.ok(permissionIndex > activatingIndex, 'starting feedback must happen before microphone permission wait');
  assert.ok(voiceSource.includes("setVoiceStatus(locale === 'ta-IN' ? 'Microphone தொடங்குகிறது…' : 'Starting microphone…')"));
});

test('voice button publishes idle, starting and listening states accessibly', () => {
  assert.ok(voiceSource.includes("const voiceState = listening ? 'listening' : voiceActivating ? 'starting' : 'idle'"));
  assert.ok(voiceSource.includes('data-voice-state={voiceState}'));
  assert.ok(voiceSource.includes('aria-pressed={listening}'));
  assert.ok(voiceSource.includes('aria-busy={voiceActivating || undefined}'));
  assert.ok(voiceSource.includes("setVoiceStatus(locale === 'ta-IN' ? 'கேட்கிறோம்…' : 'Listening…')"));
});

test('voice button gives distinct pointer press, keyboard focus and microphone-state feedback', () => {
  assert.ok(polishSource.includes('.voice-search-button:active'));
  assert.ok(polishSource.includes('.voice-search-button:focus-visible'));
  assert.ok(polishSource.includes(".voice-search-button[data-voice-state='starting']"));
  assert.ok(polishSource.includes(".voice-search-button[data-voice-state='listening']"));
  assert.ok(polishSource.includes('@keyframes voice-search-feedback-pulse'));
  assert.ok(polishSource.includes('animation:voice-search-feedback-pulse'));
});

test('mobile voice control meets touch size and has a visible tap state', () => {
  const mobileBlock = polishSource.slice(polishSource.indexOf('.voice-search-button-mobile {'));
  assert.ok(mobileBlock.includes('width:44px; height:44px'));
  assert.ok(mobileBlock.includes('.voice-search-button-mobile:active'));
  assert.ok(mobileBlock.includes(".voice-search-button-mobile[data-voice-state='starting']"));
  assert.ok(mobileBlock.includes(".voice-search-button-mobile[data-voice-state='listening']"));
  assert.ok(mobileBlock.includes('transform:scale(.88)'));
});
