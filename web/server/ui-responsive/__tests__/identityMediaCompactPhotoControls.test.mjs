import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const source = await readFile(new URL('components/identity/RoleIdentityMediaHeader.tsx', root), 'utf8');

test('identity hero keeps avatar edit affordance without duplicate add/change photo CTA', () => {
  assert.ok(source.includes('className={styles.avatarEdit}'));
  assert.ok(source.includes("aria-label={hasAvatar ? t('identity.media.changeProfilePicture') : t('identity.media.addProfilePicture')}"));
  assert.ok(!source.includes('className={styles.secondaryButton}'));
  assert.ok(!source.includes("tamil ? 'Photo சேர்' : 'Add photo'"));
  assert.ok(!source.includes("tamil ? 'Photo மாற்று' : 'Change photo'"));
});

test('existing avatars retain an explicit remove control', () => {
  assert.ok(source.includes('{hasAvatar ? <div className={styles.avatarControls}>'));
  assert.ok(source.includes('className={styles.removeButton}'));
  assert.ok(source.includes("onClick={() => void remove('avatar')}"));
});

test('customer identity hero suppresses contact meta while provider meta remains available', () => {
  assert.ok(source.includes("const visibleMeta = context === 'customer' ? '' : meta;"));
  assert.ok(source.includes('{visibleMeta ? <p className={styles.meta}>{visibleMeta}</p> : null}'));
  assert.ok(!source.includes('{meta ? <p className={styles.meta}>{meta}</p> : null}'));
});
