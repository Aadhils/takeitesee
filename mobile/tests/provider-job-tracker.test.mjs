import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
async function compile(path,deps){const code=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const exports={};Function('exports','require',code)(exports,name=>deps[name]);return exports;}
async function fixture(options={}){
 const calls=[];let reads=0;
 const client=await compile('../lib/provider-job-tracker.ts',{'./supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:options.swap&&++reads>5?'other':options.user||'owner'},access_token:'jwt'}}})}}},'./api':{apiFetch:async(path,init)=>{calls.push([path,init]);if(path.endsWith('/profile'))return {profile:{id:'owned',provider_type:options.type||'professional'}};if(path.endsWith('/job-marketplace'))return {mode:options.mode||'professional',professional:{id:'owned'},applications:[{id:'app',professional_id:options.appOwner||'owned',job_posting_id:'job'}],jobs:[{id:options.jobId||'job',title:'Developer'}]};return {professional:{id:options.savedOwner||'owned'},saved_jobs:[{job_posting_id:'saved',available:!options.unavailable,job:{id:options.savedId||'saved',title:'Private stale title'}}]};}}});return {client,calls};
}
test('job tracker reads only Professional owned applications and saved jobs, with no mutations',async()=>{const f=await fixture();const data=await f.client.fetchJobTracker('owner','owned');assert.equal(data.applications.length,1);assert.equal(f.calls.length,3);assert.ok(f.calls.every(([,init])=>init.accessToken==='jwt'&&!init.method));for(const options of [{user:'other'},{type:'business'},{mode:'business'},{appOwner:'other'},{jobId:'unrelated'},{savedOwner:'other'},{savedId:'unrelated'},{swap:true}]){const bad=await fixture(options);await assert.rejects(bad.client.fetchJobTracker('owner','owned'));}await assert.rejects(f.client.fetchJobTracker('owner','other'));});
test('unavailable saved jobs never expose stale details; unknown statuses fail closed',async()=>{const f=await fixture({unavailable:true});const data=await f.client.fetchJobTracker('owner');assert.equal(data.saved[0].job,null);assert.equal(f.client.applicationStatusLabel('hired'),'Hired');assert.equal(f.client.applicationStatusLabel('surprise'),'Status unavailable');});
test('job marketplace and saved GET forward Request and enforce Professional owner filters',async()=>{
 for(const name of ['job-marketplace','saved-jobs']){
 const request=new Request('https://example.test'),requests=[],filters=[];
 const supabase={from:table=>{const q={select:()=>q,eq:(key,value)=>{filters.push([table,key,value]);return q;},order:()=>q,limit:()=>q,maybeSingle:async()=>({data:{id:'owned',verified:true},error:null}),then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};return q;}};
 const session={user_id:'owner',roles:['professional']};const route=await compile(`../../web/app/api/provider/${name}/route.ts`,{'next/server':{NextResponse:{json:body=>body}},'../../../../server/auth/session':{productionAuthProvider:{requireProvider:async r=>{assert.equal(r,request);return session;},getSession:async r=>{assert.equal(r,request);return session;}}},'../../../../lib/supabase/server':{createSupabaseServerClient:async r=>{requests.push(r);return supabase;}}});
 await route.GET(request);assert.deepEqual(requests,[request]);assert.ok(filters.some(([t,k,v])=>t==='professional_profiles'&&k==='user_id'&&v==='owner'));assert.ok(filters.some(([t,k,v])=>t===(name==='saved-jobs'?'professional_saved_jobs':'job_applications')&&k==='professional_id'&&v==='owned'));
 }
});
