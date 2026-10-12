import * as Crypto from 'expo-crypto';
import { apiFetch } from './api';
import { supabase } from './supabase';
import { fetchPortfolio, type PortfolioItem } from './provider-portfolio';
export const MAX_PORTFOLIO_IMAGE_BYTES = 8 * 1024 * 1024;
const bucket = 'professional-portfolio-media';
export type PendingPortfolioUpload = { userId: string; professionalId: string; objectPath: string };
export class PortfolioUploadUnconfirmed extends Error { constructor(public pending: PendingPortfolioUpload) { super('Upload could not be confirmed. Check the gallery before adding this image again.'); this.name = 'PortfolioUploadUnconfirmed'; } }
export function inspectPortfolioImage(buffer: ArrayBuffer) {
 if (!buffer.byteLength || buffer.byteLength > MAX_PORTFOLIO_IMAGE_BYTES) throw new Error('Choose a JPEG, PNG or WebP image up to 8 MB.');
 const bytes = new Uint8Array(buffer);
 if (bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return { contentType: 'image/jpeg', extension: 'jpg' };
 if ([137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte)) return { contentType: 'image/png', extension: 'png' };
 if (bytes.length>=12 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return { contentType: 'image/webp', extension: 'webp' };
 throw new Error('Choose a JPEG, PNG or WebP image.');
}
async function token(userId: string) { const { data,error }=await supabase.auth.getSession(); if(error||!data.session||data.session.user.id!==userId)throw new Error('Sign in again to upload your portfolio.');return data.session.access_token; }
export async function checkPendingPortfolioUpload(userId: string, pending: PendingPortfolioUpload) {
 if(pending.userId!==userId||!pending.objectPath.startsWith(`${userId}/${pending.professionalId}/`))throw new Error('This upload belongs to another profile.');
 return (await fetchPortfolio(userId,pending.professionalId)).find(row=>row.object_path===pending.objectPath)||null;
}
export async function uploadPortfolioImage(userId: string, expectedId: string | undefined, buffer: ArrayBuffer, caption: string, altText: string): Promise<PortfolioItem> {
 const image=inspectPortfolioImage(buffer);
 if(typeof caption!=='string'||typeof altText!=='string'||caption.trim().length>600||altText.trim().length>240)throw new Error('Caption must be at most 600 characters; description at most 240.');
 const {profile}=await apiFetch<{profile:{id:string;provider_type:string}}>('/api/provider/profile',{accessToken:await token(userId)});
 await token(userId);
 if(!profile?.id||profile.provider_type!=='professional'||(expectedId&&profile.id!==expectedId)||!/^[a-zA-Z0-9-]+$/.test(profile.id)||!/^[a-zA-Z0-9-]+$/.test(userId))throw new Error('Your Professional identity could not be verified.');
 const objectPath=`${userId}/${profile.id}/${Crypto.randomUUID()}.${image.extension}`,pending={userId,professionalId:profile.id,objectPath};
 await token(userId);
 try {
  const {error}=await supabase.storage.from(bucket).upload(objectPath,buffer,{contentType:image.contentType,cacheControl:'3600',upsert:false});if(error)throw error;
  const {media}=await apiFetch<{media:PortfolioItem}>('/api/provider/profile/media',{method:'POST',accessToken:await token(userId),body:JSON.stringify({object_path:objectPath,original_filename:`portfolio-image.${image.extension}`,professional_role_id:null,caption:caption.trim()||null,alt_text:altText.trim()||null,active:false})});
  if(!media||media.professional_id!==profile.id||media.object_path!==objectPath||media.media_type!=='image'||media.active!==false)throw new Error('Unexpected upload response.');
  const saved=await checkPendingPortfolioUpload(userId,pending);if(!saved||saved.id!==media.id||saved.caption!==(caption.trim()||null)||saved.alt_text!==(altText.trim()||null)||saved.active!==false)throw new Error('Readback failed.');
  return saved;
 } catch { // Neither storage nor registration failures prove that no object/record was committed.
  throw new PortfolioUploadUnconfirmed(pending);
 }
}
