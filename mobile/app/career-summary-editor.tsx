import { Link, Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { MobileNav } from '../components/MobileNav';
import { fetchCareer, careerSummaryInput, saveCareerSummary, type CareerData } from '../lib/provider-career';
import { theme } from '../lib/theme';
import { useAuth } from '../providers/AuthProvider';
import { useWorkspace } from '../providers/WorkspaceProvider';
type State = { key: string; loading: boolean; busy: boolean; blocked: boolean; item: CareerData | null; headline: string; summary: string; error: string; notice: string };
const empty: State = { key: '', loading: true, busy: false, blocked: false, item: null, headline: '', summary: '', error: '', notice: '' };
export default function CareerSummaryEditor() {
 const auth=useAuth(),workspace=useWorkspace();
 const userId=auth.status==='signedIn'?auth.identity.userId:'',provider=workspace.profiles.find(profile=>profile.scope==='professional'),entityId=provider?.media?.entity_id;
 const key=`${userId}:${!!provider}:${entityId}`,currentKey=useRef(key);currentKey.current=key;
 const epoch=useRef(0),busy=useRef(false),blocked=useRef(false);
 const [reload,setReload]=useState(0),[state,setState]=useState<State>(empty);
 useFocusEffect(useCallback(()=>{ const version=++epoch.current;setState({...empty,key,busy:busy.current,blocked:blocked.current});
  if(userId&&provider )void fetchCareer(userId,entityId).then(item=>{if(currentKey.current===key&&epoch.current===version){blocked.current=false;setState({...empty,key,loading:false,busy:busy.current,item,headline:item.career_profile?.career_headline||'',summary:item.career_profile?.career_summary||''});}}).catch(cause=>{if(currentKey.current===key&&epoch.current===version)setState({...empty,key,loading:false,busy:busy.current,blocked:blocked.current,error:cause instanceof Error?cause.message:'Career profile could not load.'});});
  return()=>{epoch.current+=1;};
 },[key,userId,!!provider,reload]));
 const visible=state.key===key?state:empty,disabled=visible.loading||visible.busy||visible.blocked||!visible.item||!provider||auth.status!=='signedIn';
 const save=async()=>{if(disabled||busy.current||blocked.current||!visible.item)return;try{careerSummaryInput(visible.item,visible.headline,visible.summary);}catch(cause){setState(old=>({...old,error:cause instanceof Error?cause.message:'Check the text.'}));return;}
  const version=epoch.current;busy.current=true;setState(old=>({...old,busy:true,error:'',notice:''}));
  try{const item=await saveCareerSummary(userId,visible.item,visible.headline,visible.summary);if(currentKey.current===key&&epoch.current===version)setState(old=>({...old,busy:false,item,headline:item.career_profile?.career_headline||'',summary:item.career_profile?.career_summary||'',notice:'Career summary saved and reloaded.'}));}
  catch(cause){if(currentKey.current===key){blocked.current=true;setState(old=>({...old,busy:false,blocked:true,error:`${cause instanceof Error?cause.message:'Save could not be confirmed.'} Reload before saving again.`}));}}
  finally{busy.current=false;if(currentKey.current===key){const stale=epoch.current!==version;if(stale)blocked.current=true;setState(old=>({...old,busy:false,...(stale?{blocked:true,error:'A previous save finished after this screen refreshed. Reload your career profile.'}:{})}));}else setState(old=>({...old,busy:false}));}
 };
 if(auth.status==='signedOut')return <Redirect href="/login"/>;
 return <SafeAreaView style={styles.safe}><View style={styles.screen}><BrandLogo compact/><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Link href="/provider-career" style={styles.link}>‹ Résumé & career</Link><Text style={styles.title}>Edit career summary</Text><Text style={styles.help}>Edit your headline and summary. Career availability and public résumé preferences stay unchanged. Reload if you edit this profile elsewhere.</Text>
 {workspace.loading||visible.loading&&!!provider?<ActivityIndicator accessibilityLabel="Loading career profile"/>:null}{!provider&&!workspace.loading?<Text style={styles.error}>A Professional identity is required.</Text>:null}
 {visible.item?<View style={styles.card}><Text style={styles.heading}>Career headline</Text><TextInput accessibilityLabel="Career headline" multiline editable={!disabled} value={visible.headline} maxLength={160} style={styles.input} onChangeText={headline=>setState(old=>old.key===key?{...old,headline,notice:''}:old)}/><Text style={styles.help}>{visible.headline.length}/160 characters</Text><><Text style={styles.heading}>Career summary</Text><TextInput accessibilityLabel="Career summary" multiline editable={!disabled} value={visible.summary} maxLength={2400} style={styles.input} onChangeText={summary=>setState(old=>old.key===key?{...old,summary,notice:''}:old)}/><Text style={styles.help}>{visible.summary.length}/2400 characters.</Text></><Text style={styles.help}>Public résumé preference: {visible.item.career_profile?.public_resume_enabled?'Enabled':'Disabled'}. Editing your summary does not publish your résumé.</Text><Pressable accessibilityRole="button" accessibilityState={{disabled,busy:visible.busy}} disabled={disabled} onPress={()=>void save()} style={[styles.button,disabled&&styles.disabled]}><Text style={styles.buttonText}>{visible.busy?'Saving…':'Save summary'}</Text></Pressable></View>:null}
 {visible.notice?<Text accessibilityLiveRegion="polite" style={styles.success}>{visible.notice}</Text>:null}{visible.error?<Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text>:null}<Pressable accessibilityRole="button" disabled={visible.busy||busy.current||!provider} onPress={()=>setReload(value=>value+1)} style={styles.option}><Text style={styles.link}>Reload career profile</Text></Pressable><Text style={styles.help}>Experience, education, certification and skill editing remain on the website.</Text>
 </ScrollView><MobileNav/></View></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:theme.colors.white},screen:{flex:1,paddingHorizontal:18,paddingTop:12,paddingBottom:10,gap:10},content:{gap:14,paddingBottom:16},title:{fontSize:27,fontWeight:'900',color:theme.colors.ink},heading:{fontSize:18,fontWeight:'800',color:theme.colors.ink},help:{fontSize:13,lineHeight:20,color:theme.colors.inkMuted},link:{minHeight:44,paddingVertical:12,color:theme.colors.primaryStrong,fontWeight:'800'},card:{gap:12,padding:16,borderWidth:1,borderColor:theme.colors.border,borderRadius:16},input:{minHeight:95,padding:12,borderWidth:1,borderColor:theme.colors.border,borderRadius:12,fontSize:16,color:theme.colors.ink,textAlignVertical:'top'},option:{paddingHorizontal:12,minHeight:44,borderWidth:1,borderColor:theme.colors.border,borderRadius:12},button:{minHeight:48,backgroundColor:theme.colors.primary,borderRadius:12,justifyContent:'center',alignItems:'center',padding:12},buttonText:{color:theme.colors.white,fontWeight:'800'},disabled:{opacity:0.6},error:{color:theme.colors.danger},success:{color:theme.colors.success}});
