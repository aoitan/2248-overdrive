
'use strict';
const $=id=>document.getElementById(id),ROWS=7,COLS=5,N=35,KEY='overdrive2248-v1';
let board=[],specials=Array(N).fill(null),score=0n,best=0n,energy=0,fever=0,path=[],previous=null,sound=false,audioCtx,dragging=false,moved=false,startCell=-1,confirmTap=false,busy=false,moveCheckpoint=null,particles=[],toastTimer;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function exponent(v){return v.toString(2).length-1;}
function maxTile(values=board){return values.reduce((a,b)=>a>b?a:b,2n);}
function rand(){const cap=Math.min(6,Math.max(3,exponent(maxTile())-2));return 2n**BigInt(1+Math.floor(dealRandom()*cap));}
function rollSpecial(){const r=dealRandom();return r<.04?'bomb':r<.07?'rainbow':null;}
function fresh(){if(run.mode==='rogue'){const tiles=Array.from({length:N},rogueDraw);board=tiles.map(t=>t.value);specials=tiles.map(t=>t.type);score=0n;energy=0;fever=0;previous=null;path=[];ensureMoves();render();save();return;}specials=Array.from({length:N},rollSpecial);board=Array.from({length:N},()=>2n**BigInt(1+Math.floor(dealRandom()*3)));score=0n;energy=0;fever=0;previous=null;path=[];ensureMoves();render();save();}
function save(){persistGame();}
function load(){restoreGame();}
function adjacent(a,b){return Math.abs(a%COLS-b%COLS)+Math.abs(Math.floor(a/COLS)-Math.floor(b/COLS))===1;}
function neighbors(i){return Array.from({length:N},(_,j)=>j).filter(j=>adjacent(i,j));}
// A route has one fixed ratio. Rainbows leave ambiguous ratios open until a number resolves them.
function routeOptions(p){
 if(!p.length||new Set(p).size!==p.length||p.some((i,k)=>k>0&&!adjacent(p[k-1],i)))return [];
 const known=p.findIndex(i=>specials[i]!=='rainbow');
 return [1,2,4].flatMap(ratio=>{
  const divisor=BigInt(ratio)**BigInt(Math.max(0,known));
  if(known>=0&&board[p[known]]%divisor!==0n)return [];
  const first=known<0?2n:board[p[known]]/divisor;
  if(first<2n||(first&(first-1n))!==0n)return [];
  const values=p.map((i,k)=>first*BigInt(ratio)**BigInt(k));
  if(values.some((v,k)=>specials[p[k]]!=='rainbow'&&board[p[k]]!==v))return [];
  return [{ratio,values}];
 });
}
function pathValues(p){return routeOptions(p)[0]?.values||[];}
function validPath(p){return routeOptions(p).length>0;}
function canAdd(i){return validPath([...path,i]);}
function merged(p=path){const sum=pathValues(p).reduce((sum,v)=>sum+v,0n);return sum<2n?2n:1n<<BigInt((sum-1n).toString(2).length);}
function rainbowValue(i){
 const k=path.indexOf(i);if(k<0)return null;
 const options=routeOptions(path),v=options[0]?.values[k];
 return options.every(o=>o.values[k]===v)?v:null;
}
function blastFor(selection){
 const chosen=new Set(selection),cleared=new Set(),detonated=new Set();
 const queue=selection.filter(i=>specials[i]==='bomb');
 while(queue.length){const i=queue.shift();if(detonated.has(i))continue;detonated.add(i);
  for(const j of neighbors(i)){if(!chosen.has(j))cleared.add(j);if(specials[j]==='bomb'&&!detonated.has(j))queue.push(j);}
 }
 const bonus=[...cleared].reduce((sum,i)=>sum+(specials[i]==='rainbow'?2n:board[i]),0n);
 return {cleared,detonated,bonus};
}
function formatTile(value){
 if(value<16384)return String(value);
 const power=exponent(value);
 return '2'+String(power).split('').map(c=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('');
}
function formatScore(value){
 value=BigInt(value);const sign=value<0n?'-':'';const v=value<0n?-value:value;
 if(v<1000000n)return value.toLocaleString('ja-JP');
 const units=['','万','億','兆','京','垓','秭','穣','溝','澗','正','載','極'];
 const group=Math.floor((v.toString().length-1)/4);
 if(group>=units.length)return sign+v.toString().slice(0,4)+'…('+v.toString().length+'桁)';
 const div=10000n**BigInt(group);return sign+(v/div)+'.'+((v%div)*100n/div).toString().padStart(2,'0')+units[group];
}
function showScore(id,value){const el=$(id);el.textContent=formatScore(value);el.title=value.toLocaleString('ja-JP');el.setAttribute('aria-label',el.title);}
function paintTile(el,value,type,effective){
 el.dataset.v=value;el.dataset.type=type||'';el.title=type==='rainbow'?'虹':value.toLocaleString('ja-JP');
 el.classList.toggle('bomb',type==='bomb');el.classList.toggle('rainbow',type==='rainbow');
 el.textContent=type==='rainbow'?(effective?`✦ ${formatTile(effective)}`:'✦'):formatTile(value);
}
function tone(step=0,type='tap'){if(!sound)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();let t=audioCtx.currentTime;const notes=type==='merge'?[0,4,7,12]:[step%15];notes.forEach((n,j)=>{let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=261.63*2**(n/12);g.gain.setValueAtTime(.0001,t+j*.065);g.gain.exponentialRampToValueAtTime(.1,t+j*.065+.01);g.gain.exponentialRampToValueAtTime(.0001,t+j*.065+.20);o.connect(g).connect(audioCtx.destination);o.start(t+j*.065);o.stop(t+j*.065+.22);});}catch(e){}}
function render(popIndex=-1){$('grid').replaceChildren(...board.map((v,i)=>{let b=document.createElement('button');b.className='tile'+(v>=512?' high':'')+(path.includes(i)?' selected':'')+(i===popIndex?' pop':'');b.dataset.i=i;paintTile(b,v,specials[i],rainbowValue(i));b.setAttribute('aria-label',`${Math.floor(i/5)+1}行${i%5+1}列 ${specials[i]==='rainbow'?'虹':v+(specials[i]==='bomb'?' 爆弾':'')}`);b.setAttribute('aria-pressed',path.includes(i));b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectTap(i);}});return b;}));showScore('score',score);showScore('best',best);$('undo').disabled=busy||!previous||competitive();$('hint').disabled=busy||competitive();$('restart').disabled=busy;$('arena').setAttribute('aria-busy',busy);$('game').classList.toggle('fever',fever>0);$('feverLabel').textContent=fever?'⚡ OVERDRIVE / SCORE ×2':'OVERDRIVE CHARGE';$('charge').textContent=fever?`残り ${fever} 手`:`${energy} / 100`;$('bar').style.width=(fever?fever/5*100:energy)+'%';drawLine();preview();}
function drawLine(){let a=$('arena').getBoundingClientRect();$('line').setAttribute('points',path.map(i=>{let r=$('grid').children[i].getBoundingClientRect();return `${r.x+r.width/2-a.x},${r.y+r.height/2-a.y}`}).join(' '));}
function preview(){
 const options=routeOptions(path),route=$('route');
 route.classList.toggle('locked',path.length>1&&options.length===1);
 if(path.length>1){
  const chosen=options[0],pending=options.length>1;
  const next=chosen.values.at(-1)*BigInt(chosen.ratio);
  route.textContent=pending?`虹：倍率待ち ×${options.map(o=>o.ratio).join(' / ×')}（離すと×${chosen.ratio}）`:`×${chosen.ratio} ルート固定 · 次は ${formatTile(next)}`;
  const blast=blastFor(path);
  $('result').innerHTML=`<span>${path.length} CONNECT${pending?' / 仮':''}</span><span>→</span><strong>${formatTile(merged())}</strong><span>${blast.detonated.size?'💣 '+blast.cleared.size+'枚 / −'+formatScore(blast.bonus):path.length>=5?'✦ COMBO!':''}</span>`;
 }else{
  route.textContent='最初の2枚で決まる：同じ数字 / ×2 / ×4';
  $('result').textContent='上下左右に、2枚からつなげよう';
 }
}
function add(i){if(path.length>1&&i===path.at(-2)){path.pop();render();return true;}if(canAdd(i)){path.push(i);tone(path.length*2);render();return true;}return false;}
function selectTap(i){if(busy||!inputAllowed())return;if(path.length&&i===path.at(-1)){if(path.length>1)commit();else{path=[];render();}}else if(!add(i)){path=[];add(i);}}
$('arena').addEventListener('pointerdown',e=>{if(busy||!inputAllowed()||e.button!==0)return;let el=e.target.closest('.tile');if(!el)return;e.preventDefault();let i=+el.dataset.i;dragging=true;moved=false;confirmTap=path.length>1&&i===path.at(-1);startCell=i;if(path.length&&i===path.at(-1))return;if(!add(i)){path=[];add(i);}});
window.addEventListener('pointermove',e=>{if(!dragging)return;let el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.tile');if(el){let i=+el.dataset.i;if(i!==startCell)moved=true;if(i!==path.at(-1))add(i);}});
window.addEventListener('pointerup',()=>{if(!dragging)return;dragging=false;if(path.length>1&&(moved||confirmTap))commit();});
window.addEventListener('pointercancel',()=>{dragging=false;if(busy)return;path=[];render();});window.addEventListener('resize',drawLine);
// Each destination retains its source cell, so movement is a faithful view of gravity.
function planFall(input, selection, value, spawn, types=specials, blast=new Set(),spawnType=rollSpecial){
 const end=selection.at(-1),removed=new Set([...selection.slice(0,-1),...blast]),next=Array(N),nextSpecials=Array(N).fill(null),moves=[];
 for(let c=0;c<COLS;c++){
  const survivors=[];
  for(let row=0;row<ROWS;row++){const from=row*COLS+c;if(!removed.has(from))survivors.push({from,value:from===end?value:input[from],type:from===end?null:types[from]});}
  const missing=ROWS-survivors.length;
  survivors.forEach((item,k)=>{const to=(missing+k)*COLS+c;next[to]=item.value;nextSpecials[to]=item.type;moves.push({...item,to,fresh:false,merged:item.from===end});});
  for(let row=0;row<missing;row++){const to=row*COLS+c;const tile=run.mode==='rogue'&&spawn===rand?rogueDraw():{value:spawn(),type:spawnType()};next[to]=tile.value;nextSpecials[to]=tile.type;moves.push({from:(row-missing)*COLS+c,to,fresh:true,merged:false});}
 }
 return {board:next,specials:nextSpecials,moves};
}
function animateTile(el,frames,duration,extra={}){
 if(reduced)return Promise.resolve();
 return el.animate(frames,{duration,easing:'cubic-bezier(.2,.7,.3,1)',...extra}).finished.catch(()=>{});
}
async function commit(){
 if(busy||path.length<2||!inputAllowed())return;
 moveCheckpoint=JSON.parse(encode(snapshot()));busy=true;dragging=false;
 previous={board:[...board],specials:[...specials],score,energy,fever,rngDeal,rngRescue,moves:run.moves};
 const selection=[...path],blast=blastFor(selection),len=selection.length,value=merged(),end=selection.at(-1),active=fever>0,gain=value*(len>=5?2n:1n)*(active?2n:1n)-blast.bonus;
 const acceptedAt=elapsed();run.moves++;run.actions.push({path:selection,at:Math.round(acceptedAt)});
 const oldCells=[...$('grid').children],rects=oldCells.map(el=>el.getBoundingClientRect()),r=rects[end];
 const plan=planFall(board,selection,value,rand,specials,blast.cleared);
 path=[];$('line').setAttribute('points','');
 $('undo').disabled=true;$('hint').disabled=true;$('restart').disabled=true;$('arena').setAttribute('aria-busy','true');
 try{
  $('result').textContent=blast.detonated.size?`💣 ${blast.detonated.size}連爆！ 周囲${blast.cleared.size}枚を消去`:'① 最後のマスで合体';
  blast.cleared.forEach(i=>oldCells[i].classList.add('blast'));
  blast.detonated.forEach(i=>{const q=rects[i];explode(q.x+q.width/2,q.y+q.height/2,30);});
  await Promise.all([...new Set([...selection.slice(0,-1),...blast.cleared])].map(i=>animateTile(oldCells[i],[{transform:'scale(.9)',opacity:1},{transform:'scale(.15)',opacity:0}],160,{fill:'forwards'})));
  paintTile(oldCells[end],value,null);oldCells[end].classList.remove('selected');
  await animateTile(oldCells[end],[{transform:'scale(.8)',filter:'brightness(1.6)'},{transform:'scale(1)',filter:'brightness(1)'}],140);
  board=plan.board;specials=plan.specials;
  score=score+gain<0n?0n:score+gain;if(!competitive())best=best>score?best:score;checkTarget(value,acceptedAt);if(run.mode==='rogue')rogueAfterMove(gain);let entered=false;
  if(active)fever--;else{energy+=len*5+(len>=5?10:0);if(energy>=100){energy=0;fever=5;entered=true;}}
  moveCheckpoint=null;render();save();
  const cells=[...$('grid').children],targets=cells.map(el=>el.getBoundingClientRect());
  const step=rects[COLS].y-rects[0].y;
  // Keep incoming cells hidden until the old cells have landed.
  plan.moves.filter(m=>m.fresh).forEach(m=>cells[m.to].style.visibility='hidden');
  $('result').textContent='② 空いた分だけ、列が下に落ちる ↓';
  await Promise.all(plan.moves.filter(m=>!m.fresh&&m.from!==m.to).map(m=>animateTile(cells[m.to],[{transform:`translateY(${rects[m.from].y-targets[m.to].y}px)`},{transform:'translateY(0)'}],300)));
  $('result').textContent='③ 上から新しい数字を補充 ↓';
  const incoming=plan.moves.filter(m=>m.fresh);
  await Promise.all(incoming.map(m=>{const el=cells[m.to];el.style.visibility='';const rows=(m.to-m.from)/COLS;return animateTile(el,[{transform:`translateY(${-rows*step}px)`,opacity:.3},{transform:'translateY(0)',opacity:1}],320,{delay:(m.to%COLS)*20});}));
  const landed=plan.moves.find(m=>m.merged);cells[landed.to].classList.add('merged');
  const finalRect=cells[landed.to].getBoundingClientRect();
  const repaired=ensureMoves();
  if(repaired){
   $('result').textContent='手詰まり救済：ランダムな隣接ペアを作成';
   await animateTile(cells[repaired.target],[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.75)'}],160);
   render();
   const updated=[...$('grid').children];
   updated[repaired.anchor].classList.add('rescued');updated[repaired.target].classList.add('rescued');
   await animateTile(updated[repaired.target],[{opacity:0,transform:'scale(.75)'},{opacity:1,transform:'scale(1)'}],180);
   toast('手詰まり救済：光る2枚がつながるように、1枚の数字を変更しました');
  }
  tone(0,'merge');explode(finalRect.x+finalRect.width/2,finalRect.y+finalRect.height/2,len>=5?65:22);
  if(entered)banner('OVERDRIVE!','5手のあいだ、スコア2倍 ⚡');
  else if(len>=8)banner('UNSTOPPABLE!',`${len} CONNECT / ${gain>=0n?'+':''}${formatScore(gain)}`);
  else if(len>=5)banner('SWEET COMBO!',`${len} CONNECT / ${gain>=0n?'+':''}${formatScore(gain)}`);
  $('result').innerHTML=`<strong>${gain>=0n?'+':''}${formatScore(gain)}</strong><span>${len} CONNECT / 合体 ${formatTile(value)}${blast.detonated.size?' / 💣 '+blast.cleared.size+'枚':''}</span>`;
 }finally{
  moveCheckpoint=null;busy=false;settleRun();$('undo').disabled=!previous||competitive();$('hint').disabled=competitive();$('restart').disabled=false;$('arena').setAttribute('aria-busy','false');save();
 }
}
function ensureMoves(){
 if(board.some((v,i)=>neighbors(i).some(j=>validPath([i,j]))))return null;
 let anchor=Math.floor(rescueRandom()*N),around=neighbors(anchor);
 let target=around[Math.floor(rescueRandom()*around.length)];
 const max=maxTile(board.filter((v,i)=>specials[i]!=='rainbow'));
 // Reverse the copy direction instead of ever overwriting a maximum tile.
 if(board[target]===max&&board[anchor]<max)[anchor,target]=[target,anchor];
 const before=board[target];board[target]=board[anchor];
 return {anchor,target,before,after:board[target]};
}
function findHint(){let bestPath=[];function dfs(p){if(p.length>bestPath.length)bestPath=[...p];if(p.length>=7||bestPath.length>=7)return;for(let j of neighbors(p.at(-1)))if(validPath([...p,j]))dfs([...p,j]);}for(let i=0;i<N;i++){dfs([i]);if(bestPath.length>=7)break;}return bestPath;}
$('hint').onclick=()=>{if(busy||competitive())return;path=[];render();let p=findHint();p.forEach(i=>$('grid').children[i].classList.add('hint'));toast(`${p.length}個つながる！ 光るマスをなぞろう`);};$('undo').onclick=()=>{if(busy||!previous||competitive())return;({board,specials,score,energy,fever,rngDeal,rngRescue}=previous);run.moves=previous.moves;run.actions.pop();previous=null;path=[];render();save();toast('ひとつ前の盤面に戻しました');};$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'♪ SOUND ON':'♪ SOUND OFF';$('sound').setAttribute('aria-pressed',sound);if(sound)tone(0,'merge');};$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();$('restart').onclick=()=>openSetup();$('cancelReset').onclick=()=>$('resetDialog').close();$('confirmReset').onclick=()=>{fresh();$('resetDialog').close();};
for(const id of ['score','best']){const el=$(id);el.setAttribute('role','button');el.tabIndex=0;el.onclick=()=>{if(id==='best'&&competitive())toast(modes[run.mode].name+'の自己記録：'+el.textContent);else toast((id==='score'?'スコア：':'自己ベスト：')+(id==='score'?score:best).toLocaleString('ja-JP'));};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.onclick();}};}
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function banner(title,sub){let el=document.createElement('div');el.className='burst';el.append(document.createTextNode(title));let small=document.createElement('small');small.textContent=sub;el.append(small);$('arena').append(el);setTimeout(()=>el.remove(),950);if(!reduced){$('arena').classList.remove('shake');void $('arena').offsetWidth;$('arena').classList.add('shake');}}
const canvas=$('fx'),ctx=canvas.getContext('2d');let animating=false;function explode(x,y,count){if(reduced)return;canvas.width=innerWidth;canvas.height=innerHeight;for(let n=0;n<count;n++)particles.push({x,y,vx:(Math.random()-.5)*12,vy:(Math.random()-.7)*13,life:1,size:2+Math.random()*5,c:['#d6ff3f','#f2a9d8','#fff','#a68ae9'][n%4]});if(!animating){animating=true;requestAnimationFrame(frame);}}function frame(){ctx.clearRect(0,0,canvas.width,canvas.height);particles=particles.filter(p=>p.life>0);for(let p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.25;p.life-=.025;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,p.size,p.size);}if(particles.length)requestAnimationFrame(frame);else animating=false;}
