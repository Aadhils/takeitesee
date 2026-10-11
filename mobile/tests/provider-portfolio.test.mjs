import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
async function compile(path,deps) { const code=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const exports={};Function('exports','require',code)(exports,name=>deps[name]);return exports; }
async function fixture({owner='owner',scope='professional',mediaOwner='owned'}={}) {
  const calls=[];const client=await compile('../lib/provider-portfolio.ts',{'./env':{mobileEnv:{supabaseUrl:'https://project.supabase.co'}},'./supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'jwt'}}})}}},'./api':{apiFetch:async(path,init)=>{calls.push([path,init]);return path.endsWith('/media')?{media:[{id:'sample',professional_id:mediaOwner}]}:{profile:{id:'owned',provider_type:scope}};}}});return {client,calls};
}
test('portfolio images accept only configured HTTPS signed bucket links; arbitrary hosts, buckets, videos and missing tokens fail closed',async()=>{
  const {client}=await fixture();const valid='https://project.supabase.co/storage/v1/object/sign/professional-portfolio-media/owner/image.jpg?token=temporary';
  assert.equal(client.portfolioImageUrl({media_type:'image',signed_url:valid}),valid);
  for(const signed_url of ['http://project.supabase.co/storage/v1/object/sign/professional-portfolio-media/a?token=t','https://evil.test/storage/v1/object/sign/professional-portfolio-media/a?token=t','https://project.supabase.co/storage/v1/object/sign/other/a?token=t',valid.split('?')[0],null])assert.equal(client.portfolioImageUrl({media_type:'image',signed_url}),null);
  assert.equal(client.portfolioImageUrl({media_type:'video',signed_url:valid}),null);
});
test('native portfolio verifies owner, Professional identity and every media entity before exposing rows',async()=>{
  const f=await fixture();await f.client.fetchPortfolio('owner','owned');assert.equal(f.calls.length,2);assert.ok(f.calls.every(([,init])=>init.accessToken==='jwt'&&!init.method));
  for(const options of [{owner:'other'},{scope:'business'},{mediaOwner:'other'}]){const wrong=await fixture(options);await assert.rejects(wrong.client.fetchPortfolio('owner','owned'));if(options.owner)assert.equal(wrong.calls.length,0);}
  await assert.rejects(f.client.fetchPortfolio('owner','other'));
});
test('portfolio GET passes native Request through owned profile checks and signs only owned query results',async()=>{
  const request=new Request('https://example.test'),requests=[],filters=[],signed=[];
  const supabase={from:table=>{const q={select:()=>q,eq:(key,value)=>{filters.push([table,key,value]);return q;},order:()=>q,maybeSingle:async()=>({data:{id:'owned',user_id:'owner'},error:null}),then:resolve=>Promise.resolve({data:[{id:'sample',professional_id:'owned',object_path:'owner/sample.jpg'}],error:null}).then(resolve)};return q;}};
  const route=await compile('../../web/app/api/provider/profile/media/route.ts',{'next/server':{NextResponse:{json:body=>body}},'../../../../../server/auth/session':{productionAuthProvider:{requireProvider:async r=>{assert.equal(r,request);return {user_id:'owner',roles:['professional']};}}},'../../../../../lib/supabase/server':{createSupabaseServerClient:async r=>{requests.push(r);return supabase;}},'../../../../../lib/supabase/service':{createSupabaseServiceClient:()=>({storage:{from:bucket=>({createSignedUrl:async(path,ttl)=>{signed.push([bucket,path,ttl]);return {data:{signedUrl:'signed'},error:null};}})}})}});
  const result=await route.GET(request);assert.equal(result.media[0].signed_url,'signed');assert.deepEqual(requests,[request]);assert.ok(filters.some(([t,k,v])=>t==='professional_profiles'&&k==='user_id'&&v==='owner'));assert.ok(filters.some(([t,k,v])=>t==='professional_portfolio_media'&&k==='professional_id'&&v==='owned'));assert.deepEqual(signed,[['professional-portfolio-media','owner/sample.jpg',900]]);
});
