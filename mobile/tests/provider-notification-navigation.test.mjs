import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
async function compile(path,deps = {}) { const code=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText; const exports={}; Function('exports','require',code)(exports,name=>deps[name]);return exports; }
test('reviewed Provider notification paths open native screens and discard web-only query/fragment data',async()=>{
  const {providerNotificationTarget:target}=await compile('../lib/provider-notification-target.ts');
  for(const [web,native] of [['verification','verification'],['public-readiness','readiness'],['handle','handle']]) {
    assert.equal(target(`/provider/${web}`),`/provider-${native}`);assert.equal(target(`/provider/${web}?request=123#details`),`/provider-${native}`);
  }
  for(const path of [null,'https://evil.test/provider/verification','//evil.test/provider/verification','/provider/verification/evil','/provider/verification-evil','/provider/../verification','/provider\\verification','/provider/payments'])assert.equal(target(path),null);
});
test('notification read operations use the expected user JWT and stop wrong-account mark-all before mutation',async()=>{
  for(const owner of ['owner','other']){
    const calls=[];const client=await compile('../lib/notifications.ts',{'./api':{apiFetch:async(...args)=>{calls.push(args);return {ok:true};}},'./supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'jwt'}}})}}}});
    if(owner==='other'){await assert.rejects(client.markAllNotificationsRead('owner'));assert.equal(calls.length,0);}
    else{await client.fetchNotifications('owner');await client.markNotificationRead('notification','owner');await client.markAllNotificationsRead('owner');assert.ok(calls.every(([,init])=>init.accessToken==='jwt'));assert.deepEqual(JSON.parse(calls[2][1].body),{mark_all_read:true});}
  }
});
test('notification focus/account guards protect load, mutation completion and delayed routing',async()=>{
  const screen=await readFile(new URL('../app/notifications.tsx',import.meta.url),'utf8');
  assert.match(screen,/useFocusEffect\(useCallback/);assert.match(screen,/loadedUser === userId/);assert.ok((screen.match(/currentUser.current !== userId \|\| epoch.current !== version/g)??[]).length>=6);assert.match(screen,/router.push\(providerTarget\)/);
});
