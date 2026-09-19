import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/discovery/HomepageSearchForm.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/LanguageProvider.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'home.voice.unavailableStatus','home.voice.startingStatus','home.voice.resultPrefix','home.voice.errorStatus',
  'home.voice.listeningStatus','home.voice.permissionStatus','home.voice.unavailableTitle','home.voice.startingTitle',
  'home.voice.listeningTitle','home.voice.idleTitle','home.voice.listeningLabel','home.voice.idleLabel',
];

test('Homepage voice search uses shared EN/TA localization with one functional locale branch', () => {
  assert.equal(keys.length, 12);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal((source.match(/locale\s*===\s*['\"]ta-IN/g) || []).length, 1);
  assert.ok(source.includes("recognition.lang = locale === 'ta-IN' ? 'ta-IN' : 'en-IN';"));
});

test('Homepage voice search preserves browser capability and permission behavior', () => {
  assert.ok(source.includes('voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition'));
  assert.ok(source.includes('navigator.mediaDevices?.getUserMedia'));
  assert.ok(source.includes("navigator.mediaDevices.getUserMedia({ audio: true })"));
  assert.ok(source.includes('stream.getTracks().forEach((track) => track.stop())'));
  assert.ok(source.includes('recognition.interimResults = false'));
  assert.ok(source.includes('recognition.continuous = false'));
  assert.ok(source.includes('recognition.start()'));
});

test('Homepage voice search preserves transcript and manual explore navigation semantics', () => {
  assert.ok(source.includes('setQuery(transcript)'));
  assert.ok(source.includes('navigateToExplore(transcript, location)'));
  assert.ok(source.includes('navigateToExplore(query, location)'));
  assert.ok(source.includes("params.set('q', searchQuery.trim())"));
  assert.ok(source.includes("params.set('location', location.trim())"));
  assert.ok(source.includes("window.location.assign(params.toString() ? `/explore?${params.toString()}` : '/explore')"));
});

test('Homepage voice search preserves accessible button and status semantics', () => {
  assert.ok(source.includes('aria-label={voiceLabel}'));
  assert.ok(source.includes('aria-pressed={listening}'));
  assert.ok(source.includes('aria-busy={voiceActivating || undefined}'));
  assert.ok(source.includes('role="status"'));
  assert.ok(source.includes('aria-live="polite"'));
  assert.ok(source.includes("data-voice-state={voiceState}"));
});

test('Homepage voice-search localization does not introduce finance behavior', () => {
  for (const term of ["fetch('/api/pay", 'createPayment', 'CashfreeClient', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
