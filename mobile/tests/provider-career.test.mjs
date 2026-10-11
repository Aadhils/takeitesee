import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
async function compile(path,deps) { const code=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const exports={};Function('exports','require',code)(exports,name=>deps[name]);return exports; }
async function fixture({owner='owner',scope='professional',rowOwner='owned',swap=false}={}) {
 const calls=[];let sessions=0;
 const client=await compile('../lib/provider-career.ts',{'./supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:swap&&++sessions>3?'other':owner},access_token:'jwt'}}})}}},'./api':{apiFetch:async(path,init)=>{calls.push([path,init]);return path.endsWith('/resume')?{career_profile:{professional_id:rowOwner},experiences:[{professional_id:rowOwner}],education:[],certifications:[],skills:[],roles:[]}:{profile:{id:'owned',provider_type:scope}};}}});return {client,calls};
}
test('career reads only the owned Professional résumé and rejects wrong accounts, identities, rows and account changes',async()=>{
 const f=await fixture();await f.client.fetchCareer('owner','owned');assert.equal(f.calls.length,2);assert.ok(f.calls.every(([,init])=>init.accessToken==='jwt'&&!init.method));
 for(const options of [{owner:'other'},{scope:'business'},{rowOwner:'other'},{swap:true}]){const wrong=await fixture(options);await assert.rejects(wrong.client.fetchCareer('owner','owned'));if(options.owner)assert.equal(wrong.calls.length,0);}
 await assert.rejects(f.client.fetchCareer('owner','other'));
});
test('résumé GET forwards the authenticated Request and scopes every section to the owned Professional',async()=>{
 const request=new Request('https://example.test'),requests=[],filters=[];
 const supabase={from:table=>{const q={select:()=>q,eq:(key,value)=>{filters.push([table,key,value]);return q;},order:()=>q,maybeSingle:async()=>({data:table==='professional_profiles'?{id:'owned',user_id:'owner'}:null,error:null}),then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};return q;}};
 const route=await compile('../../web/app/api/provider/resume/route.ts',{'next/server':{NextResponse:{json:body=>body}},'../../../../server/auth/session':{productionAuthProvider:{requireProvider:async r=>{assert.equal(r,request);return {user_id:'owner'};}}},'../../../../lib/supabase/server':{createSupabaseServerClient:async r=>{requests.push(r);return supabase;}}});
 const result=await route.GET(request);assert.deepEqual(requests,[request]);assert.deepEqual(result.skills,[]);assert.ok(filters.some(([t,k,v])=>t==='professional_profiles'&&k==='user_id'&&v==='owner'));
 for(const table of ['professional_career_profiles','professional_experiences','professional_education','professional_certifications','professional_skills','professional_roles'])assert.ok(filters.some(([t,k,v])=>t===table&&k==='professional_id'&&v==='owned'));
});
