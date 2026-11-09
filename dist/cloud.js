let firebaseConfig=null;
const el=id=>document.getElementById(id);
function status(message,kind='info'){for(const id of ['cloudStatus','cloudDialogStatus']){const target=el(id);if(target){target.textContent=message;target.dataset.state=kind;}}}
const dialog=document.createElement('dialog');dialog.id='cloudDialog';dialog.innerHTML='<h2>自分の記録を同期</h2><p id="cloudAccount"></p><p class="recordmeta">Firestoreの本番環境モードは最初すべて拒否します。初回は下のルールをコピーし、Firebaseコンソール → Firestore Database → ルールに貼り付けて公開してください。自分のUIDだけ許可します。</p><button id="copyRules">自分専用ルールをコピー</button><p id="cloudDialogStatus" class="syncfeedback" role="status" aria-live="polite">同期状況を確認しています…</p><button id="manualSync">同期する</button><button id="logoutCloud" class="secondary">ログアウト</button><button id="closeCloud" class="secondary">閉じる</button><p class="recordmeta">同期対象は競技の記録です。進行中の盤面・通常セーブは端末内に残ります。公開ランキングはありません。</p>';document.body.append(dialog);el('closeCloud').onclick=()=>dialog.close();
let auth,db,user,sdk,syncing=false,rerun=false;
const uploaded=new Set();
function rulesFor(uid){return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/records/{recordId} {
      function owner() {
        return request.auth != null
          && request.auth.uid == '${uid}'
          && request.auth.uid == userId;
      }
      allow read: if owner();
      allow create, update: if owner()
        && request.resource.data.keys().hasOnly(['id','mode','rules','seed','score','elapsed','maxExponent','moves','status','endedAt','startedAt'])
        && request.resource.data.id == recordId
        && request.resource.data.rules == 'overdrive-2'
        && request.resource.data.score is string
        && request.resource.data.score.matches('^[0-9]{1,1000}$')
        && request.resource.data.elapsed is number
        && request.resource.data.elapsed >= 0;
      allow delete: if owner();
    }
  }
}`;}
function errorMessage(e){const code=e?.code||'';if(code.includes('permission-denied'))return '同期にはFirestoreのルール設定が必要です。「同期設定」から専用ルールをコピーしてください';if(code.includes('unauthorized-domain'))return 'Firebase Authenticationの承認済みドメインに、このサイトのドメインを追加してください';if(code.includes('operation-not-allowed')||code.includes('configuration-not-found'))return 'Firebase AuthenticationでGoogleログインを有効にしてください';if(code.includes('popup-blocked'))return 'ポップアップがブロックされました。ブラウザで許可して再試行してください';if(code.includes('popup-closed')||code.includes('cancelled-popup'))return 'ログインをキャンセルしました。記録は端末内に保存されています';return '同期できませんでした。接続とFirestoreの作成・設定を確認してください（'+(code||'通信エラー')+'）';}
async function setup(){if(sdk)return sdk;if(!firebaseConfig)throw new Error('Firebase未設定');sdk=Promise.all([import('https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js')]).then(([app,a,f])=>{auth=a.getAuth(app.initializeApp(firebaseConfig));db=f.getFirestore();a.onAuthStateChanged(auth,u=>{user=u;uploaded.clear();el('cloudLogin').textContent=u?'同期設定':'Googleログイン';if(u){el('cloudAccount').textContent=(u.email||'ログイン済み')+'\nUID: '+u.uid;sync();}else status('記録はこの端末に保存 · ログインで端末間同期');});return {a,f};}).catch(e=>{sdk=null;throw e;});return sdk;}
async function sync(){
 if(!user){status('Googleログイン後に同期できます');return;}
 if(syncing){rerun=true;return;}
 syncing=true;const uid=user.uid;const button=el('manualSync');button.disabled=true;button.textContent='同期中…';button.setAttribute('aria-busy','true');
 status('同期中：クラウドの記録を確認しています…','busy');
 const slowTimer=setTimeout(()=>status('接続に時間がかかっています。ネット接続を確認してください。同期処理は継続中です。','busy'),12000);
 try{
  const {f}=await setup();const ref=f.collection(db,'users',uid,'records');
  // Require a server response so an offline cache cannot look like a successful sync.
  const remote=await f.getDocsFromServer(ref);if(user?.uid!==uid)return;
  const incoming=remote.docs.map(d=>d.data());window.recordStore.merge(incoming);
  for(const r of incoming)uploaded.add(r.id);
  let sent=0;const pending=window.recordStore.get().filter(r=>!uploaded.has(r.id));
  for(const r of pending){
   if(user?.uid!==uid)return;
   status(`同期中：記録を送信しています（${sent+1} / ${pending.length}件）…`,'busy');
   await f.setDoc(f.doc(db,'users',uid,'records',r.id),r);uploaded.add(r.id);sent++;
  }
  const total=incoming.length+sent;
  status(`同期完了：クラウド ${total}件 / 今回送信 ${sent}件 · ${new Date().toLocaleTimeString('ja-JP')}`+(total===0?'。まだ競技の記録がありません。スコアタかタイルTAを遊ぶと記録されます。':''),'success');
 }catch(e){status('同期失敗：'+errorMessage(e)+(e?.code?' ['+e.code+']':''),'error');}
 finally{clearTimeout(slowTimer);syncing=false;button.disabled=false;button.textContent='もう一度同期する';button.setAttribute('aria-busy','false');if(rerun){rerun=false;sync();}}
}
el('cloudLogin').onclick=async()=>{try{const {a}=await setup();if(user)dialog.showModal();else await a.signInWithPopup(auth,new a.GoogleAuthProvider());}catch(e){status(errorMessage(e));}};
el('manualSync').onclick=sync;el('logoutCloud').onclick=async()=>{const {a}=await setup();await a.signOut(auth);dialog.close();};el('copyRules').onclick=async()=>{if(!user)return;try{await navigator.clipboard.writeText(rulesFor(user.uid));status('自分専用のルールをコピーしました。Firestoreの「ルール」に貼り付けて公開してください');}catch{const pre=document.createElement('textarea');pre.value=rulesFor(user.uid);pre.style.cssText='width:100%;height:200px';dialog.append(pre);pre.select();}};
window.addEventListener('record-added',sync);window.addEventListener('records-imported',sync);window.addEventListener('online',()=>{if(user)sync();});
async function initializeCloud(readConfig=async()=>{
 const response=await fetch('./firebase-config.json',{cache:'no-store'});
 if(response.status===404)return null;
 if(!response.ok)throw new Error('設定ファイルの読み込みに失敗');
 return response.json();
},startSDK=setup){
 const button=el('cloudLogin');button.disabled=true;
 try{
  const config=await readConfig();
  if(config===null){status('ローカル保存モード · クラウド同期は未設定');button.textContent='クラウド同期 未設定';return;}
  const required=['apiKey','authDomain','projectId','appId'];
  if(!config||typeof config!=='object'||required.some(k=>typeof config[k]!=='string'||!config[k].trim()||config[k].startsWith('YOUR_')))throw new Error('apiKey・authDomain・projectId・appIdを設定してください');
  firebaseConfig=config;
  await startSDK();button.disabled=false;button.textContent=user?'同期設定':'Googleログイン';
 }catch(e){firebaseConfig=null;status('ローカル保存モード · Firebase設定エラー：'+e.message,'error');button.textContent='クラウド同期 設定エラー';}
}
el('cloudLogin').disabled=true;
initializeCloud();
