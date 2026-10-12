import type { PendingPortfolioUpload } from './portfolio-image-upload';
type LocalStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const safeId = /^[A-Za-z0-9-]{1,100}$/;
const keyFor = (userId: string) => { if (!safeId.test(userId)) throw new Error('Sign in again to restore pending uploads.'); return `takeitesee.portfolio-upload.v1.${userId}`; };
function validate(userId: string, value: unknown): PendingPortfolioUpload {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Pending upload record needs review.');
 const row=value as Record<string,unknown>;
 if(row.userId!==userId||typeof row.professionalId!=='string'||!safeId.test(row.professionalId)||typeof row.objectPath!=='string')throw new Error('Pending upload record needs review.');
 const parts=row.objectPath.split('/');
 if(parts.length!==3||parts[0]!==userId||parts[1]!==row.professionalId||!/^[A-Za-z0-9-]+\.(jpg|png|webp)$/.test(parts[2]))throw new Error('Pending upload record needs review.');
 return {userId,professionalId:row.professionalId,objectPath:row.objectPath};
}
export function readPendingPortfolioUpload(userId: string, expectedId?: string, store: LocalStore = globalThis.localStorage): PendingPortfolioUpload | null {
 let raw: string | null;
 try {raw=store.getItem(keyFor(userId));} catch {throw new Error('Pending upload status could not load. Upload is blocked; retry loading status.');}
 if(raw===null)return null;
 let value: Record<string,unknown>;
 try {if(raw.length>1024)throw new Error();value=JSON.parse(raw);if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!=='objectPath,professionalId,userId,version'||value.version!==1)throw new Error();}catch{throw new Error('Pending upload record needs review. Upload is blocked; do not add the same image again.');}
 const pending=validate(userId,value);
 if(expectedId&&pending.professionalId!==expectedId)throw new Error('Pending upload belongs to a different Professional identity. Review your account before uploading.');
 return pending;
}
export function recordPendingPortfolioUpload(pending: PendingPortfolioUpload, store: LocalStore = globalThis.localStorage) {
 const clean=validate(pending.userId,pending);
 if(readPendingPortfolioUpload(clean.userId,undefined,store))throw new Error('A pending upload already exists. Check it before adding another image.');
 const record=JSON.stringify({version:1,...clean});
 try {store.setItem(keyFor(clean.userId),record);if(store.getItem(keyFor(clean.userId))!==record)throw new Error();}catch{throw new Error('Pending upload status could not be saved. No image upload was started.');}
}
export function clearConfirmedPortfolioUpload(pending: PendingPortfolioUpload, store: LocalStore = globalThis.localStorage) {
 const clean=validate(pending.userId,pending),existing=readPendingPortfolioUpload(clean.userId,undefined,store);
 if(!existing)return;
 if(existing.objectPath!==clean.objectPath||existing.professionalId!==clean.professionalId)throw new Error('Another pending upload needs review.');
 try {store.removeItem(keyFor(clean.userId));if(store.getItem(keyFor(clean.userId))!==null)throw new Error();}catch{throw new Error('Image was found, but pending status could not clear. Retry the gallery check.');}
}
