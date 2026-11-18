'use strict';
/* ================================================================
   Neutral-atom course: units, lesson simulations, checkpoint quizzes.
   Loaded after the main script in index.html and shares its helpers
   (H, S, btn, rnd, pick, shuffle, pct, G, save, rerender, briefCard, selectLevel, ...).
   ================================================================ */
const COL={X:'#ff8a3d',Z:'#38b6ff',gold:'#ffd25a',ok:'#4dffa0',bad:'#ff4d5e',mut:'#8b9bb8',er:'#ff4fd8',line:'#22304d',txt:'#dfe8f7',dim:'#33415f'};
const TAU=2*Math.PI;
const KINDS={};
const LS={};                       // transient per-lesson state, keyed by lesson id
function lstate(lv, init){ if(!LS[lv.id]) LS[lv.id]=init(); return LS[lv.id]; }
function resetLesson(lv){ delete LS[lv.id]; rerender(); }

/* ---------- math helpers ---------- */
function gauss(){ let u=0; while(!u) u=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*rnd()); }
function binom(n,p){ let k=0; for(let i=0;i<n;i++) if(rnd()<p) k++; return k; }
function poisson(l){ const L=Math.exp(-l); let k=0, p=1; do{ k++; p*=rnd(); }while(p>L); return k-1; }
function poissonCdf(k,l){ if(k<0) return 0; let t=Math.exp(-l), s=t; for(let i=1;i<=k;i++){ t*=l/i; s+=t; } return Math.min(1,s); }
const popcnt = m => { let c=0; while(m){ m&=m-1; c++; } return c; };
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmtP=(v,d=1)=>(v*100).toFixed(d)+'%';

/* ---------- UI helpers ---------- */
function simShell(C, lv, right){
  C.innerHTML='';
  const wrap=H('div',{cls:'boardwrap'});
  wrap.appendChild(H('div',{cls:'boardhead'},`<span><b>${lv.num} ${lv.title}</b></span><span>${right||''}</span>`));
  const body=H('div',{cls:'simbody'});
  wrap.appendChild(body);
  C.appendChild(wrap);
  return body;
}
function sidePanel(Rt, lv){ Rt.innerHTML=''; Rt.appendChild(briefCard(lv)); const card=H('div',{cls:'card'}); Rt.appendChild(card); return card; }
function nextBtn(lv){
  const i=LEVELS.indexOf(lv);
  return i<LEVELS.length-1 ? btn('Next lesson →',()=>selectLevel(i+1),'pri') : btn('Open the Lab →',()=>{G.view='lab';document.getElementById('app').innerHTML='';rerender();},'pri');
}
function completeLesson(lv, stars){ stars=clamp(stars,1,3); if((G.progress.done[lv.id]||0)<stars){ G.progress.done[lv.id]=stars; save(); } }
function doneBox(card, lv, text){
  card.appendChild(H('div',{cls:'msg good'},`${text} <span style="color:var(--gold)">${'★'.repeat(G.progress.done[lv.id]||1)}</span>`));
  const a=H('div',{cls:'acts'}); a.appendChild(nextBtn(lv)); a.appendChild(btn('Replay',()=>resetLesson(lv))); card.appendChild(a);
}
function msgBox(card, m){ if(m) card.appendChild(H('div',{cls:'msg '+(m.c||'')},m.t)); }
function slider(label, min, max, step, val, fmt, onInput, onChange){
  const row=H('div',{cls:'sl'});
  const lab=H('div',{cls:'sll'},`<span>${label}</span><b>${fmt(val)}</b>`);
  const inp=H('input',{type:'range',min,max,step,value:val});
  inp.addEventListener('input',()=>{ const v=+inp.value; lab.querySelector('b').innerHTML=fmt(v); if(onInput) onInput(v); });
  if(onChange) inp.addEventListener('change',()=>onChange(+inp.value));
  row.append(lab,inp);
  return row;
}
// Inline multiple-choice question inside a panel. Returns true once answered correctly.
function miniQ(card, s, key, q, opts, a, why){
  const st=s.mq||(s.mq={}), r=st[key];
  const box=H('div',{cls:'mq'});
  box.appendChild(H('div',{cls:'mqq'},q));
  const row=H('div',{cls:'opt'});
  opts.forEach((o,i)=>row.appendChild(btn(o,()=>{
    if(r&&r.ok) return;
    st[key]={pick:i, ok:i===a, miss:((r&&r.miss)||0)+(i===a?0:1)};
    rerender();
  }, r&&r.pick===i ? (i===a?'good':'badb') : '', !!(r&&r.ok))));
  box.appendChild(row);
  if(r) box.appendChild(H('div',{cls:'small',style:`color:${r.ok?COL.ok:COL.bad}`}, r.ok ? '✓ '+why : '✗ Not quite. Try another answer.'));
  card.appendChild(box);
  return !!(r&&r.ok);
}
const missesOf = s => Object.values(s.mq||{}).reduce((a,r)=>a+(r.miss||0),0);

// Minimal SVG plotting
function plotSVG(o){
  const w=o.w||620, h=o.h||300, m={l:50,r:14,t:14,b:40};
  const svg=S('svg',{viewBox:`0 0 ${w} ${h}`,class:'plot'});
  const [x0,x1]=o.xr, [y0,y1]=o.yr;
  const X=x=>m.l+(x-x0)/(x1-x0)*(w-m.l-m.r), Y=y=>h-m.b-(y-y0)/(y1-y0)*(h-m.t-m.b);
  S('rect',{x:m.l,y:m.t,width:w-m.l-m.r,height:h-m.t-m.b,fill:'#0a1120',stroke:COL.line},svg);
  const ticks=(a,b,n)=>{ const out=[]; for(let i=0;i<=n;i++) out.push(a+(b-a)*i/n); return out; };
  for(const t of (o.xticks||ticks(x0,x1,5))){ S('line',{x1:X(t),x2:X(t),y1:m.t,y2:h-m.b,stroke:'#16213a'},svg); S('text',{x:X(t),y:h-m.b+15,fill:COL.mut,'font-size':11,'text-anchor':'middle'},svg).textContent=(o.xfmt||(v=>+v.toFixed(2)))(t); }
  for(const t of (o.yticks||ticks(y0,y1,4))){ S('line',{x1:m.l,x2:w-m.r,y1:Y(t),y2:Y(t),stroke:'#16213a'},svg); S('text',{x:m.l-6,y:Y(t)+4,fill:COL.mut,'font-size':11,'text-anchor':'end'},svg).textContent=(o.yfmt||(v=>+v.toFixed(2)))(t); }
  if(o.xlabel) S('text',{x:(m.l+w-m.r)/2,y:h-6,fill:COL.mut,'font-size':12,'text-anchor':'middle'},svg).textContent=o.xlabel;
  if(o.ylabel) S('text',{x:14,y:(m.t+h-m.b)/2,fill:COL.mut,'font-size':12,'text-anchor':'middle',transform:`rotate(-90 14 ${(m.t+h-m.b)/2})`},svg).textContent=o.ylabel;
  for(const v of (o.vlines||[])){ S('line',{x1:X(v.x),x2:X(v.x),y1:m.t,y2:h-m.b,stroke:v.color,'stroke-width':v.width||1.5,'stroke-dasharray':v.dash||''},svg); if(v.label) S('text',{x:X(v.x)+4,y:m.t+13,fill:v.color,'font-size':11},svg).textContent=v.label; }
  for(const v of (o.hlines||[])){ S('line',{x1:m.l,x2:w-m.r,y1:Y(v.y),y2:Y(v.y),stroke:v.color,'stroke-width':v.width||1.2,'stroke-dasharray':v.dash||'5 4'},svg); if(v.label) S('text',{x:w-m.r-4,y:Y(v.y)-4,fill:v.color,'font-size':11,'text-anchor':'end'},svg).textContent=v.label; }
  for(const sr of (o.series||[])){
    const d=sr.xs.map((x,i)=>`${i?'L':'M'}${X(x).toFixed(1)},${Y(clamp(sr.ys[i],y0,y1)).toFixed(1)}`).join('');
    S('path',{d,fill:'none',stroke:sr.color,'stroke-width':sr.width||2,'stroke-dasharray':sr.dash||'',opacity:sr.op||1},svg);
  }
  for(const b of (o.bars||[])) S('rect',{x:X(b.x0),y:Y(b.y),width:Math.max(0,X(b.x1)-X(b.x0)),height:Math.max(0,Y(y0)-Y(b.y)),fill:b.color,opacity:b.op||.8},svg);
  for(const p of (o.points||[])){
    if(p.err) S('line',{x1:X(p.x),x2:X(p.x),y1:Y(clamp(p.y-p.err,y0,y1)),y2:Y(clamp(p.y+p.err,y0,y1)),stroke:p.color,'stroke-width':1.3},svg);
    S('circle',{cx:X(p.x),cy:Y(p.y),r:p.r||3.5,fill:p.color},svg);
  }
  if(o.legend){ let lx=m.l+8; for(const L of o.legend){ S('rect',{x:lx,y:m.t+6,width:10,height:10,fill:L.color,rx:2},svg); const t=S('text',{x:lx+14,y:m.t+15,fill:COL.txt,'font-size':11},svg); t.textContent=L.label; lx+=L.label.length*6.2+30; } }
  return {svg,X,Y,m,w,h};
}
function atomDefs(svg){
  const d=S('defs',{},svg);
  d.innerHTML=`<radialGradient id="cAtom"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#cfe3ff"/><stop offset="1" stop-color="#6d8fd6"/></radialGradient>
  <radialGradient id="cHalo"><stop offset="0" stop-color="#bcd6ff" stop-opacity=".55"/><stop offset="1" stop-color="#bcd6ff" stop-opacity="0"/></radialGradient>
  <radialGradient id="cRyd"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".6" stop-color="#ffd25a"/><stop offset="1" stop-color="#c98a10"/></radialGradient>
  <radialGradient id="cRydH"><stop offset="0" stop-color="#ffd25a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd25a" stop-opacity="0"/></radialGradient>
  <radialGradient id="cTw"><stop offset="0" stop-color="#ff5a5a" stop-opacity=".35"/><stop offset="1" stop-color="#ff5a5a" stop-opacity="0"/></radialGradient>`;
}
function drawAtom(g, x, y, r, kind){
  // kind: 'g' ground (blue-white), 'r' Rydberg (gold), 'dim'
  if(kind==='dim'){ S('circle',{cx:x,cy:y,r:r*.8,fill:COL.dim},g); return; }
  S('circle',{cx:x,cy:y,r:r*2,fill:kind==='r'?'url(#cRydH)':'url(#cHalo)'},g);
  S('circle',{cx:x,cy:y,r,fill:kind==='r'?'url(#cRyd)':'url(#cAtom)'},g);
}

/* ================================================================
   Unit 1 — Atoms & tweezers
   ================================================================ */
KINDS.loading=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({occ:null, loads:[], enh:false}));
  const N=10, filled=s.occ?s.occ.filter(Boolean).length:0;
  const body=simShell(C,lv, s.occ?`This load: <b>${filled}/100</b> sites filled`:'Press <b>Load the array</b>');
  const svg=S('svg',{viewBox:'-0.9 -0.9 11.8 11.8'}); atomDefs(svg);
  for(let i=0;i<N*N;i++){
    const x=i%N, y=Math.floor(i/N);
    S('circle',{cx:x,cy:y,r:.45,fill:'url(#cTw)'},svg);
    if(s.occ&&s.occ[i]) drawAtom(svg,x,y,.2,'g');
  }
  body.appendChild(svg);
  const card=sidePanel(Rt,lv);
  card.appendChild(H('h3',{},'Experiment'));
  const acts=H('div',{cls:'acts'});
  acts.appendChild(btn('Load the array',()=>{
    const p=s.enh?0.8:0.5;
    s.occ=Array.from({length:N*N},()=>rnd()<p?1:0);
    s.loads.unshift({n:s.occ.filter(Boolean).length, enh:s.enh});
    rerender();
  },'pri'));
  acts.appendChild(btn(s.enh?'Enhanced loading: ON':'Enhanced loading: off',()=>{ s.enh=!s.enh; rerender(); },s.enh?'on':'','',
    'Blue-detuned / gray-molasses light-assisted collisions eject only one atom of a pair (~80% loading)'));
  card.appendChild(acts);
  if(s.loads.length){
    const std=s.loads.filter(l=>!l.enh).map(l=>l.n), en=s.loads.filter(l=>l.enh).map(l=>l.n);
    const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):'—';
    card.appendChild(H('div',{cls:'small',style:'margin-top:8px'},`<div class="stat"><span>Standard loads (${std.length})</span><span>mean ${avg(std)} atoms</span></div><div class="stat"><span>Enhanced loads (${en.length})</span><span>mean ${avg(en)} atoms</span></div><div class="mut">Recent: ${s.loads.slice(0,8).map(l=>l.n+(l.enh?'*':'')).join(', ')}</div>`));
  }
  if(s.loads.length>=3){
    card.appendChild(H('h3',{},'Checkpoint'));
    const a=miniQ(card,s,'why','Why does each tweezer hold either 0 or 1 atom, and is filled only about half the time?',
      ['The tweezer is too small for two atoms','Light-assisted collisions kick out atoms in pairs','Pauli exclusion forbids two atoms','The trap laser ionizes extra atoms'],1,
      'Inside a tiny trap, near-resonant cooling light drives light-assisted collisions that eject atoms in pairs. An even number ends at 0, an odd number at 1, so each site holds 0 or 1 with ≈50% each (Schlosser et al. 2001).');
    const b=a && miniQ(card,s,'all','With 50% loading, what is the chance that all 100 sites fill in one shot?',['≈ 50%','≈ 1%','≈ 10⁻³⁰'],2,
      '0.5¹⁰⁰ ≈ 8×10⁻³¹. Large defect-free arrays need rearrangement: image, then move atoms into place. That\'s the next lesson.');
    if(a&&b){ completeLesson(lv,3-missesOf(s)); doneBox(card,lv,'Lesson complete.'); }
  } else card.appendChild(H('div',{cls:'msg'},'Load the array a few times (at least 3). Each site is an independent coin flip.'));
};

KINDS.rearrange=(C,Rt,lv)=>{
  const W=6, T0=1, T1=4;
  const inT=i=>{ const x=i%W, y=Math.floor(i/W); return x>=T0&&x<=T1&&y>=T0&&y<=T1; };
  const pos=i=>[i%W, Math.floor(i/W)];
  const dist=(a,b)=>{ const [ax,ay]=pos(a),[bx,by]=pos(b); return Math.hypot(ax-bx,ay-by); };
  const greedyPlan=occ=>{
    const o=occ.slice(), plan=[];
    const holes=o.map((v,i)=>i).filter(i=>inT(i)&&!o[i]);
    for(const h of holes){
      let best=-1, bd=1e9;
      o.forEach((v,i)=>{ if(v&&!inT(i)){ const d=dist(i,h); if(d<bd){bd=d;best=i;} } });
      if(best<0) return null;
      o[best]=0; o[h]=1; plan.push([best,h,bd]);
    }
    return plan;
  };
  const fresh=()=>{ const occ=Array.from({length:W*W},()=>rnd()<0.6?1:0); const plan=greedyPlan(occ); return {occ, sel:null, moves:0, dist:0, lostN:0, last:null, ref:plan?plan.reduce((a,p)=>a+p[2],0):null}; };
  const s=lstate(lv,()=>({...fresh(), wins:0, autoOK:false, msg:null}));
  const total=s.occ.filter(Boolean).length, inside=s.occ.filter((v,i)=>v&&inT(i)).length;
  const body=simShell(C,lv,`Atoms: <b>${total}</b> · target filled <b>${inside}/16</b> · moves ${s.moves}`);
  const svg=S('svg',{viewBox:'-0.8 -0.8 7.6 7.6'}); atomDefs(svg);
  S('rect',{x:T0-.48,y:T0-.48,width:T1-T0+.96,height:T1-T0+.96,fill:'none',stroke:COL.gold,'stroke-width':.04,'stroke-dasharray':'.12 .08',rx:.1},svg);
  if(s.last) { const [a,b]=s.last.map(pos); S('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:s.lostLast?COL.bad:COL.gold,'stroke-width':.05,'stroke-dasharray':'.1 .07'},svg); }
  for(let i=0;i<W*W;i++){
    const [x,y]=pos(i);
    S('circle',{cx:x,cy:y,r:.45,fill:'url(#cTw)'},svg);
    if(s.occ[i]) drawAtom(svg,x,y,.18,'g');
    if(s.sel===i) S('circle',{cx:x,cy:y,r:.32,fill:'none',stroke:'#fff','stroke-width':.05},svg);
    const hit=S('circle',{cx:x,cy:y,r:.47,fill:'transparent',style:'cursor:pointer'},svg);
    hit.addEventListener('click',()=>{
      if(s.done) return;
      if(s.occ[i]){ s.sel = s.sel===i ? null : i; s.msg=null; return rerender(); }
      if(s.sel===null){ s.msg={t:'Select an atom first, then an empty tweezer.'}; return rerender(); }
      const d=dist(s.sel,i), pl=0.004+0.006*d;
      s.moves++; s.dist+=d; s.last=[s.sel,i];
      s.occ[s.sel]=0;
      if(rnd()<pl){ s.lostN++; s.lostLast=true; s.msg={t:`The atom was lost in transit (chance ${fmtP(pl)} for a ${d.toFixed(1)}-site move). Longer moves heat atoms and give more time for collisions.`,c:'warn'}; }
      else { s.occ[i]=1; s.lostLast=false; s.msg=null; }
      s.sel=null; rerender();
    });
  }
  body.appendChild(svg);
  const card=sidePanel(Rt,lv);
  card.appendChild(H('div',{},`<div class="stat"><span>Moves / total distance</span><span>${s.moves} / ${s.dist.toFixed(1)} sites</span></div><div class="stat"><span>Reference plan (greedy nearest)</span><span>${s.ref!=null?s.ref.toFixed(1)+' sites':'not enough atoms'}</span></div><div class="stat"><span>Atoms lost moving</span><span>${s.lostN}</span></div>`));
  const acts=H('div',{cls:'acts'});
  acts.appendChild(btn('Image the array',()=>{
    const ok=s.occ.every((v,i)=>!inT(i)||v);
    if(ok){
      s.done=true; s.wins++; s.autoOK=true;
      const ratio=s.ref?s.dist/s.ref:1;
      completeLesson(lv, ratio<=1.15?3:ratio<=1.5?2:1);
      s.msg={t:`<b>Defect-free 4×4!</b> Your total move distance was ${(ratio*100).toFixed(0)}% of the greedy reference.`,c:'good'};
    } else s.msg={t:`${16-inside} target site${16-inside>1?'s are':' is'} still empty.`,c:'warn'};
    rerender();
  },'pri',!!s.done));
  acts.appendChild(btn('Reload (new random load)',()=>{ Object.assign(s,fresh(),{done:false,msg:null}); rerender(); }));
  if(s.autoOK && !s.done) acts.appendChild(btn('Auto-rearrange',()=>{
    const plan=greedyPlan(s.occ); if(!plan){ s.msg={t:'Not enough atoms. Reload.',c:'warn'}; return rerender(); }
    let lost=0; for(const [a,b,d] of plan){ s.occ[a]=0; if(rnd()<0.004+0.006*d) lost++; else s.occ[b]=1; s.moves++; s.dist+=d; }
    s.lostN+=lost; s.last=null; s.msg={t:`Control software ran ${plan.length} moves${lost?`; ${lost} atom${lost>1?'s':''} lost, so image and repair`:''}.`}; rerender();
  },'','', 'Unlocked after your first manual success'));
  card.appendChild(acts);
  if(total<16 && !s.done) card.appendChild(H('div',{cls:'msg warn'},`Only ${total} atoms loaded. You can't fill 16 sites. Reload.`));
  msgBox(card,s.msg);
  if(G.progress.done[lv.id] && s.done) doneBox(card,lv,'Rearrangement mastered.');
  else card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'Click an atom, then an empty tweezer inside the gold square. Shorter moves lose fewer atoms. Then <b>Image</b> to verify.'));
};

/* ================================================================
   Quiz (checkpoints)
   ================================================================ */
KINDS.quiz=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({i:0, miss:0, pick:null, order:lv.qs.map((q,i)=>i)}));
  const done=s.i>=lv.qs.length;
  const body=simShell(C,lv, done?'Complete':`Question <b>${s.i+1}/${lv.qs.length}</b>`);
  const box=H('div',{cls:'quizbox'});
  if(done){
    box.innerHTML=`<div class="big">Checkpoint passed</div><p class="mut">${s.miss===0?'Perfect: no mistakes.':`${s.miss} wrong attempt${s.miss>1?'s':''} along the way.`}</p>`;
  } else {
    const q=lv.qs[s.i];
    box.appendChild(H('div',{cls:'qq'},q.q));
    const opts=H('div',{cls:'qopts'});
    q.o.forEach((o,k)=>{
      const st = s.pick===k ? (k===q.a?' good':' badb') : '';
      opts.appendChild(btn(o,()=>{
        if(s.pick===q.a) return;
        s.pick=k; if(k!==q.a) s.miss++;
        rerender();
      },'qopt'+st));
    });
    box.appendChild(opts);
    if(s.pick!==null){
      const ok=s.pick===q.a;
      box.appendChild(H('div',{cls:'msg '+(ok?'good':'bad')},(ok?'<b>Correct.</b> ':'<b>Not quite.</b> ')+(ok?q.why:'Pick another option.')));
      if(ok){ const a=H('div',{cls:'acts'}); a.appendChild(btn(s.i+1<lv.qs.length?'Next question →':'Finish',()=>{ s.i++; s.pick=null; if(s.i>=lv.qs.length) completeLesson(lv, s.miss===0?3:s.miss<=2?2:1); rerender(); },'pri')); box.appendChild(a); }
    }
  }
  body.appendChild(box);
  const card=sidePanel(Rt,lv);
  const pips=H('div',{cls:'pips'});
  lv.qs.forEach((q,k)=>pips.appendChild(H('div',{cls:'pip'+(k<s.i?' w':'')})));
  card.appendChild(pips);
  card.appendChild(H('div',{cls:'small mut',style:'margin-top:6px'},`Wrong attempts: ${s.miss}`));
  if(done) doneBox(card,lv,'Checkpoint complete.');
};

/* ================================================================
   Unit 2 — The qubit
   ================================================================ */
// Probability of |1⟩ after a pulse of area π (on resonance) at detuning Δ, Rabi frequency Ω (both in kHz).
const rabiP=(D,Om)=>{ const g=Math.hypot(Om,D); return (Om*Om)/(g*g)*Math.sin(Math.PI/2*g/Om)**2; };
KINDS.spectro=(C,Rt,lv)=>{
  const fresh=()=>({d0:Math.round((rnd()*2-1)*800)/10, pts:[], budget:14, f:0, wide:true, est:0, res:null});
  const s=lstate(lv,()=>({...fresh(), tries:0}));
  const body=simShell(C,lv,`Measurements left: <b>${s.budget}</b>`);
  const draw=()=>{
    body.innerHTML='';
    const series=[], vl=[{x:s.f,color:'#ffffff55',dash:'3 3',label:'probe'}];
    if(s.res){
      const xs=[]; for(let x=-150;x<=150;x+=0.5) xs.push(x);
      series.push({xs,ys:xs.map(x=>rabiP(x-s.d0,40)),color:COL.Z,op:.5});
      series.push({xs,ys:xs.map(x=>rabiP(x-s.d0,5)),color:COL.X,op:.7});
      vl.push({x:s.d0,color:COL.ok,label:'true'});
    }
    vl.push({x:s.est,color:COL.gold,label:'your estimate'});
    const P=plotSVG({xr:[-150,150],yr:[0,1.05],xlabel:'laser detuning from expected frequency (kHz)',ylabel:'P(|1⟩)',series,vlines:vl,
      points:s.pts.map(p=>({x:p.f,y:p.k/p.n,err:Math.sqrt(Math.max(p.k*(p.n-p.k),1)/p.n)/p.n*1.0,color:p.wide?COL.Z:COL.X})),
      legend:[{label:'strong Ω = 2π×40 kHz',color:COL.Z},{label:'weak Ω = 2π×5 kHz',color:COL.X}]});
    P.svg.addEventListener('click',ev=>{
      const r=P.svg.getBoundingClientRect(), x=(ev.clientX-r.left)/r.width*P.w;
      const f=Math.round((x-P.m.l)/(P.w-P.m.l-P.m.r)*300-150);
      if(f>=-150&&f<=150){ s.f=f; rerender(); }
    });
    body.appendChild(P.svg);
  };
  draw();
  const card=sidePanel(Rt,lv);
  card.appendChild(H('h3',{},'Probe pulse'));
  const row=H('div',{cls:'opt'});
  row.appendChild(btn('Strong Ω (wide line)',()=>{s.wide=true;rerender();},s.wide?'on':''));
  row.appendChild(btn('Weak Ω (narrow line)',()=>{s.wide=false;rerender();},!s.wide?'on':''));
  card.appendChild(row);
  card.appendChild(slider('Probe frequency',-150,150,1,s.f,v=>`${v} kHz`,v=>{s.f=v;draw();}));
  const acts=H('div',{cls:'acts'});
  acts.appendChild(btn('Measure (50 shots)',()=>{
    const Om=s.wide?40:5, p=rabiP(s.f-s.d0,Om), k=binom(50,p);
    s.pts.push({f:s.f,k,n:50,wide:s.wide}); s.budget--; rerender();
  },'pri',s.budget<=0||!!s.res));
  card.appendChild(acts);
  card.appendChild(H('h3',{},'Lock the laser'));
  card.appendChild(slider('Resonance estimate',-150,150,0.5,s.est,v=>`${v} kHz`,v=>{s.est=v;draw();}));
  const a2=H('div',{cls:'acts'});
  a2.appendChild(btn('Lock here',()=>{
    const e=Math.abs(s.est-s.d0); s.res={e}; s.tries++;
    if(e<=4) completeLesson(lv, e<=1.5&&s.tries===1?3:e<=2.5?2:1);
    rerender();
  },'pri',!!s.res));
  card.appendChild(a2);
  if(s.res){
    const ok=s.res.e<=4;
    card.appendChild(H('div',{cls:'msg '+(ok?'good':'bad')},`True resonance: <b>${s.d0} kHz</b>. You were off by ${s.res.e.toFixed(1)} kHz. ${ok?'A π-pulse at your frequency now flips the qubit with high fidelity.':'Too far: a weak π-pulse there would barely flip the atom.'}`));
    if(ok) doneBox(card,lv,'Laser locked.');
    else { const a=H('div',{cls:'acts'}); a.appendChild(btn('Try a new atom',()=>{ Object.assign(s,fresh()); rerender(); },'pri')); card.appendChild(a); }
  } else card.appendChild(H('div',{cls:'small mut'},'Each measurement uses 50 shots, and the outcomes are binomially random. Strong pulses give a wide line that\'s easy to find but imprecise. Weak (long) pulses give a narrow line, the Fourier limit. Click the plot to aim the probe. Goal: within ±4 kHz (±1.5 for ★★★).'));
};

/* ---------- Bloch sphere ---------- */
const BL_TASKS=[
  {t:'Flip |0⟩ → |1⟩', start:[0,0,1], target:[0,0,-1], max:1, why:'A π pulse about any equatorial axis flips the qubit.'},
  {t:'Make |+⟩ = (|0⟩+|1⟩)/√2', start:[0,0,1], target:[1,0,0], max:1, why:'A π/2 pulse about +y tips +z onto +x. About +x you would land on −y instead!'},
  {t:'Make |+i⟩ = (|0⟩+i|1⟩)/√2', start:[0,0,1], target:[0,1,0], max:1, why:'Rotating about −x (laser phase 180°) by π/2 takes +z to +y. The laser phase picks the rotation axis.'},
  {t:'Turn |+⟩ into |−⟩', start:[1,0,0], target:[-1,0,0], max:1, why:'A virtual Z(π) just shifts the phase reference of later pulses: free and error-less. A π pulse about y also works.'},
  {t:'Spin echo: |+⟩ → |+⟩ using exactly two π pulses', start:[1,0,0], target:[1,0,0], max:2, exact:2, why:'Two π pulses about the same axis return the state, and between them any phase error is undone. That\'s the echo trick for the next lesson.'},
];
function rot(v,k,th){ const c=Math.cos(th), s=Math.sin(th), d=k[0]*v[0]+k[1]*v[1]+k[2]*v[2];
  const cr=[k[1]*v[2]-k[2]*v[1], k[2]*v[0]-k[0]*v[2], k[0]*v[1]-k[1]*v[0]];
  return [0,1,2].map(i=>v[i]*c+cr[i]*s+k[i]*d*(1-c)); }
function blochSVG(v, trail, target){
  const az=-30*Math.PI/180, el=20*Math.PI/180;
  const P=([x,y,z])=>{ const x1=x*Math.cos(az)-y*Math.sin(az), y1=x*Math.sin(az)+y*Math.cos(az); return [y1, -(z*Math.cos(el)-x1*Math.sin(el)), x1*Math.cos(el)+z*Math.sin(el)]; };
  const svg=S('svg',{viewBox:'-1.6 -1.45 3.2 2.9',class:'bloch'});
  S('circle',{cx:0,cy:0,r:1,fill:'#0c1630',stroke:'#3a4f7c','stroke-width':.012},svg);
  const ring=(f)=>{ const pts=[]; for(let i=0;i<=72;i++){ const a=i/72*TAU; pts.push(P(f(a))); } return pts; };
  const drawRing=(pts,col)=>{ for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1]; S('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:col,'stroke-width':.01,'stroke-dasharray':a[2]<0?'.03 .03':''},svg); } };
  drawRing(ring(a=>[Math.cos(a),Math.sin(a),0]),'#3a4f7c');
  drawRing(ring(a=>[Math.cos(a),0,Math.sin(a)]),'#22304d');
  const axes=[[[0,0,1],'|0⟩'],[[0,0,-1],'|1⟩'],[[1,0,0],'|+⟩'],[[-1,0,0],'|−⟩'],[[0,1,0],'|+i⟩'],[[0,-1,0],'|−i⟩']];
  for(const [a,l] of axes){ const p=P(a); S('line',{x1:0,y1:0,x2:p[0],y2:p[1],stroke:'#2a3a5e','stroke-width':.01},svg); const q=P(a.map(c=>c*1.18)); S('text',{x:q[0],y:q[1]+.04,fill:COL.mut,'font-size':.11,'text-anchor':'middle'},svg).textContent=l; }
  if(target){ const t=P(target); S('circle',{cx:t[0],cy:t[1],r:.07,fill:'none',stroke:COL.gold,'stroke-width':.02,'stroke-dasharray':'.03 .02'},svg); }
  if(trail&&trail.length>1){ const d=trail.map((p,i)=>{ const q=P(p); return `${i?'L':'M'}${q[0].toFixed(3)},${q[1].toFixed(3)}`; }).join(''); S('path',{d,fill:'none',stroke:COL.Z,'stroke-width':.02,opacity:.7},svg); }
  const e=P(v);
  S('line',{x1:0,y1:0,x2:e[0],y2:e[1],stroke:COL.gold,'stroke-width':.035,'stroke-linecap':'round'},svg);
  S('circle',{cx:e[0],cy:e[1],r:.045,fill:COL.gold},svg);
  return svg;
}
KINDS.bloch=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({k:0, v:[0,0,1], used:0, area:Math.PI/2, trail:null, extra:0, msg:null}));
  const done=s.k>=BL_TASKS.length, task=BL_TASKS[Math.min(s.k,BL_TASKS.length-1)];
  if(!done && s.used===0 && !s.trail) s.v=task.start.slice();
  const body=simShell(C,lv, done?'All tasks complete':`Task <b>${s.k+1}/${BL_TASKS.length}</b>: ${task.t}`);
  body.appendChild(blochSVG(s.v, s.trail, done?null:task.target));
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(H('div',{cls:'msg'},`<b>${task.t}</b><br>Pulses allowed: ${task.max}${task.exact?' (exactly)':''} · used: ${s.used}`));
    card.appendChild(H('h3',{},'Pulse area'));
    const ar=H('div',{cls:'opt'});
    [[Math.PI/2,'π/2'],[Math.PI,'π']].forEach(([a,l])=>ar.appendChild(btn(l,()=>{s.area=a;rerender();},s.area===a?'on':'')));
    card.appendChild(ar);
    card.appendChild(H('h3',{},'Apply: laser phase sets the axis'));
    const ax=H('div',{cls:'tools'});
    const apply=(k,th,label)=>{
      const tr=[]; for(let i=0;i<=24;i++) tr.push(rot(s.v,k,th*i/24));
      s.v=tr[24]; s.trail=tr; s.used++;
      const hit=s.v[0]*task.target[0]+s.v[1]*task.target[1]+s.v[2]*task.target[2] > 0.995;
      if(hit && (!task.exact || s.used===task.exact)){ s.msg={t:`✓ ${task.why}`,c:'good'}; s.extra+=Math.max(0,s.used-task.max); s.k++; s.used=0; s.trail=null; if(s.k>=BL_TASKS.length) completeLesson(lv,3-Math.min(2,s.extra)); }
      else if(s.used>=task.max){ s.msg={t:`Not there yet after ${s.used} pulse${s.used>1?'s':''} (${label}). Reset and rethink: which axis rotates the arrow toward the gold ring?`,c:'warn'}; }
      else s.msg={t:`Applied ${label}.`};
      rerender();
    };
    [[[1,0,0],'+x (0°)'],[[0,1,0],'+y (90°)'],[[-1,0,0],'−x (180°)'],[[0,-1,0],'−y (270°)']].forEach(([k,l])=>ax.appendChild(btn(l,()=>apply(k,s.area,`${s.area===Math.PI?'π':'π/2'} about ${l}`),'','',`Rotate by the chosen area about ${l}`)));
    ax.appendChild(btn('virtual Z(π)',()=>apply([0,0,1],Math.PI,'virtual Z(π)'),'','','Shift the phase of all later pulses by 180°'));
    card.appendChild(ax);
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Reset task',()=>{ s.v=task.start.slice(); s.used=0; s.trail=null; s.extra++; s.msg={t:'Task reset.'}; rerender(); }));
    card.appendChild(a);
    msgBox(card,s.msg);
    card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'Convention: a pulse with laser phase φ rotates the Bloch vector about the axis (cos φ, sin φ, 0) by the pulse area (right-hand rule). |0⟩ is the north pole.'));
  } else { msgBox(card,s.msg); doneBox(card,lv,'You can steer a qubit anywhere on the sphere.'); }
};

/* ---------- Ramsey / spin echo ---------- */
const RAM={N:60, sigS:0.19, sigF:0.05, tauC:25, Tmax:250, M:1000, eps:0.015, opts:[0,1,2,4,8,16,32], tasks:[4,40,200]};
function ramseyRealization(){
  const dt=RAM.Tmax/RAM.M, a=Math.exp(-dt/RAM.tauC), b=RAM.sigF*Math.sqrt(1-a*a);
  return Array.from({length:RAM.N},()=>{ const st=RAM.sigS*gauss(); const d=new Float64Array(RAM.M); let f=RAM.sigF*gauss(); for(let i=0;i<RAM.M;i++){ d[i]=st+f; f=a*f+b*gauss(); } return d; });
}
function ramseyPhases(atoms, T, n){
  const dt=RAM.Tmax/RAM.M, steps=Math.min(RAM.M,Math.round(T/dt));
  return atoms.map(d=>{ let ph=0; for(let i=0;i<steps;i++){ const t=(i+.5)*dt; let sg=1; if(n>0){ const k=Math.floor(t/T*n+0.5); sg=k%2?-1:1; } ph+=d[i]*sg*dt; } return ph; });
}
function ramseyContrast(atoms,T,n){ const ph=ramseyPhases(atoms,T,n); let c=0,s=0; for(const p of ph){ c+=Math.cos(p); s+=Math.sin(p); } return Math.hypot(c,s)/ph.length*Math.pow(1-RAM.eps,n); }
KINDS.ramsey=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({k:0, n:0, runs:[], extra:0, msg:null, atoms:null}));
  const done=s.k>=RAM.tasks.length, T=RAM.tasks[Math.min(s.k,RAM.tasks.length-1)];
  const body=simShell(C,lv, done?'All hold times mastered':`Task <b>${s.k+1}/3</b>: maximize contrast after <b>${T} ms</b>`);
  const row=H('div',{cls:'simrow'});
  const xs=[]; for(let t=2;t<=RAM.Tmax;t+=4) xs.push(t);
  const series=s.runs.slice(-4).map((r,i,arr)=>({xs,ys:r.curve,color:i===arr.length-1?COL.gold:COL.Z,op:i===arr.length-1?1:.35,width:i===arr.length-1?2.5:1.5}));
  const P=plotSVG({w:560,h:300,xr:[0,RAM.Tmax],yr:[0,1.02],xlabel:'hold time (ms)',ylabel:'Ramsey contrast',series,vlines:done?[]:[{x:T,color:COL.ok,label:`task: ${T} ms`}],
    points:s.runs.filter(r=>r.T===T).map(r=>({x:T,y:r.C,color:r.pass?COL.ok:COL.bad,r:4}))});
  row.appendChild(P.svg);
  // phase fan
  const fan=S('svg',{viewBox:'-1.3 -1.3 2.6 2.9',class:'fan'});
  S('circle',{cx:0,cy:0,r:1,fill:'#0c1630',stroke:'#3a4f7c','stroke-width':.015},fan);
  const last=s.runs[s.runs.length-1];
  if(last){ for(const p of last.ph){ S('line',{x1:0,y1:0,x2:Math.cos(p)*.95,y2:-Math.sin(p)*.95,stroke:COL.Z,'stroke-width':.012,opacity:.6},fan); }
    S('line',{x1:0,y1:0,x2:last.C,y2:0,stroke:COL.gold,'stroke-width':.05,'stroke-linecap':'round'},fan);
    S('text',{x:0,y:1.25,fill:COL.mut,'font-size':.13,'text-anchor':'middle'},fan).textContent=`n=${last.n} echoes · T=${last.T} ms`; }
  else S('text',{x:0,y:1.25,fill:COL.mut,'font-size':.13,'text-anchor':'middle'},fan).textContent='atom phases appear here';
  row.appendChild(fan);
  body.appendChild(row);
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(H('h3',{},'Number of echo π-pulses (CPMG)'));
    const o=H('div',{cls:'opt'});
    RAM.opts.forEach(n=>o.appendChild(btn(String(n),()=>{s.n=n;rerender();},s.n===n?'on':'')));
    card.appendChild(o);
    const a=H('div',{cls:'acts'});
    a.appendChild(btn(`Run Ramsey at ${T} ms`,()=>{
      const atoms=ramseyRealization();
      const C0=ramseyContrast(atoms,T,s.n);
      const best=Math.max(...RAM.opts.map(n=>ramseyContrast(atoms,T,n)));
      const curve=xs.map(t=>ramseyContrast(atoms,t,s.n));
      const pass=C0>=best-0.04;
      s.runs.push({T,n:s.n,C:C0,curve,ph:ramseyPhases(atoms,T,s.n),pass});
      s.tries=(s.tries||0)+1;
      if(pass){ s.msg={t:`Contrast ${fmtP(C0)} with ${s.n} echo pulse${s.n===1?'':'s'}: as good as it gets for this hold time (best ≈ ${fmtP(best)}).`,c:'good'}; s.extra+=Math.max(0,s.tries-1); s.tries=0; s.k++; if(s.k>=RAM.tasks.length) completeLesson(lv,3-Math.min(2,s.extra)); }
      else s.msg={t:`Contrast ${fmtP(C0)}. Another echo count reaches ≈ ${fmtP(best)}. ${s.n===0?'Static detuning differences dephase the ensemble.':'Each π-pulse also costs '+fmtP(RAM.eps,1)+' contrast.'}`,c:'warn'};
      rerender();
    },'pri'));
    card.appendChild(a);
  }
  msgBox(card,s.msg);
  if(done) doneBox(card,lv,'Dephasing tamed.');
  else card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},`Model: 60 atoms, each with a static detuning (σ = 2π×30 Hz, from trap-depth and thermal differences) plus slowly fluctuating noise (correlation time ${RAM.tauC} ms). Every π-pulse has a ${fmtP(RAM.eps,1)} error.`));
};

/* ---------- Readout ---------- */
const RO={lb:1.6, ld:0.25, tauLoss:3500};
KINDS.readout=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({t:8, k:6, samp:null, sampT:null, msg:null}));
  const resample=()=>{ s.samp={b:Array.from({length:1500},()=>poisson(RO.lb*s.t)), d:Array.from({length:1500},()=>poisson(RO.ld*s.t))}; s.sampT=s.t; };
  if(!s.samp||s.sampT!==s.t) resample();
  const trueErr=()=>{ const eb=poissonCdf(s.k-1,RO.lb*s.t), ed=1-poissonCdf(s.k-1,RO.ld*s.t); return (eb+ed)/2; };
  const loss=()=>s.t/RO.tauLoss+0.0005;
  const body=simShell(C,lv,`Exposure <b>${s.t} ms</b> · threshold <b>${s.k}</b> photons`);
  const draw=()=>{
    body.innerHTML='';
    const maxC=Math.max(20,Math.ceil(RO.lb*s.t*1.8));
    const hb=new Array(maxC+1).fill(0), hd=new Array(maxC+1).fill(0);
    s.samp.b.forEach(c=>hb[Math.min(c,maxC)]++); s.samp.d.forEach(c=>hd[Math.min(c,maxC)]++);
    const ymax=Math.max(...hb,...hd)*1.1;
    const bars=[]; for(let c=0;c<=maxC;c++){ bars.push({x0:c-.45,x1:c+.05,y:hd[c],color:'#8b9bb8',op:.7}); bars.push({x0:c-.05,x1:c+.45,y:hb[c],color:COL.Z,op:.8}); }
    const P=plotSVG({xr:[-1,maxC+1],yr:[0,ymax],xlabel:'photons detected in exposure',ylabel:'shots',bars,vlines:[{x:s.k-.5,color:COL.gold,label:'threshold',width:2}],legend:[{label:'atom in |1⟩ (bright)',color:COL.Z},{label:'atom in |0⟩ (dark)',color:'#8b9bb8'}],yfmt:v=>Math.round(v)});
    body.appendChild(P.svg);
  };
  draw();
  const card=sidePanel(Rt,lv);
  const mis=()=>{ const eb=s.samp.b.filter(c=>c<s.k).length/s.samp.b.length, ed=s.samp.d.filter(c=>c>=s.k).length/s.samp.d.length; return (eb+ed)/2; };
  const stats=H('div');
  const upd=()=>{ stats.innerHTML=`<div class="stat"><span>Misread (from 3000 shots)</span><span>${fmtP(mis(),2)}</span></div><div class="stat"><span>Atom loss from heating</span><span>${fmtP(loss(),2)}</span></div><div class="stat"><span>Target</span><span>misread ≤ 0.6%, loss ≤ 0.6%</span></div>`; };
  upd();
  card.appendChild(slider('Exposure time',1,40,1,s.t,v=>`${v} ms`,null,v=>{s.t=v; resample(); rerender();}));
  card.appendChild(slider('Photon threshold',0,40,1,s.k,v=>`${v}`,v=>{s.k=v;draw();upd();}));
  card.appendChild(stats);
  const a=H('div',{cls:'acts'});
  a.appendChild(btn('Lock settings',()=>{
    const e=trueErr(), l=loss();
    if(e<=0.006&&l<=0.006){ completeLesson(lv, e<=0.004?3:2); s.msg={t:`Locked: true misread ${fmtP(e,2)}, loss ${fmtP(l,2)}.`,c:'good'}; s.done=true; }
    else s.msg={t:`True misread ${fmtP(e,2)}, loss ${fmtP(l,2)}: ${e>0.006?'bright and dark distributions overlap too much':'imaging this long heats atoms out of the trap'}.`,c:'warn'};
    rerender();
  },'pri'));
  card.appendChild(a);
  msgBox(card,s.msg);
  if(s.done) doneBox(card,lv,'Readout calibrated.');
  else card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'Before imaging, atoms in |0⟩ are pushed out (or shelved dark), so |1⟩ fluoresces and |0⟩ shows only background. Photon counts are Poisson-random. Longer exposure separates the peaks but heats atoms out of the trap.'));
};

/* ================================================================
   Unit 3 — Rydberg interactions
   ================================================================ */
const C6_70=862690;   // 2π × MHz·µm⁶, Rb 70S (Bernien et al. 2017)
function pairDynamics(V, Om, Tend, n=300){
  // symmetric basis: gg, W=(gr+rg)/√2, rr.  H = Ω/√2(|gg⟩⟨W|+|W⟩⟨rr|+h.c.) + V|rr⟩⟨rr|   (rad/µs)
  const Vc=Math.min(V,1200), steps=Math.ceil(Tend/Math.min(0.002,0.25/Math.max(Vc,1))), h=Tend/steps, a=Om/Math.SQRT2;
  let re=[1,0,0], im=[0,0,0];
  const f=(r,i)=>{ const hr=[a*r[1], a*(r[0]+r[2]), a*r[1]+Vc*r[2]], hi=[a*i[1], a*(i[0]+i[2]), a*i[1]+Vc*i[2]]; return [hi, hr.map(x=>-x)]; };
  const out={t:[],rr:[],one:[]}, every=Math.max(1,Math.floor(steps/n));
  for(let k=0;k<=steps;k++){
    if(k%every===0){ out.t.push(k*h); out.rr.push(re[2]**2+im[2]**2); out.one.push(re[1]**2+im[1]**2); }
    const [k1r,k1i]=f(re,im);
    const [k2r,k2i]=f(re.map((x,j)=>x+h/2*k1r[j]), im.map((x,j)=>x+h/2*k1i[j]));
    const [k3r,k3i]=f(re.map((x,j)=>x+h/2*k2r[j]), im.map((x,j)=>x+h/2*k2i[j]));
    const [k4r,k4i]=f(re.map((x,j)=>x+h*k3r[j]), im.map((x,j)=>x+h*k3i[j]));
    re=re.map((x,j)=>x+h/6*(k1r[j]+2*k2r[j]+2*k3r[j]+k4r[j]));
    im=im.map((x,j)=>x+h/6*(k1i[j]+2*k2i[j]+2*k3i[j]+k4i[j]));
  }
  return out;
}
KINDS.blockade=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({r:12, picked:null}));
  const OmMHz=2, Om=TAU*OmMHz, Rb=Math.pow(C6_70/OmMHz,1/6);
  const body=simShell(C,lv,`Ω = 2π×${OmMHz} MHz · n = 70 (Rb)`);
  const draw=()=>{
    body.innerHTML='';
    const VMHz=C6_70/Math.pow(s.r,6), d=pairDynamics(TAU*VMHz,Om,1.5);
    const single=d.t.map(t=>Math.sin(Om*t/2)**2);
    const P=plotSVG({h:260,xr:[0,1.5],yr:[0,1.02],xlabel:'pulse time (µs)',ylabel:'population',
      series:[{xs:d.t,ys:single,color:COL.mut,dash:'5 4',width:1.5},{xs:d.t,ys:d.one,color:COL.gold},{xs:d.t,ys:d.rr,color:COL.bad}],
      legend:[{label:'isolated atom in |r⟩',color:COL.mut},{label:'pair: exactly one |r⟩',color:COL.gold},{label:'pair: both |r⟩',color:COL.bad}]});
    // geometry strip
    const g=S('svg',{viewBox:'-1 -1.3 18 2.6',class:'strip'}); atomDefs(g);
    S('circle',{cx:2,cy:0,r:Rb,fill:'#ffd25a14',stroke:'#ffd25a66','stroke-width':.06,'stroke-dasharray':'.3 .2'},g);
    drawAtom(g,2,0,.35,'r'); drawAtom(g,2+s.r,0,.35,s.r<Rb?'g':'r');
    S('line',{x1:2,y1:.75,x2:2+s.r,y2:.75,stroke:COL.mut,'stroke-width':.04},g);
    S('text',{x:2+s.r/2,y:1.2,fill:COL.txt,'font-size':.5,'text-anchor':'middle'},g).textContent=`r = ${s.r.toFixed(1)} µm   V/h = ${VMHz>=1?VMHz.toFixed(1):VMHz.toFixed(3)} MHz`;
    S('text',{x:2,y:-1.05,fill:COL.gold,'font-size':.45,'text-anchor':'middle'},g).textContent=`blockade radius ${Rb.toFixed(1)} µm`;
    body.append(g,P.svg);
    s.maxRR=Math.max(...d.rr);
  };
  draw();
  const card=sidePanel(Rt,lv);
  card.appendChild(slider('Atom separation r',2,16,0.1,s.r,v=>`${v.toFixed(1)} µm`,v=>{s.r=v;draw();},()=>rerender()));
  card.appendChild(H('h3',{},'Tasks'));
  const a=H('div',{cls:'acts'});
  a.appendChild(btn('Use this spacing for gates',()=>{ s.picked = s.maxRR<0.05 ? 'ok' : 'bad'; s.pickR=s.r; s.pickRR=s.maxRR; rerender(); }, s.picked==='ok'?'good':''));
  card.appendChild(a);
  if(s.picked) card.appendChild(H('div',{cls:'small',style:`color:${s.picked==='ok'?COL.ok:COL.bad}`},s.picked==='ok'?`✓ At ${s.pickR.toFixed(1)} µm the double excitation stays below ${fmtP(Math.max(s.pickRR,0.001))}. That's a blockade: one excitation is shared between the atoms.`:`✗ At ${s.pickR.toFixed(1)} µm both atoms still reach |r⟩ (up to ${fmtP(s.pickRR,0)}). Move them closer.`));
  const q1=s.picked==='ok' && miniQ(card,s,'sqrt','In the blockade regime, the pair oscillates to the "one excitation" state faster than a single atom. By what factor?',['1 (same)','√2','2'],1,'The shared state (|gr⟩+|rg⟩)/√2 couples to |gg⟩ with strength √2·Ω/2, so the collective Rabi frequency is √2 Ω. This is the signature measured by Gaëtan et al. and Urban et al. (2009).');
  const q2=q1 && miniQ(card,s,'rb',`With C₆ = 2π×862 690 MHz·µm⁶ (n=70) and Ω = 2π×2 MHz, the blockade radius R_b = (C₆/Ω)^{1/6} is about…`,['3 µm','9 µm','25 µm'],1,'(862 690 / 2)^{1/6} ≈ 8.7 µm. Atoms inside this radius can\'t be excited together.');
  if(q1&&q2){ completeLesson(lv,3-missesOf(s)); doneBox(card,lv,'Blockade understood.'); }
};

function rydModel(n, frac, E){
  const ns=n-3.13, s=ns/66.87;
  const tau=1/(1/(333*Math.pow(s,2.94))+1/(250*s*s));       // µs: radiative + blackbody
  const C6=C6_70*Math.pow(s,11), a=3.5, V=C6/Math.pow(a,6);   // MHz
  const OmMax=4.5*Math.pow(s,-1.5), f=frac*OmMax;              // MHz (laser-power limited ∝ n*^-3/2)
  const t=7.6/(TAU*f);                                         // µs, time-optimal CZ (ΩT ≈ 7.6)
  const dE=0.012*Math.pow(s,7)*E*E;                            // MHz Stark shift ∝ α E², α ∝ n*^7
  const e={
    decay:0.6*t/tau,
    blockade:0.5*Math.pow(f/V,2),
    doppler:0.25*Math.pow(TAU*0.03*t,2),
    stark:0.25*Math.pow(TAU*dE*t,2),
    scatter:0.002*frac*frac,
  };
  e.total=Object.values(e).reduce((x,y)=>x+y,0);
  return {e,tau,V,f,t,OmMax,Rb:Math.pow(C6/f,1/6),dE};
}
function rydBest(E){ let best={tot:1}; for(let n=40;n<=100;n++) for(let fr=0.1;fr<=1.0001;fr+=0.02){ const m=rydModel(n,fr,E); if(m.e.total<best.tot) best={tot:m.e.total,n,fr}; } return best; }
KINDS.rydlevel=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({n:70, fr:0.5, day:0, E:+(0.6+rnd()*1.9).toFixed(2), msg:null, extra:0}));
  const body=simShell(C,lv,`Day <b>${Math.min(s.day+1,3)}/3</b> · stray field ${s.E} V/m-equivalent`);
  const draw=()=>{
    body.innerHTML='';
    const m=rydModel(s.n,s.fr,s.E), keys=['decay','blockade','doppler','stark','scatter'], labels={decay:'Rydberg decay',blockade:'imperfect blockade',doppler:'Doppler / motion',stark:'stray-field Stark shift',scatter:'laser scattering'};
    const cols={decay:COL.X,blockade:COL.bad,doppler:COL.Z,stark:COL.er,scatter:COL.mut};
    const w=620,h=250, svg=S('svg',{viewBox:`0 0 ${w} ${h}`,class:'plot'});
    const maxv=Math.max(0.02,m.e.total*1.1), X=v=>180+Math.min(v,maxv)/maxv*400;
    keys.concat(['total']).forEach((k,i)=>{
      const y=18+i*36, v=m.e[k];
      S('text',{x:170,y:y+15,fill:k==='total'?COL.txt:COL.mut,'font-size':13,'text-anchor':'end','font-weight':k==='total'?700:400},svg).textContent=k==='total'?'total CZ error':labels[k];
      S('rect',{x:180,y,width:Math.max(1,X(v)-180),height:22,fill:k==='total'?(v<=0.01?COL.ok:COL.gold):cols[k],opacity:.85,rx:3},svg);
      S('text',{x:X(v)+6,y:y+15,fill:COL.txt,'font-size':12},svg).textContent=fmtP(v,v<0.001?3:2)+(v>maxv?' ▶':'');
    });
    body.appendChild(svg);
    body.appendChild(H('div',{cls:'kv'},`<span>Rydberg lifetime <b>${m.tau.toFixed(0)} µs</b></span><span>Ω = 2π×<b>${m.f.toFixed(2)}</b> MHz (max ${m.OmMax.toFixed(2)})</span><span>gate time <b>${(m.t*1000).toFixed(0)} ns</b></span><span>V at 3.5 µm = <b>${m.V>=10?m.V.toFixed(0):m.V.toFixed(2)}</b> MHz</span><span>R_b = <b>${m.Rb.toFixed(1)}</b> µm</span><span>Stark shift <b>${(m.dE*1000).toFixed(1)}</b> kHz</span>`));
  };
  draw();
  const card=sidePanel(Rt,lv);
  if(s.day<3){
    card.appendChild(slider('Principal quantum number n',40,100,1,s.n,v=>`n = ${v}`,v=>{s.n=v;draw();}));
    card.appendChild(slider('Laser power (fraction of max Ω)',0.1,1,0.02,s.fr,v=>`${Math.round(v*100)}%`,v=>{s.fr=v;draw();}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Calibrate & benchmark the gate',()=>{
      const m=rydModel(s.n,s.fr,s.E), b=rydBest(s.E), meas=Math.max(0,m.e.total*(1+0.08*gauss()));
      if(m.e.total<=b.tot*1.25+0.0003){
        s.msg={t:`Day ${s.day+1}: benchmark says ${fmtP(meas,2)} error per CZ. Near optimal (best ≈ ${fmtP(b.tot,2)} at n=${b.n}, ${Math.round(b.fr*100)}% power).`,c:'good'};
        s.day++; s.E=+(0.6+rnd()*1.9).toFixed(2);
        if(s.day>=3) completeLesson(lv,3-Math.min(2,s.extra));
      } else { s.extra++; s.msg={t:`Benchmark: ${fmtP(meas,2)} error per CZ. You can do noticeably better today. Look at the biggest bar.`,c:'warn'}; }
      rerender();
    },'pri'));
    card.appendChild(a);
    msgBox(card,s.msg);
    card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'Trade-offs: higher n gives stronger interactions (C₆ ∝ n¹¹) and longer lifetime, but weaker laser coupling (Ω ∝ n^−3/2) and huge polarizability (∝ n⁷). That makes it sensitive to stray electric fields, which drift from day to day. A faster gate (higher Ω) spends less time in the Rydberg state.'));
  } else { msgBox(card,s.msg); doneBox(card,lv,'Three days of good gates.'); }
};

/* ================================================================
   Unit 4 — Entangling gates
   ================================================================ */
const CZ_PULSES=[{a:0,th:Math.PI,l:'A: π'},{a:0,th:TAU,l:'A: 2π'},{a:1,th:Math.PI,l:'B: π'},{a:1,th:TAU,l:'B: 2π'}];
function czSim(seq){
  // two atoms, levels 0,1,r; only |1⟩↔|r⟩ is driven; perfect blockade (no |rr⟩)
  const res={};
  for(const inp of ['00','01','10','11']){
    let st={}; st[inp]=[1,0];
    for(const p of seq){
      const c=Math.cos(p.th/2), sn=Math.sin(p.th/2), nst={};
      const add=(k,v)=>{ const o=nst[k]||[0,0]; nst[k]=[o[0]+v[0],o[1]+v[1]]; };
      for(const k in st){
        const v=st[k], me=k[p.a], other=k[1-p.a];
        if(me==='0' || other==='r'){ add(k,v); continue; }    // not coupled, or blockaded
        const k1 = p.a===0 ? '1'+other : other+'1', kr = p.a===0 ? 'r'+other : other+'r';
        if(me==='1'){ add(k1,[c*v[0],c*v[1]]); add(kr,[sn*v[1],-sn*v[0]]); }      // −i·sin·v
        else { add(kr,[c*v[0],c*v[1]]); add(k1,[sn*v[1],-sn*v[0]]); }
      }
      st=nst;
    }
    const a=st[inp]||[0,0], leak=Object.entries(st).filter(([k])=>k.includes('r')).reduce((x,[,v])=>x+v[0]**2+v[1]**2,0);
    res[inp]={amp:Math.hypot(a[0],a[1]), ph:Math.atan2(a[1],a[0]), leak};
  }
  const cp=((res['11'].ph-res['10'].ph-res['01'].ph+res['00'].ph)%TAU+TAU)%TAU;
  const clean=Object.values(res).every(r=>r.leak<1e-6&&Math.abs(r.amp-1)<1e-6);
  return {res,cp,clean,ok:clean&&Math.abs(cp-Math.PI)<1e-3};
}
KINDS.czbuild=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({seq:[], tries:0, solved:false}));
  const R=czSim(s.seq);
  const body=simShell(C,lv,`Conditional phase: <b>${R.clean?(R.cp*180/Math.PI).toFixed(0)+'°':'—'}</b>`);
  const tl=H('div',{cls:'timeline'});
  ['A (control)','B (target)'].forEach((name,ai)=>{
    const rail=H('div',{cls:'rail'}); rail.appendChild(H('span',{cls:'rname'},name));
    s.seq.forEach(p=>rail.appendChild(H('span',{cls:'pulse'+(p.a===ai?' on':'')},p.a===ai?(p.th>4?'2π':'π'):'')));
    tl.appendChild(rail);
  });
  body.appendChild(tl);
  let tb='<table class="st tt"><tr><th>input</th><th>|amplitude|</th><th>phase</th><th>left in |r⟩</th></tr>';
  for(const k of ['00','01','10','11']){ const r=R.res[k]; tb+=`<tr><td>|${k}⟩</td><td>${r.amp.toFixed(3)}</td><td>${(r.ph*180/Math.PI).toFixed(0)}°</td><td style="color:${r.leak>1e-6?COL.bad:COL.mut}">${fmtP(r.leak,0)}</td></tr>`; }
  tb+='</table>';
  body.appendChild(H('div',{style:'padding:6px 12px'},tb+`<p class="small mut">Entangling (conditional) phase = φ₁₁ − φ₁₀ − φ₀₁ + φ₀₀. A CZ needs 180° with nothing left in the Rydberg state. Single-qubit phases (φ₀₁, φ₁₀) can be removed later with free virtual-Z gates.</p>`));
  const card=sidePanel(Rt,lv);
  card.appendChild(H('h3',{},'Add a pulse (resonant on |1⟩↔|r⟩)'));
  const pal=H('div',{cls:'tools'});
  CZ_PULSES.forEach(p=>pal.appendChild(btn(p.l,()=>{ if(s.solved) return; s.seq.push(p); rerender(); },'',s.seq.length>=5||s.solved)));
  card.appendChild(pal);
  const a=H('div',{cls:'acts'});
  a.appendChild(btn('Undo',()=>{s.seq.pop();rerender();},'',!s.seq.length||s.solved));
  a.appendChild(btn('Clear',()=>{s.seq=[];rerender();},'',!s.seq.length||s.solved));
  a.appendChild(btn('Check gate',()=>{ s.tries++; if(R.ok){ s.solved=true; completeLesson(lv, s.seq.length===3&&s.tries<=2?3:2); } else s.fail=true; rerender(); },'pri',s.solved||!s.seq.length));
  card.appendChild(a);
  if(s.solved) {
    card.appendChild(H('div',{cls:'msg good'},'<b>That\'s the Jaksch et al. (2000) CZ protocol.</b> π on A, 2π on B, π on A. If A was in |1⟩ it sits in |r⟩ and blockades B, so B\'s 2π pulse (which normally gives a −1 phase) can\'t happen. Modern gates (Levine 2019, time-optimal Jandura & Pupillo 2022, Evered 2023 at 99.5%) use one or two <i>global</i> pulses on both atoms with a phase jump, so no individual addressing is needed.'));
    doneBox(card,lv,'You built an entangling gate.');
  } else if(s.fail && !R.ok) card.appendChild(H('div',{cls:'msg warn'},R.clean?'No population is stuck in |r⟩, but the conditional phase isn\'t 180°. Think about which input should <i>miss</i> a phase thanks to the blockade.':'Some population is left in the Rydberg state. Every excitation must be brought back down.'));
};

const BELL_STATES=[
  {name:'Good CZ gate (Werner, p = 0.90)', E:{ZZ:0.9,XX:0.9,YY:-0.9}},
  {name:'Fully dephased: classical mixture of |00⟩ and |11⟩', E:{ZZ:1,XX:0,YY:0}},
  {name:'Noisy gate (Werner, p = 0.45)', E:{ZZ:0.45,XX:0.45,YY:-0.45}},
];
KINDS.bell=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({order:shuffle([0,1,2]), r:0, data:{}, budget:600, verdicts:[], msg:null}));
  const done=s.r>=3, st=BELL_STATES[s.order[Math.min(s.r,2)]];
  const est=b=>{ const d=s.data[b]; if(!d) return null; const E=(2*d.p-d.n)/d.n; return {E, err:Math.sqrt(Math.max(1-E*E,1/d.n)/d.n)}; };
  const F=()=>{ const z=est('ZZ'),x=est('XX'),y=est('YY'); if(!z||!x||!y) return null; return {F:(1+z.E+x.E-y.E)/4, err:Math.sqrt(z.err**2+x.err**2+y.err**2)/4}; };
  const body=simShell(C,lv, done?'All states judged':`State <b>${s.r+1}/3</b> · shots left <b>${s.budget}</b>`);
  const pts=[], cols={ZZ:COL.Z,XX:COL.X,YY:COL.er};
  ['ZZ','XX','YY'].forEach((b,i)=>{ const e=est(b); if(e) pts.push({x:i,y:e.E,err:e.err,color:cols[b],r:6}); });
  const f=F();
  const P=plotSVG({h:280,xr:[-0.6,3.6],yr:[-1.05,1.05],xticks:[0,1,2,3],xfmt:v=>['⟨ZZ⟩','⟨XX⟩','⟨YY⟩','F'][v]||'',ylabel:'correlator / fidelity',points:f?pts.concat([{x:3,y:f.F,err:f.err,color:COL.gold,r:6}]):pts,
    hlines:[{y:0.5,color:COL.gold,label:'F = ½ (entanglement boundary)'},{y:0,color:'#2a3a5e',dash:''}]});
  body.appendChild(P.svg);
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(H('div',{cls:'small'},'The circuit H·CZ·H prepared a Bell state |Φ⁺⟩ = (|00⟩+|11⟩)/√2, maybe badly. Measure parity correlations in different bases, then decide whether the atoms are <b>entangled</b>.'));
    card.appendChild(H('h3',{},'Measure 100 shots in basis'));
    const t=H('div',{cls:'tools'});
    ['ZZ','XX','YY'].forEach(b=>t.appendChild(btn(b,()=>{
      const p=(1+st.E[b])/2, d=s.data[b]||(s.data[b]={n:0,p:0}); d.n+=100; d.p+=binom(100,p); s.budget-=100; rerender();
    },'',s.budget<100,'Rotate both atoms into this basis, then image')));
    card.appendChild(t);
    let tbl='';
    ['ZZ','XX','YY'].forEach(b=>{ const e=est(b); tbl+=`<div class="stat"><span>⟨${b}⟩</span><span>${e?`${e.E.toFixed(2)} ± ${e.err.toFixed(2)} (${s.data[b].n} shots)`:'—'}</span></div>`; });
    tbl+=`<div class="stat"><span>Fidelity F = (1+⟨ZZ⟩+⟨XX⟩−⟨YY⟩)/4</span><span>${f?`<b>${f.F.toFixed(2)} ± ${f.err.toFixed(2)}</b>`:'needs all three'}</span></div>`;
    card.appendChild(H('div',{},tbl));
    card.appendChild(H('h3',{},'Verdict'));
    const v=H('div',{cls:'acts'});
    const judge=ent=>{ const trueF=(1+st.E.ZZ+st.E.XX-st.E.YY)/4, truth=trueF>0.5, ok=ent===truth;
      s.verdicts.push(ok); s.msg={t:`${ok?'✓ Correct.':'✗ Wrong.'} This was: <b>${st.name}</b>, true F = ${trueF.toFixed(3)}. ${st.E.XX===0?'Perfect ⟨ZZ⟩ alone proves nothing: classical correlations look identical in one basis. Coherence shows up only in ⟨XX⟩ and ⟨YY⟩.':''}`,c:ok?'good':'bad'};
      s.r++; s.data={}; s.budget=600; if(s.r>=3){ const k=s.verdicts.filter(Boolean).length; if(k>=2) completeLesson(lv,k); } rerender(); };
    v.appendChild(btn('Entangled',()=>judge(true),'pri'));
    v.appendChild(btn('Not entangled',()=>judge(false)));
    card.appendChild(v);
    msgBox(card,s.msg);
  } else {
    msgBox(card,s.msg);
    const k=s.verdicts.filter(Boolean).length;
    if(k>=2) doneBox(card,lv,`${k}/3 verdicts correct.`);
    else { card.appendChild(H('div',{cls:'msg bad'},`${k}/3 correct: try again with a better shot budget split.`)); const a=H('div',{cls:'acts'}); a.appendChild(btn('Retry',()=>resetLesson(lv),'pri')); card.appendChild(a); }
  }
};

/* ================================================================
   Unit 5 — Architecture
   ================================================================ */
const SCHED_PUZZLES=[
  {name:'Warm-up ring', n:6, gates:[[0,1],[2,3],[4,5],[1,2],[3,4],[5,0]], note:'Every atom joins at most one gate per Rydberg pulse. Independent gates share a pulse.'},
  {name:'GHZ ladder (8 atoms)', n:8, gates:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]], note:'Each gate needs the previous one finished. The depth is forced to 7.'},
  {name:'GHZ tree (same state!)', n:8, gates:[[0,4],[0,2],[4,6],[0,1],[2,3],[4,5],[6,7]], note:'The same 8-atom GHZ state from a tree-shaped circuit: entanglement doubles every layer. Circuit design matters as much as hardware.'},
];
function schedOptimal(P){ const last=new Array(P.n).fill(0); let d=0; for(const [a,b] of P.gates){ const L=Math.max(last[a],last[b])+1; last[a]=last[b]=L; d=Math.max(d,L); } return d; }
KINDS.schedule=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({p:0, layers:[], cur:[], solved:[], extra:0}));
  const done=s.p>=SCHED_PUZZLES.length, P=SCHED_PUZZLES[Math.min(s.p,SCHED_PUZZLES.length-1)];
  const executed=new Set(s.layers.flat()), inCur=new Set(s.cur);
  const busy=new Set(s.cur.flatMap(g=>P.gates[g]));
  const ready=g=>{ if(executed.has(g)||inCur.has(g)) return false; const [a,b]=P.gates[g]; if(busy.has(a)||busy.has(b)) return false;
    for(let h=0;h<g;h++){ if(executed.has(h)) continue; const [c,d]=P.gates[h]; if(c===a||c===b||d===a||d===b) return false; } return true; };
  const allDone=executed.size===P.gates.length, opt=schedOptimal(P);
  const body=simShell(C,lv, done?'All circuits scheduled':`<b>${P.name}</b> · Rydberg pulses used <b>${s.layers.length}</b> (optimal ${opt})`);
  // zone picture
  const W=Math.max(P.n,6), svg=S('svg',{viewBox:`-0.8 -0.6 ${W+0.6} 5.2`}); atomDefs(svg);
  S('rect',{x:-0.6,y:-0.4,width:W+0.2,height:1.9,fill:'#ffd25a0d',stroke:'#ffd25a55','stroke-width':.03,rx:.15},svg);
  S('text',{x:-0.45,y:-0.12,fill:COL.gold,'font-size':.22},svg).textContent='ENTANGLING ZONE: global Rydberg beam';
  S('rect',{x:-0.6,y:2.6,width:W+0.2,height:1.7,fill:'#38b6ff0a',stroke:'#38b6ff44','stroke-width':.03,rx:.15},svg);
  S('text',{x:-0.45,y:4.2,fill:COL.Z,'font-size':.22},svg).textContent='STORAGE ZONE: shielded from Rydberg light';
  const spot={};
  s.cur.forEach((g,i)=>{ const [a,b]=P.gates[g]; const x=(i+0.5)*W/Math.max(s.cur.length,1)-0.5; spot[a]=[x-0.25,0.65]; spot[b]=[x+0.25,0.65]; S('ellipse',{cx:x,cy:.65,rx:.55,ry:.38,fill:'none',stroke:'#ffd25a77','stroke-width':.03},svg); });
  for(let q=0;q<P.n;q++){ const [x,y]=spot[q]||[q*W/P.n+0.2,3.35]; drawAtom(svg,x,y,.17,spot[q]?'r':'g'); S('text',{x,y:y+.48,fill:COL.mut,'font-size':.22,'text-anchor':'middle'},svg).textContent='q'+q; }
  body.appendChild(svg);
  body.appendChild(H('div',{cls:'kv'},s.layers.map((L,i)=>`<span>pulse ${i+1}: ${L.map(g=>P.gates[g].join('–')).join(', ')}</span>`).join('')||'<span class="mut">No pulses fired yet.</span>'));
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(H('div',{cls:'small'},P.note));
    card.appendChild(H('h3',{},'Gates (circuit order, left → right)'));
    const t=H('div',{cls:'tools'});
    P.gates.forEach((gt,g)=>{ const ex=executed.has(g), cu=inCur.has(g);
      t.appendChild(btn(`${gt[0]}–${gt[1]}`,()=>{ if(cu){ s.cur=s.cur.filter(x=>x!==g); } else if(ready(g)) s.cur.push(g); rerender(); }, ex?'gdone':cu?'on':'', ex||(!cu&&!ready(g)), ex?'done':cu?'click to remove from this pulse':'')); });
    card.appendChild(t);
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Fire Rydberg pulse',()=>{ s.layers.push(s.cur); s.cur=[]; rerender(); },'pri',!s.cur.length));
    a.appendChild(btn('Restart circuit',()=>{ s.layers=[]; s.cur=[]; s.extra++; rerender(); }));
    card.appendChild(a);
    if(allDone){
      if(s.layers.length===opt){ card.appendChild(H('div',{cls:'msg good'},`Optimal: ${opt} pulse${opt>1?'s':''}.`)); const b=H('div',{cls:'acts'}); b.appendChild(btn('Next circuit →',()=>{ s.p++; s.layers=[]; s.cur=[]; if(s.p>=SCHED_PUZZLES.length) completeLesson(lv,3-Math.min(2,s.extra)); rerender(); },'pri')); card.appendChild(b); }
      else card.appendChild(H('div',{cls:'msg warn'},`Done in ${s.layers.length} pulses; ${opt} is possible. Each extra pulse is another round of transport and Rydberg errors. Restart and pack gates tighter.`));
    }
  } else doneBox(card,lv,'Circuits compiled.');
  card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'In zoned processors (Bluvstein et al. 2022, 2024), AOD tweezers carry atom pairs into the entangling zone and one global pulse performs every CZ there in parallel. Idle atoms wait in storage. Surface-code syndrome extraction needs just 4 such pulses per round, at any code size.'));
};

/* ================================================================
   Unit 6 — Analog quantum simulation (blockade-subspace Schrödinger solver)
   ================================================================ */
function rydSys(pos, rCut, Vfun){
  const n=pos.length, nb=new Array(n).fill(0), Vp=[];
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){ const d=Math.hypot(pos[i][0]-pos[j][0],pos[i][1]-pos[j][1]); if(d<=rCut){ nb[i]|=1<<j; nb[j]|=1<<i; } else Vp.push([i,j,Vfun(d)]); }
  const basis=[]; (function rec(i,m){ if(i===n){ basis.push(m); return; } rec(i+1,m); if(!(nb[i]&m)) rec(i+1,m|(1<<i)); })(0,0);
  const idx=new Map(basis.map((m,k)=>[m,k])), K=basis.length, pop=new Float64Array(K), dV=new Float64Array(K), nbrs=[];
  basis.forEach((m,k)=>{ pop[k]=popcnt(m); let v=0; for(const [i,j,w] of Vp) if((m>>i&1)&&(m>>j&1)) v+=w; dV[k]=v;
    const l=[]; for(let i=0;i<n;i++){ const k2=idx.get(m^(1<<i)); if(k2!==undefined) l.push(k2); } nbrs.push(Int32Array.from(l)); });
  return {n,pos,nb,basis,idx,K,pop,dV,nbrs,maxPop:Math.max(...pop)};
}
function evolveSys(sys, T, prof){
  const K=sys.K, dt=0.004, steps=Math.max(10,Math.ceil(T/dt)), h=T/steps;
  let re=new Float64Array(K), im=new Float64Array(K); re[sys.idx.get(0)]=1;
  const mk=()=>[new Float64Array(K),new Float64Array(K)];
  const k1=mk(),k2=mk(),k3=mk(),k4=mk(), tr=new Float64Array(K), ti=new Float64Array(K);
  const deriv=(t,r,i,out)=>{ const [Om,De]=prof(t/T), o2=Om/2;
    for(let k=0;k<K;k++){ const dg=-De*sys.pop[k]+sys.dV[k]; let sr=0,si=0; const nb=sys.nbrs[k]; for(let q=0;q<nb.length;q++){ sr+=r[nb[q]]; si+=i[nb[q]]; }
      out[0][k]=dg*i[k]+o2*si; out[1][k]=-(dg*r[k]+o2*sr); } };
  for(let st=0;st<steps;st++){
    const t=st*h;
    deriv(t,re,im,k1);
    for(let k=0;k<K;k++){ tr[k]=re[k]+h/2*k1[0][k]; ti[k]=im[k]+h/2*k1[1][k]; } deriv(t+h/2,tr,ti,k2);
    for(let k=0;k<K;k++){ tr[k]=re[k]+h/2*k2[0][k]; ti[k]=im[k]+h/2*k2[1][k]; } deriv(t+h/2,tr,ti,k3);
    for(let k=0;k<K;k++){ tr[k]=re[k]+h*k3[0][k]; ti[k]=im[k]+h*k3[1][k]; } deriv(t+h,tr,ti,k4);
    for(let k=0;k<K;k++){ re[k]+=h/6*(k1[0][k]+2*k2[0][k]+2*k3[0][k]+k4[0][k]); im[k]+=h/6*(k1[1][k]+2*k2[1][k]+2*k3[1][k]+k4[1][k]); }
  }
  const prob=new Float64Array(K); for(let k=0;k<K;k++) prob[k]=re[k]*re[k]+im[k]*im[k];
  return prob;
}
function sampleStates(sys, prob, n, keep){
  const out=[];
  for(let s=0;s<n;s++){
    let u=rnd(), k=0; for(;k<sys.K-1;k++){ u-=prob[k]; if(u<=0) break; }
    let m=sys.basis[k];
    if(rnd()>keep && m){ const bits=[]; for(let i=0;i<sys.n;i++) if(m>>i&1) bits.push(i); m&=~(1<<pick(bits)); }   // decay during the sweep
    out.push(m);
  }
  return out;
}
// Sweep profile: Ω ramps on/off in the first/last 10%; Δ goes from Δ0 to Δend.
// 'gap' shape spends extra time near the critical detuning Δc ≈ 1.1 Ω, where the energy gap is smallest.
function sweepProf(OmMHz, d0, dEnd, shape){
  const Om=TAU*OmMHz, M=400;
  let tbl=null;
  if(shape==='gap'){
    const dc=1.1*OmMHz, cum=[0];
    for(let i=1;i<=M;i++){ const D=d0+(dEnd-d0)*(i-.5)/M; cum.push(cum[i-1]+1+4*Math.exp(-(((D-dc)/(0.8*OmMHz))**2))); }
    tbl=cum.map(c=>c/cum[M]);
  }
  const vOf=u=>{ if(!tbl) return u; let i=1; while(i<M && tbl[i]<u) i++; const a=tbl[i-1], b=tbl[i]; return (i-1+(b>a?(u-a)/(b-a):0))/M; };
  return u=>{ const ramp=u<0.1?Math.sin(u/0.1*Math.PI/2)**2:u>0.9?Math.sin((1-u)/0.1*Math.PI/2)**2:1;
    return [Om*ramp, TAU*(d0+(dEnd-d0)*vOf(u))]; };
}
const SW={N:9, Om:1.5, d0:-5, tauEff:20, target:0.5};
let SW_SYS=null;
KINDS.sweep=(C,Rt,lv)=>{
  if(!SW_SYS) SW_SYS=rydSys(Array.from({length:SW.N},(_,i)=>[i,0]),1.01,d=>TAU*25/Math.pow(d,6));
  const sys=SW_SYS, z2=sys.idx.get(parseInt('101010101',2));
  const s=lstate(lv,()=>({T:0.6, dEnd:5, shape:'lin', runs:[], snaps:null, msg:null}));
  const last=s.runs[s.runs.length-1];
  const body=simShell(C,lv, last?`Last run: P(Z₂) = <b>${fmtP(last.p,0)}</b> · goal ≥ ${fmtP(SW.target,0)}`:'Design a sweep, then run it');
  const draw=()=>{
    body.innerHTML='';
    const prof=sweepProf(SW.Om,SW.d0,s.dEnd,s.shape), us=[]; for(let i=0;i<=100;i++) us.push(i/100);
    const P=plotSVG({h:200,xr:[0,s.T],yr:[-6,9],xlabel:'time (µs)',ylabel:'MHz',series:[{xs:us.map(u=>u*s.T),ys:us.map(u=>prof(u)[1]/TAU),color:COL.X},{xs:us.map(u=>u*s.T),ys:us.map(u=>prof(u)[0]/TAU),color:COL.Z}],
      hlines:[{y:0,color:'#2a3a5e',dash:''}],legend:[{label:'detuning Δ/2π',color:COL.X},{label:'Rabi Ω/2π',color:COL.Z}]});
    body.appendChild(P.svg);
    if(s.snaps){
      const g=S('svg',{viewBox:`-0.6 -0.6 ${SW.N+0.2} ${s.snaps.length*0.62+0.6}`,class:'snaps'}); atomDefs(g);
      s.snaps.forEach((m,r)=>{ for(let i=0;i<SW.N;i++) drawAtom(g,i,r*0.62,.17,(m>>(SW.N-1-i))&1?'r':'dim'); if(m===parseInt('101010101',2)) S('text',{x:SW.N-0.4,y:r*0.62+.1,fill:COL.ok,'font-size':.3},g).textContent='✓'; });
      body.appendChild(H('div',{cls:'small mut',style:'padding:2px 10px'},'Snapshots: each row is one experimental shot. Gold = Rydberg atom, ✓ = perfect Z₂ order.'));
      body.appendChild(g);
    }
  };
  draw();
  const card=sidePanel(Rt,lv);
  card.appendChild(slider('Sweep duration T',0.2,6,0.1,s.T,v=>`${v.toFixed(1)} µs`,v=>{s.T=v;draw();}));
  card.appendChild(slider('Final detuning Δ_end/2π',-3,8,0.5,s.dEnd,v=>`${v} MHz`,v=>{s.dEnd=v;draw();}));
  const sh=H('div',{cls:'opt'});
  sh.appendChild(btn('Linear sweep',()=>{s.shape='lin';rerender();},s.shape==='lin'?'on':''));
  sh.appendChild(btn('Slow near the critical point',()=>{s.shape='gap';rerender();},s.shape==='gap'?'on':'','','Spend extra time where Δ ≈ 1.1 Ω, the phase transition where the gap is smallest'));
  card.appendChild(sh);
  const a=H('div',{cls:'acts'});
  a.appendChild(btn('Run the quantum simulation',()=>{
    const prob=evolveSys(sys,s.T,sweepProf(SW.Om,SW.d0,s.dEnd,s.shape));
    let nbar=0; for(let k=0;k<sys.K;k++) nbar+=prob[k]*sys.pop[k];
    const keep=Math.exp(-s.T*(nbar/2)/SW.tauEff), p=prob[z2]*keep;
    s.snaps=sampleStates(sys,prob,10,keep);
    s.runs.push({T:s.T,dEnd:s.dEnd,shape:s.shape,p});
    if(p>=SW.target){ completeLesson(lv, s.runs.length<=3?3:s.runs.length<=6?2:1); s.msg={t:`P(Z₂) = ${fmtP(p,1)}. Adiabatic enough, and short enough that Rydberg decay doesn't win.`,c:'good'}; s.done=true; }
    else s.msg={t:`P(Z₂) = ${fmtP(p,1)}. ${s.dEnd<=2?'At negative or small final Δ, excitations aren\'t energetically favoured: there\'s no order to find.':s.T<0.8?'Too fast: the system can\'t follow the ground state through the minimum gap, so you see domain walls (defects).':s.T>3.5?'Long sweeps are adiabatic, but Rydberg decay and laser noise accumulate.':s.shape==='lin'?'A linear sweep spends most of its time far from the transition, where nothing interesting happens. Slow down only where the gap is small.':'Close. Fine-tune the duration and final detuning.'}`,c:'warn'};
    rerender();
  },'pri'));
  card.appendChild(a);
  msgBox(card,s.msg);
  if(s.runs.length) card.appendChild(H('div',{cls:'feed'},s.runs.slice().reverse().map(r=>`<div>T=${r.T.toFixed(1)} µs, Δ_end=${r.dEnd}, ${r.shape==='lin'?'linear':'gap-aware'} → ${fmtP(r.p,1)}</div>`).join('')));
  if(s.done) doneBox(card,lv,'Ordered a 9-atom chain.');
};

function genMisGraph(){
  for(let tries=0;tries<50;tries++){
    const cells=shuffle(Array.from({length:16},(_,i)=>i)).slice(0,11).sort((a,b)=>a-b);
    const pos=cells.map(c=>[c%4, Math.floor(c/4)]);
    const sys=rydSys(pos,1.5,d=>TAU*60/Math.pow(d,6));
    // keep connected-ish graphs with a unique-ish but non-trivial MIS
    const deg=pos.map((_,i)=>popcnt(sys.nb[i]));
    if(deg.some(d=>d===0)) continue;
    const nMis=sys.basis.filter(m=>popcnt(m)===sys.maxPop).length;
    if(nMis>=1 && nMis<=6) return sys;
  }
  return rydSys([[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2],[3,1],[3,2]],1.5,d=>TAU*60/Math.pow(d,6));
}
KINDS.mis=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({sys:genMisGraph(), sel:0, aDone:false, T:2, runs:[], snaps:null, msg:null, extra:0}));
  const sys=s.sys, n=sys.n, isMis=m=>sys.idx.has(m)&&popcnt(m)===sys.maxPop;
  const body=simShell(C,lv,`Graph: ${n} atoms · MIS size <b>${s.aDone?sys.maxPop:'?'}</b>`);
  const svg=S('svg',{viewBox:'-0.7 -0.7 4.4 4.4'}); atomDefs(svg);
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(sys.nb[i]>>j&1){ const both=(s.sel>>i&1)&&(s.sel>>j&1); S('line',{x1:sys.pos[i][0],y1:sys.pos[i][1],x2:sys.pos[j][0],y2:sys.pos[j][1],stroke:both?COL.bad:'#2a3a5e','stroke-width':both?.06:.03},svg); }
  for(let i=0;i<n;i++){ const [x,y]=sys.pos[i]; drawAtom(svg,x,y,.17,(s.sel>>i&1)?'r':'g');
    const hit=S('circle',{cx:x,cy:y,r:.35,fill:'transparent',style:'cursor:pointer'},svg); hit.addEventListener('click',()=>{ if(s.aDone) return; s.sel^=1<<i; s.msg=null; rerender(); }); }
  const row=H('div',{cls:'simrow'}); row.appendChild(svg);
  if(s.snaps){
    const g=H('div',{cls:'snapgrid'});
    s.snaps.forEach(m=>{ const sv=S('svg',{viewBox:'-0.6 -0.6 4.2 4.2'}); atomDefs(sv);
      for(let i=0;i<n;i++) drawAtom(sv,sys.pos[i][0],sys.pos[i][1],.2,(m>>i&1)?'r':'dim');
      const c=H('div',{cls:'snapc'+(isMis(m)?' ok':'')}); c.appendChild(sv); c.appendChild(H('div',{cls:'small'},`${popcnt(m)}${isMis(m)?' ✓ MIS':''}`)); g.appendChild(c); });
    row.appendChild(g);
  }
  body.appendChild(row);
  const card=sidePanel(Rt,lv);
  card.appendChild(H('h3',{},'Part A: be the classical solver'));
  if(!s.aDone){
    card.appendChild(H('div',{cls:'small'},'Lines connect atoms closer than the blockade radius: they can\'t both be excited. Click atoms to build the <b>largest</b> set with no connected pair: a maximum independent set (MIS).'));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn(`Check my set (${popcnt(s.sel)})`,()=>{
      if(!sys.idx.has(s.sel)) s.msg={t:'Two chosen atoms are connected (red line). They would blockade each other.',c:'warn'};
      else if(popcnt(s.sel)<sys.maxPop){ s.extra++; s.msg={t:`Independent ✓, but a larger set exists.`,c:'warn'}; }
      else { s.aDone=true; s.msg={t:`Maximum! ${sys.maxPop} atoms. Brute force needs 2^${n} = ${1<<n} checks; it grows exponentially with size.`,c:'good'}; }
      rerender(); },'pri'));
    a.appendChild(btn('Clear',()=>{s.sel=0;s.msg=null;rerender();}));
    card.appendChild(a);
  } else card.appendChild(H('div',{cls:'small',style:`color:${COL.ok}`},`✓ MIS size ${sys.maxPop}`));
  if(s.aDone){
    card.appendChild(H('h3',{},'Part B: let the atoms solve it'));
    card.appendChild(H('div',{cls:'small'},'Sweep Δ from negative to positive. Large Δ rewards every excitation, while the blockade forbids neighbours. So the ground state is the MIS (Pichler et al. 2018; Ebadi et al. 2022).'));
    card.appendChild(slider('Sweep duration T',0.3,6,0.1,s.T,v=>`${v.toFixed(1)} µs`,v=>{s.T=v;}));
    const b=H('div',{cls:'acts'});
    b.appendChild(btn('Run sweep (12 shots)',()=>{
      const prob=evolveSys(sys,s.T,sweepProf(1.2,-4,6,'lin'));
      let pm=0, nbar=0; for(let k=0;k<sys.K;k++){ nbar+=prob[k]*sys.pop[k]; if(sys.pop[k]===sys.maxPop) pm+=prob[k]; }
      const keep=Math.exp(-s.T*(nbar/2)/40); pm*=keep;
      s.snaps=sampleStates(sys,prob,12,keep); s.runs.push({T:s.T,p:pm});
      if(pm>=0.5){ s.done=true; completeLesson(lv,3-Math.min(2,s.extra+(s.runs.length>4?1:0))); s.msg={t:`P(MIS) = ${fmtP(pm,1)}. ${s.snaps.filter(isMis).length}/12 snapshots are maximum independent sets.`,c:'good'}; }
      else s.msg={t:`P(MIS) = ${fmtP(pm,1)}: ${s.T<1?'too fast, so diabatic defects leave holes in the set':'decay is creeping in, or there is still a small gap'}. Goal ≥ 50%.`,c:'warn'};
      rerender(); },'pri'));
    card.appendChild(b);
  }
  msgBox(card,s.msg);
  if(s.runs.length) card.appendChild(H('div',{cls:'feed'},s.runs.slice().reverse().map(r=>`<div>T=${r.T.toFixed(1)} µs → P(MIS) ${fmtP(r.p,1)}</div>`).join('')));
  if(s.done) doneBox(card,lv,'Quantum optimization run.');
  card.appendChild(btn('New random graph',()=>resetLesson(lv),'small'));
};

/* ================================================================
   Unit 11 — Logical computation: error propagation through a transversal CNOT
   ================================================================ */
KINDS.propagate=(C,Rt,lv)=>{
  const gen=()=>{ const k=1+Math.floor(rnd()*2), errs=[]; for(let i=0;i<k;i++) errs.push({p:Math.floor(rnd()*2), q:Math.floor(rnd()*9), P:pick(['X','Z','Y'])}); return errs; };
  const s=lstate(lv,()=>({r:0, errs:gen(), pred:[new Array(9).fill(''),new Array(9).fill('')], checked:null, miss:0}));
  const truth=()=>{ const x=[new Uint8Array(9),new Uint8Array(9)], z=[new Uint8Array(9),new Uint8Array(9)];
    for(const e of s.errs){ if(e.P!=='Z') x[e.p][e.q]^=1; if(e.P!=='X') z[e.p][e.q]^=1; }
    for(let q=0;q<9;q++){ x[1][q]^=x[0][q]; z[0][q]^=z[1][q]; }
    return [0,1].map(p=>Array.from({length:9},(_,q)=>pauliOf(x[p][q],z[p][q]))); };
  const done=s.r>=4;
  const body=simShell(C,lv, done?'All rounds complete':`Round <b>${s.r+1}/4</b>: predict the errors after the transversal CNOT`);
  const svg=S('svg',{viewBox:'-0.8 -1.2 8.6 4.4'}); atomDefs(svg);
  const T=s.checked?truth():null;
  ['control (block A)','target (block B)'].forEach((name,p)=>{
    const ox=p*4.6;
    S('text',{x:ox+1,y:-0.75,fill:p?COL.Z:COL.X,'font-size':.28,'text-anchor':'middle'},svg).textContent=name;
    for(let q=0;q<9;q++){ const x=ox+q%3, y=Math.floor(q/3);
      drawAtom(svg,x,y,.16,'g');
      const before=s.errs.filter(e=>e.p===p&&e.q===q).map(e=>e.P).join('');
      if(before) S('text',{x:x-.32,y:y-.2,fill:COL.bad,'font-size':.24,'font-weight':700},svg).textContent=before;
      const pr=s.pred[p][q]; if(pr) S('text',{x:x+.18,y:y-.2,fill:COL.gold,'font-size':.24,'font-weight':700},svg).textContent=pr;
      if(T && T[p][q]!==pr) S('circle',{cx:x,cy:y,r:.3,fill:'none',stroke:COL.bad,'stroke-width':.04},svg);
      if(T && T[p][q]) S('text',{x:x+.18,y:y+.42,fill:COL.ok,'font-size':.22,'font-weight':700},svg).textContent=T[p][q];
      const hit=S('circle',{cx:x,cy:y,r:.4,fill:'transparent',style:'cursor:pointer'},svg);
      hit.addEventListener('click',()=>{ if(s.checked) return; const cyc=['','X','Z','Y']; s.pred[p][q]=cyc[(cyc.indexOf(s.pred[p][q])+1)%4]; rerender(); });
    }
  });
  for(let q=0;q<9;q++){ const y=Math.floor(q/3), x=q%3; S('line',{x1:x+.25,y1:y+.02,x2:x+4.35,y2:y+.02,stroke:'#ffffff14','stroke-width':.025},svg); }
  body.appendChild(svg);
  body.appendChild(H('div',{cls:'small mut',style:'padding:0 12px 8px'},'<span style="color:#ff4d5e">Red</span>: errors before the gate. <span style="color:#ffd25a">Gold</span>: your prediction (click atoms to cycle I→X→Z→Y). <span style="color:#4dffa0">Green</span>: the truth after checking. Faint lines: atom i of A is paired with atom i of B (CNOT A→B).'));
  const card=sidePanel(Rt,lv);
  if(!done){
    const a=H('div',{cls:'acts'});
    if(!s.checked) a.appendChild(btn('Apply transversal CNOT & check',()=>{ const t=truth(); const ok=[0,1].every(p=>t[p].every((v,q)=>v===s.pred[p][q])); s.checked={ok}; if(!ok) s.miss++; rerender(); },'pri'));
    else a.appendChild(btn(s.checked.ok?'Next round →':'Try a new pattern',()=>{ if(s.checked.ok) s.r++; s.errs=gen(); s.pred=[new Array(9).fill(''),new Array(9).fill('')]; s.checked=null; if(s.r>=4) completeLesson(lv,3-Math.min(2,s.miss)); rerender(); },'pri'));
    card.appendChild(a);
    if(s.checked) card.appendChild(H('div',{cls:'msg '+(s.checked.ok?'good':'bad')},s.checked.ok?'✓ Exactly right.':'✗ Not quite. Rule: X on the control copies forward to the target. Z on the target copies backward to the control. Y does both, since Y = XZ.'));
    card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'A transversal CNOT pairs atom i of block A with atom i of block B, which neutral-atom processors do by moving whole blocks on top of each other. Errors never spread <i>within</i> a block, so they stay correctable. But they become <b>correlated between blocks</b>, which a correlated decoder exploits (Bluvstein et al. 2024; Cain et al. 2024).'));
  } else doneBox(card,lv,'You can track errors through logical gates.');
};

/* ================================================================
   Experimental-methods lessons (Saffman RMP 2010; Lukin 2001, 2003; Browaeys & Lahaye 2020;
   Urban/Gaëtan 2009; Wilk/Isenhower 2010; Semeghini 2021)
   ================================================================ */

/* ---------- Two-photon Rydberg excitation ---------- */
// Rb: 5S → 6P3/2 (420 nm) → nS (1013 nm). All frequencies in MHz (cyclic), times in µs.
const TP={Gp:1.42, tauR:150, setups:[
  {name:'Standard setup', o1:250, o2:70, minOm:0},
  {name:'Weak infrared laser', o1:250, o2:25, minOm:0},
  {name:'Fast gates needed: Ω_eff ≥ 2.5 MHz', o1:250, o2:50, minOm:2.5},
]};
function tpModel(D,f1,f2,dc,su){
  const O1=f1*su.o1, O2=f2*su.o2, Om=O1*O2/(2*D), t=1/(2*Om), dLS=(O1*O1-O2*O2)/(4*D), dr=dc-dLS;
  const e={scatter:TAU*TP.Gp*t*(O1*O1+O2*O2)/(8*D*D), decay:0.5*t/TP.tauR, detuning:dr*dr/(Om*Om+dr*dr), noise:0.25*Math.pow(TAU*0.04*t,2), lsnoise:Math.pow(0.04*dLS/Om,2)};
  e.total=e.scatter+e.decay+e.detuning+e.noise+e.lsnoise;
  return {O1,O2,Om,t,dLS,e};
}
function tpBest(su){
  let b={tot:1};
  for(let D=300;D<=8000;D*=1.06) for(let f1=0.1;f1<=1.001;f1+=0.05) for(let f2=0.1;f2<=1.001;f2+=0.05){
    const m=tpModel(D,f1,f2,0,su); m.e.total-=m.e.detuning; if(m.Om<su.minOm) continue;
    if(m.e.total<b.tot) b={tot:m.e.total,D,f1,f2};
  }
  return b;
}
KINDS.twophoton=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({k:0, D:1000, f1:0.5, f2:0.5, dc:0, msg:null, extra:0}));
  const done=s.k>=TP.setups.length, su=TP.setups[Math.min(s.k,TP.setups.length-1)];
  const body=simShell(C,lv, done?'All three setups calibrated':`Setup <b>${s.k+1}/3</b>: ${su.name}`);
  const draw=()=>{
    body.innerHTML='';
    const m=tpModel(s.D,s.f1,s.f2,s.dc,su);
    // level diagram
    const g=S('svg',{viewBox:'0 0 620 170',class:'plot'});
    const lvl=(y,l)=>{ S('line',{x1:40,x2:200,y1:y,y2:y,stroke:COL.txt,'stroke-width':2},g); S('text',{x:208,y:y+4,fill:COL.mut,'font-size':12},g).textContent=l; };
    const yInt=70-clamp(Math.log10(s.D/300)*18,0,30);
    lvl(150,'5S₁/₂ |1⟩'); lvl(20,`|r⟩ = 70S`); S('line',{x1:40,x2:200,y1:70,y2:70,stroke:COL.mut,'stroke-dasharray':'4 3'},g); S('text',{x:208,y:74,fill:COL.mut,'font-size':12},g).textContent='6P₃/₂ (lossy, Γ = 2π×1.4 MHz)';
    S('line',{x1:40,x2:200,y1:yInt,y2:yInt,stroke:COL.gold,'stroke-dasharray':'2 2'},g);
    S('line',{x1:100,y1:150,x2:100,y2:yInt,stroke:'#6f7cff','stroke-width':4},g); S('text',{x:60,y:115,fill:'#8f9bff','font-size':12},g).textContent='420 nm';
    S('line',{x1:140,y1:yInt,x2:140,y2:20,stroke:'#ff5a5a','stroke-width':4},g); S('text',{x:146,y:45,fill:'#ff8080','font-size':12},g).textContent='1013 nm';
    S('text',{x:30,y:(70+yInt)/2+4,fill:COL.gold,'font-size':12,'text-anchor':'end'},g).textContent='Δ';
    // spectrum of the two-photon line, centred on the light-shifted resonance
    const xs=[]; for(let x=-12;x<=12;x+=0.05) xs.push(x);
    const ys=xs.map(x=>{ const d=x-m.dLS, gg=Math.hypot(m.Om,d); return m.Om*m.Om/(gg*gg)*Math.sin(Math.PI/2*gg/m.Om)**2; });
    const P=plotSVG({h:220,xr:[-12,12],yr:[0,1.05],xlabel:'two-photon laser detuning (MHz)',ylabel:'P(|r⟩) after π-pulse',series:[{xs,ys,color:COL.Z}],vlines:[{x:m.dLS,color:COL.mut,dash:'4 3',label:'light-shifted resonance'},{x:s.dc,color:COL.gold,label:'your laser'}]});
    const row=H('div',{cls:'simrow'}); row.append(g); body.append(row, P.svg);
    const keys=[['scatter','6P scattering'],['decay','Rydberg decay'],['detuning','residual detuning'],['lsnoise','light-shift noise'],['noise','laser phase noise']];
    body.appendChild(H('div',{cls:'kv'},`<span>Ω₄₂₀ = 2π×<b>${m.O1.toFixed(0)}</b> MHz</span><span>Ω₁₀₁₃ = 2π×<b>${m.O2.toFixed(0)}</b> MHz</span><span>Ω_eff = 2π×<b style="color:${m.Om<su.minOm?COL.bad:COL.txt}">${m.Om.toFixed(2)}</b> MHz</span><span>π-pulse <b>${(m.t*1000).toFixed(0)}</b> ns</span><span>light shift <b>${m.dLS.toFixed(2)}</b> MHz</span>`+keys.map(([k,l])=>`<span>${l}: <b>${fmtP(m.e[k],2)}</b></span>`).join('')+`<span>π-pulse error: <b style="color:${m.e.total<0.01?COL.ok:COL.gold}">${fmtP(m.e.total,2)}</b></span>`));
  };
  draw();
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(slider('Intermediate detuning Δ/2π',300,8000,10,s.D,v=>`${(v/1000).toFixed(2)} GHz`,v=>{s.D=v;draw();}));
    card.appendChild(slider(`420 nm power (max Ω = 2π×${su.o1} MHz)`,0.1,1,0.01,s.f1,v=>`${Math.round(v*100)}%`,v=>{s.f1=v;draw();}));
    card.appendChild(slider(`1013 nm power (max Ω = 2π×${su.o2} MHz)`,0.1,1,0.01,s.f2,v=>`${Math.round(v*100)}%`,v=>{s.f2=v;draw();}));
    card.appendChild(slider('Laser frequency offset',-12,12,0.05,s.dc,v=>`${v.toFixed(2)} MHz`,v=>{s.dc=v;draw();}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Run Rabi calibration',()=>{
      const m=tpModel(s.D,s.f1,s.f2,s.dc,su), b=tpBest(su);
      if(m.Om<su.minOm){ s.extra++; s.msg={t:`Ω_eff is only ${m.Om.toFixed(2)} MHz, but this setup needs ≥ ${su.minOm} MHz.`,c:'warn'}; }
      else if(m.e.total<=b.tot*1.3+0.0005){ s.msg={t:`π-pulse error ${fmtP(m.e.total,2)}: near the optimum (≈ ${fmtP(b.tot,2)} at Δ ≈ ${(b.D/1000).toFixed(1)} GHz).`,c:'good'}; s.k++; if(s.k>=TP.setups.length) completeLesson(lv,3-Math.min(2,s.extra)); }
      else { s.extra++; s.msg={t:`π-pulse error ${fmtP(m.e.total,2)}. ${m.e.detuning>0.003?'You are off the light-shifted resonance: the AC Stark shifts from both beams move the line.':m.e.lsnoise>Math.max(m.e.scatter,m.e.decay)?'The beams are unbalanced: the big light shift jitters with laser intensity noise. Bring the two Rabi frequencies closer together.':m.e.scatter>m.e.decay*2?'Scattering off 6P dominates. Detune further from the intermediate state.':'Pulses are too slow: decay and phase noise pile up. More power, or less detuning.'}`,c:'warn'}; }
      rerender();
    },'pri'));
    card.appendChild(a);
    msgBox(card,s.msg);
    card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'Ω_eff = Ω₄₂₀Ω₁₀₁₃/(2Δ). Population leaking into 6P scatters at ∝ Ω²/Δ², so a large Δ helps but costs Rabi frequency. Each beam light-shifts its levels by Ω²/4Δ, which moves the two-photon resonance; when the beams are unbalanced, laser intensity noise (a few %) makes that shift jitter from shot to shot. Balancing the two beams (Ω₄₂₀ ≈ Ω₁₀₁₃) cancels the shift and its noise.'));
  } else { msgBox(card,s.msg); doneBox(card,lv,'Rydberg lasers calibrated.'); }
};

/* ---------- Superatoms (collective blockade) ---------- */
KINDS.superatom=(C,Rt,lv)=>{
  const fresh=()=>({N:1+Math.floor(rnd()*7), pts:[], budget:12, t:0.5, guess:null});
  const s=lstate(lv,()=>({...fresh(), tries:0, solved:false}));
  const Om=TAU*1.0, pOf=(N,t)=>0.5-0.5*Math.cos(Math.sqrt(N)*Om*t)*Math.exp(-t/3);
  const body=simShell(C,lv,`Measurements left: <b>${s.budget}</b>`);
  const draw=()=>{
    body.innerHTML='';
    const xs=[]; for(let t=0;t<=3;t+=0.01) xs.push(t);
    const series=s.guess!==null?[1,2,3,4,5,6,7].map(N=>({xs,ys:xs.map(t=>pOf(N,t)),color:N===s.N?COL.ok:'#3a4f7c',width:N===s.N?2.5:1})):[];
    const P=plotSVG({h:280,xr:[0,3],yr:[0,1.05],xlabel:'pulse time (µs)',ylabel:'P(ensemble holds one excitation)',series,
      vlines:[{x:s.t,color:'#ffffff55',dash:'3 3',label:'probe'}],
      points:s.pts.map(p=>({x:p.t,y:p.k/p.n,err:Math.sqrt(Math.max(p.k*(p.n-p.k),1)/p.n)/p.n,color:COL.gold}))});
    // cloud picture
    const g=S('svg',{viewBox:'-2.2 -1.25 4.4 2.5',class:'strip'}); atomDefs(g);
    S('circle',{cx:0,cy:0,r:1.15,fill:'#ffd25a10',stroke:'#ffd25a66','stroke-width':.02,'stroke-dasharray':'.08 .05'},g);
    const nShow=s.guess!==null?s.N:7;
    for(let i=0;i<nShow;i++){ const a=i/nShow*TAU+0.3, r=i===0&&nShow>1?0:0.65; drawAtom(g,r?Math.cos(a)*r:0,r?Math.sin(a)*r:0,.11,s.guess!==null?'g':'dim'); }
    S('text',{x:0,y:1.2,fill:COL.mut,'font-size':.13,'text-anchor':'middle'},g).textContent=s.guess!==null?`N = ${s.N} atoms in one blockade sphere`:'how many atoms are inside?';
    body.append(g,P.svg);
  };
  draw();
  const card=sidePanel(Rt,lv);
  if(!s.solved){
    card.appendChild(slider('Pulse time',0,3,0.01,s.t,v=>`${v.toFixed(2)} µs`,v=>{s.t=v;draw();}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Measure (100 shots)',()=>{ s.pts.push({t:s.t,k:binom(100,pOf(s.N,s.t)),n:100}); s.budget--; rerender(); },'pri',s.budget<=0||s.guess!==null));
    card.appendChild(a);
    card.appendChild(H('h3',{},'How many atoms share the excitation?'));
    const o=H('div',{cls:'opt'});
    [1,2,3,4,5,6,7].forEach(N=>o.appendChild(btn(`N = ${N}`,()=>{ s.guess=N; s.tries++; if(N===s.N){ s.solved=true; completeLesson(lv, s.tries===1&&s.budget>=4?3:s.tries<=2?2:1); } rerender(); },'',s.guess!==null)));
    card.appendChild(o);
    if(s.guess!==null && !s.solved){ card.appendChild(H('div',{cls:'msg bad'},`It was N = ${s.N}: oscillation frequency √${s.N}·Ω = ${Math.sqrt(s.N).toFixed(2)}·Ω.`)); const b=H('div',{cls:'acts'}); b.appendChild(btn('New ensemble',()=>{ Object.assign(s,fresh()); rerender(); },'pri')); card.appendChild(b); }
    card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'Single-atom Rabi frequency Ω = 2π×1 MHz. The data are shot-noise limited and slowly damped. Where should you probe to tell √5 from √6?'));
  } else {
    card.appendChild(H('div',{cls:'msg good'},`✓ N = ${s.N}. The ensemble oscillated at √${s.N}·Ω, and never held more than one excitation: a "superatom".`));
    const q=miniQ(card,s,'use','Lukin et al. (2001) proposed using blockaded ensembles for…',['Making atoms heavier','Collective qubits and deterministic single-photon sources','Cooling atoms below 1 nK','Replacing the tweezer laser'],1,'A blockaded ensemble holds at most one excitation, so it acts as a two-level "superatom". Mapping it onto light emits exactly one photon.');
    if(q) doneBox(card,lv,'Collective blockade measured.');
  }
};

/* ---------- Detecting Rydberg atoms by loss (SPAM) ---------- */
KINDS.lossdet=(C,Rt,lv)=>{
  const fresh=()=>{
    const eps=0.01+rnd()*0.03, epsP=0.05+rnd()*0.10, peak=0.93+rnd()*0.05;
    const ts=Array.from({length:13},(_,i)=>i*0.1);
    const truth=t=>peak*Math.sin(TAU*1.25*t/2)**2*Math.exp(-t/4)+ (1-Math.exp(-t/4))*0.5*peak*0;
    const raw=ts.map(t=>{ const p=eps+(1-eps-epsP)*truth(t); return {t,k:binom(200,p),n:200}; });
    const rawPi={k:binom(1000,eps+(1-eps-epsP)*peak),n:1000};
    return {eps,epsP,peak,ts,raw,rawPi,c0:{k:0,n:0},c1:{k:0,n:0},budget:600,res:null};
  };
  const s=lstate(lv,()=>({...fresh(), tries:0}));
  const eHat=s.c0.n?s.c0.k/s.c0.n:null, epHat=s.c1.n?1-s.c1.k/s.c1.n:null;
  const corr=p=>(eHat!==null&&epHat!==null)?(p-eHat)/(1-eHat-epHat):null;
  const piRaw=s.rawPi.k/s.rawPi.n, piCorr=corr(piRaw);
  const body=simShell(C,lv,`Calibration shots left: <b>${s.budget}</b>`);
  const pts=s.raw.map(r=>({x:r.t,y:r.k/r.n,err:Math.sqrt(r.k*(r.n-r.k)/r.n)/r.n,color:COL.mut}));
  if(piCorr!==null) s.raw.forEach(r=>pts.push({x:r.t,y:clamp(corr(r.k/r.n),-0.05,1.1),color:COL.gold}));
  const P=plotSVG({h:280,xr:[-0.05,1.25],yr:[-0.05,1.1],xlabel:'Rydberg pulse time (µs)',ylabel:'probability',points:pts,
    hlines:s.res?[{y:s.peak,color:COL.ok,label:`true π transfer ${fmtP(s.peak,1)}`}]:[],
    legend:[{label:'raw: atom missing',color:COL.mut},{label:'SPAM-corrected',color:COL.gold}]});
  body.appendChild(P.svg);
  body.appendChild(H('div',{cls:'kv'},`<span>Raw loss at π-pulse (1000 shots): <b>${fmtP(piRaw,1)}</b></span><span>ε̂ = <b>${eHat===null?'?':fmtP(eHat,1)}</b> (${s.c0.n} shots)</span><span>ε̂′ = <b>${epHat===null?'?':fmtP(epHat,1)}</b> (${s.c1.n} shots)</span><span>Corrected π transfer: <b>${piCorr===null?'needs both calibrations':fmtP(piCorr,1)}</b></span>`));
  const card=sidePanel(Rt,lv);
  card.appendChild(H('div',{cls:'small'},'Rydberg atoms are detected by <b>loss</b>: the tweezer is switched off during the pulse, and Rydberg atoms are expelled (anti-trapped or photo-ionized) before it turns back on. Two errors bias the raw data:<br>• <b>ε</b>: a ground-state atom is lost anyway (collisions, imperfect recapture) and looks like a Rydberg atom.<br>• <b>ε′</b>: a Rydberg atom decays back to the ground state and gets recaptured, so it looks like a ground atom.<br>P<sub>raw</sub> = ε + (1 − ε − ε′)·P<sub>true</sub>.'));
  if(!s.res){
    card.appendChild(H('h3',{},'Spend calibration shots (100 per click)'));
    const t=H('div',{cls:'tools'});
    t.appendChild(btn('ε: run with Rydberg lasers off',()=>{ s.c0.n+=100; s.c0.k+=binom(100,s.eps); s.budget-=100; rerender(); },'',s.budget<100));
    t.appendChild(btn('ε′: adiabatic passage to |r⟩ (≈100% transfer)',()=>{ s.c1.n+=100; s.c1.k+=binom(100,1-s.epsP); s.budget-=100; rerender(); },'',s.budget<100));
    card.appendChild(t);
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Report corrected π-pulse transfer',()=>{ const e=Math.abs(piCorr-s.peak); s.res={e}; s.tries++; if(e<=0.04) completeLesson(lv, e<=0.02&&s.tries===1?3:2); rerender(); },'pri',piCorr===null));
    card.appendChild(a);
  } else {
    const ok=s.res.e<=0.04;
    card.appendChild(H('div',{cls:'msg '+(ok?'good':'bad')},`True transfer ${fmtP(s.peak,1)} (ε = ${fmtP(s.eps,1)}, ε′ = ${fmtP(s.epsP,1)}). You were off by ${fmtP(s.res.e,1)}. ${ok?'':'ε′ multiplies everything. It usually deserves more shots than ε.'}`));
    if(ok) doneBox(card,lv,'SPAM corrected.');
    else { const b=H('div',{cls:'acts'}); b.appendChild(btn('New dataset',()=>{ Object.assign(s,fresh()); rerender(); },'pri')); card.appendChild(b); }
  }
};

/* ---------- Gate error scaling (Jaksch 2000; Saffman RMP 2010) ---------- */
const GE={sc:[{B:20,tau:100},{B:100,tau:100},{B:100,tau:400}]};
const geErr=(Om,B,tau)=>7*Math.PI/(4*Om*tau)+Om*Om/(8*B*B);       // Ω, B in rad/µs; τ in µs
const geOpt=(B,tau)=>{ const Om=Math.cbrt(7*Math.PI*B*B/tau); return {Om, E:geErr(Om,B,tau)}; };
KINDS.gateerr=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({k:0, lx:0, found:[], extra:0, msg:null}));
  const done=s.k>=GE.sc.length, sc=GE.sc[Math.min(s.k,GE.sc.length-1)], B=TAU*sc.B;
  const body=simShell(C,lv, done?'Scaling law found':`Scenario <b>${s.k+1}/3</b>: B = 2π×${sc.B} MHz, τ = ${sc.tau} µs`);
  const draw=()=>{
    body.innerHTML='';
    const xs=[]; for(let x=-1;x<=1.6;x+=0.01) xs.push(x);
    const OmOf=x=>TAU*Math.pow(10,x);
    const series=[
      {xs,ys:xs.map(x=>Math.log10(7*Math.PI/(4*OmOf(x)*sc.tau))),color:COL.X,dash:'5 4',width:1.5},
      {xs,ys:xs.map(x=>Math.log10(OmOf(x)**2/(8*B*B))),color:COL.Z,dash:'5 4',width:1.5},
      {xs,ys:xs.map(x=>Math.log10(geErr(OmOf(x),B,sc.tau))),color:COL.gold,width:2.5}];
    const cur=geErr(OmOf(s.lx),B,sc.tau);
    const P=plotSVG({h:300,xr:[-1,1.6],yr:[-4.5,0],xticks:[-1,-0.5,0,0.5,1,1.5],xfmt:v=>(+Math.pow(10,v).toPrecision(2))+'',yticks:[-4,-3,-2,-1,0],yfmt:v=>`10${['⁻⁴','⁻³','⁻²','⁻¹','⁰'][v+4]}`,
      xlabel:'Rabi frequency Ω/2π (MHz, log scale)',ylabel:'intrinsic CZ error',series,points:[{x:s.lx,y:Math.log10(cur),color:'#fff',r:5}],
      legend:[{label:'Rydberg decay 7π/(4Ωτ)',color:COL.X},{label:'blockade leakage Ω²/(8B²)',color:COL.Z},{label:'total',color:COL.gold}]});
    body.appendChild(P.svg);
    body.appendChild(H('div',{cls:'kv'},`<span>Ω = 2π×<b>${Math.pow(10,s.lx).toFixed(2)}</b> MHz</span><span>error <b>${fmtP(cur,3)}</b></span>`+s.found.map((f,i)=>`<span>scenario ${i+1}: Bτ = ${(GE.sc[i].B*GE.sc[i].tau).toFixed(0)} MHz·µs → E_min ≈ <b>${fmtP(f,3)}</b></span>`).join('')));
  };
  draw();
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(slider('Rabi frequency Ω (log)',-1,1.6,0.005,s.lx,v=>`2π×${Math.pow(10,v).toFixed(2)} MHz`,v=>{s.lx=v;draw();}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Lock this Ω',()=>{
      const cur=geErr(TAU*Math.pow(10,s.lx),B,sc.tau), o=geOpt(B,sc.tau);
      if(cur<=o.E*1.08){ s.found.push(o.E); s.msg={t:`Optimal: E_min ≈ ${fmtP(o.E,3)} at Ω ≈ 2π×${(o.Om/TAU).toFixed(2)} MHz. The two error sources balance.`,c:'good'}; s.k++; }
      else { s.extra++; s.msg={t:`Error ${fmtP(cur,3)}; the minimum is lower. ${cur>0&&7*Math.PI/(4*TAU*Math.pow(10,s.lx)*sc.tau)>Math.pow(TAU*Math.pow(10,s.lx),2)/(8*B*B)?'Too slow: atoms spend too long in the decaying Rydberg state.':'Too fast: the drive starts to excite the blockaded |rr⟩ state.'}`,c:'warn'}; }
      rerender();
    },'pri'));
    card.appendChild(a);
    msgBox(card,s.msg);
    card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'In the blockade regime the CZ is insensitive to the exact interaction strength B, so atom-position jitter barely matters (Jaksch et al. 2000). Two errors remain: decay during ~7π/(4Ω) of Rydberg-state time, and off-resonant excitation of |rr⟩ ∝ Ω²/B². Saffman, Walker & Mølmer (2010) show the minimum scales as (Bτ)^(−2/3).'));
  } else {
    msgBox(card,s.msg);
    const q=miniQ(card,s,'scale','From your three scenarios: if B·τ grows by 8×, the minimum intrinsic error shrinks by…',['2×','4×','8×'],1,'E_min ∝ (Bτ)^(−2/3), and 8^(2/3) = 4. Stronger interactions and longer Rydberg lifetimes both help, but with diminishing returns. Real gates today are limited mostly by technical noise (laser phase noise, Doppler, scattering), not this intrinsic bound.');
    const q2=q && miniQ(card,s,'two','Jaksch et al. (2000) proposed two gates. What distinguishes the blockade gate from the "interaction-phase" gate?',['The blockade gate needs V ≫ Ω but not a precise V; the other excites both atoms and needs V·t tuned exactly','They are identical','The blockade gate needs no lasers','Only the interaction-phase gate entangles'],0,'Robustness to the exact interaction strength is why every modern neutral-atom CZ is blockade-based.');
    if(q&&q2){ completeLesson(lv,3-Math.min(2,s.extra+missesOf(s))); doneBox(card,lv,'Fundamental limits understood.'); }
  }
};

/* ---------- The first entangling experiments (2010) ---------- */
const FE={pLoss:0.10, pOk:0.82, surv:0.8, pop:0.82, coh:0.68};
KINDS.firstent=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({part:'A', tt:{}, ang:[], th:0, budgetB:10, msg:null}));
  const outs=['00','01','10','11'], cnot={'00':'00','01':'01','10':'11','11':'10'};
  const body=simShell(C,lv, s.part==='A'?'Part A: CNOT truth table (Isenhower et al. 2010)':'Part B: blockade entanglement (Wilk et al. 2010)');
  const card=sidePanel(Rt,lv);
  if(s.part==='A'){
    let tb='<table class="st tt"><tr><th>input ↓ / output →</th>'+outs.map(o=>`<th>|${o}⟩</th>`).join('')+'<th>atom lost</th></tr>';
    for(const i of outs){ const d=s.tt[i]; tb+=`<tr><td>|${i}⟩</td>`+outs.map(o=>`<td style="color:${o===cnot[i]?COL.ok:COL.mut}">${d?fmtP(d[o]/d.n,0):'·'}</td>`).join('')+`<td style="color:${COL.bad}">${d?fmtP(d.lost/d.n,0):'·'}</td></tr>`; }
    tb+='</table>';
    const all=outs.every(i=>s.tt[i]);
    let fr=null, fp=null;
    if(all){ fr=outs.reduce((a,i)=>a+s.tt[i][cnot[i]]/s.tt[i].n,0)/4; fp=outs.reduce((a,i)=>a+s.tt[i][cnot[i]]/(s.tt[i].n-s.tt[i].lost),0)/4; }
    body.appendChild(H('div',{style:'padding:10px 14px'},tb+(all?`<div class="kv"><span>Truth-table fidelity, losses counted as errors: <b>${fmtP(fr,1)}</b></span><span>Loss-corrected (discard shots with a lost atom): <b>${fmtP(fp,1)}</b></span></div>`:'')));
    card.appendChild(H('div',{cls:'small'},'Two Rb atoms in separate tweezers, more than 8 µm apart, with individually addressed Raman and Rydberg beams. CNOT = Hadamard · blockade CZ · Hadamard on the target. Prepare each input, run the gate, image both atoms.'));
    card.appendChild(H('h3',{},'Run 200 shots for input'));
    const t=H('div',{cls:'tools'});
    outs.forEach(i=>t.appendChild(btn(`|${i}⟩`,()=>{
      const d=s.tt[i]||(s.tt[i]={n:0,lost:0,'00':0,'01':0,'10':0,'11':0});
      for(let k=0;k<200;k++){ d.n++; if(rnd()<1-(1-FE.pLoss)**2){ d.lost++; continue; } if(rnd()<FE.pOk) d[cnot[i]]++; else d[pick(outs.filter(o=>o!==cnot[i]))]++; }
      rerender();
    })));
    card.appendChild(t);
    if(all){
      const q=miniQ(card,s,'rep','Both numbers are "true". What should a paper report as the gate fidelity?',['Only the loss-corrected value, since loss is not a gate error','The raw value (losses included), with the loss-corrected value clearly labelled','Whichever is higher'],1,'Lost atoms are a real failure of the operation. Isenhower et al. reported truth-table fidelities near 0.73 and a Bell-state fidelity of 0.48 ± 0.06, rising to 0.58 only after an a posteriori loss correction.');
      if(q){ const a=H('div',{cls:'acts'}); a.appendChild(btn('Part B →',()=>{s.part='B';rerender();},'pri')); card.appendChild(a); }
    } else card.appendChild(H('div',{cls:'small mut'},'Run all four inputs.'));
  } else {
    // parity measurement after a global rotation θ on both atoms
    const PiOf=th=>(1-2*FE.pop)*Math.cos(th)**2+FE.coh*Math.sin(th)**2;
    const xs=[]; for(let x=0;x<=Math.PI;x+=0.02) xs.push(x);
    let fit=null;
    if(s.ang.length>=2){ // least squares for Π = a cos²θ + c sin²θ
      let Saa=0,Scc=0,Sac=0,Sya=0,Syc=0; for(const p of s.ang){ const a=Math.cos(p.th)**2, c=Math.sin(p.th)**2, y=p.par; Saa+=a*a; Scc+=c*c; Sac+=a*c; Sya+=y*a; Syc+=y*c; }
      const det=Saa*Scc-Sac*Sac; if(Math.abs(det)>1e-6){ const A=(Sya*Scc-Syc*Sac)/det, Cc=(Syc*Saa-Sya*Sac)/det; const pop=(1-A)/2; fit={A,C:Cc,pop,F:(pop+Cc)/2}; }
    }
    const surv=s.ang.length?s.ang.reduce((a,p)=>a+p.kept,0)/s.ang.reduce((a,p)=>a+p.n,0):null;
    const P=plotSVG({h:280,xr:[0,Math.PI],yr:[-1.05,1.05],xticks:[0,Math.PI/4,Math.PI/2,3*Math.PI/4,Math.PI],xfmt:v=>['0','π/4','π/2','3π/4','π'][Math.round(v/(Math.PI/4))],xlabel:'global rotation angle θ',ylabel:'parity Π (surviving pairs)',
      series:fit?[{xs,ys:xs.map(t=>fit.A*Math.cos(t)**2+fit.C*Math.sin(t)**2),color:COL.gold}]:[],vlines:[{x:s.th,color:'#ffffff55',dash:'3 3'}],
      points:s.ang.map(p=>({x:p.th,y:p.par,err:Math.sqrt(Math.max(1-p.par*p.par,0.01)/p.kept),color:COL.Z})),hlines:[{y:0,color:'#2a3a5e',dash:''}]});
    body.appendChild(P.svg);
    const fr=fit&&surv!==null?fit.F*surv:null;
    body.appendChild(H('div',{cls:'kv'},fit?`<span>populations P↑↓+P↓↑ ≈ <b>${fit.pop.toFixed(2)}</b></span><span>coherence ≈ <b>${fit.C.toFixed(2)}</b></span><span>pair survival <b>${fmtP(surv,0)}</b></span><span>loss-corrected F = <b>${fit.F.toFixed(2)}</b></span><span>raw F (losses count) = <b>${fr.toFixed(2)}</b></span>`:'<span class="mut">Measure at ≥ 2 different angles to fit populations and coherence.</span>'));
    card.appendChild(H('div',{cls:'small'},'Both atoms 4 µm apart are driven together. The blockade allows only (|gr⟩+|rg⟩)/√2, and a second pulse maps |r⟩ onto a qubit state, giving |↑↓⟩+|↓↑⟩ in ~200 ns. Then a global rotation θ on both atoms makes the parity oscillate: Π(θ) = (1−2P<sub>pop</sub>)cos²θ + C·sin²θ. F = (P<sub>pop</sub> + C)/2.'));
    card.appendChild(slider('Rotation angle θ',0,Math.PI,0.01,s.th,v=>`${(v/Math.PI).toFixed(2)}π`,v=>{s.th=v;}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn(`Measure parity (100 shots) · ${s.budgetB} left`,()=>{
      let kept=0, sum=0; for(let k=0;k<100;k++){ if(rnd()>FE.surv*FE.surv) continue; kept++; sum+=rnd()<(1+PiOf(s.th))/2?1:-1; }
      s.ang.push({th:s.th,n:100,kept,par:kept?sum/kept:0}); s.budgetB--; rerender();
    },'pri',s.budgetB<=0));
    card.appendChild(a);
    if(fit){
      const q1=miniQ(card,s,'raw','Counting lost atoms as failures, are the atoms provably entangled?',['Yes (F > ½)','No (F ≤ ½)'],fr>0.5?0:1,'Raw fidelity below ½ cannot certify entanglement. That was the honest situation in 2010.');
      const q2=q1&&miniQ(card,s,'cor','After correcting for atom loss?',['Yes (F > ½)','No (F ≤ ½)'],fit.F>0.5?0:1,'Wilk et al. reported F = 0.75 after loss correction. Deterministic entanglement without correction came soon after, and today\'s gates exceed 99.5%.');
      if(q1&&q2){ completeLesson(lv,3-Math.min(2,missesOf(s))); doneBox(card,lv,'You analysed the first Rydberg entanglement.'); }
    }
  }
};

/* ---------- Dimer model (Semeghini et al. 2021) ---------- */
function kagomePatch(){
  // triangular-lattice points of a 3×3 rhombus; kagome vertices = their bond midpoints; atoms sit on kagome links
  const a1=[1,0], a2=[0.5,Math.sqrt(3)/2], P=[];
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) P.push([i*a1[0]+j*a2[0], i*a1[1]+j*a2[1]]);
  const d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
  const bonds=[]; for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++) if(Math.abs(d(P[i],P[j])-1)<1e-6) bonds.push([i,j]);
  const verts=bonds.map(([i,j])=>[(P[i][0]+P[j][0])/2,(P[i][1]+P[j][1])/2]);
  const links=[];
  for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++) for(let k=j+1;k<P.length;k++){
    if(Math.abs(d(P[i],P[j])-1)<1e-6&&Math.abs(d(P[j],P[k])-1)<1e-6&&Math.abs(d(P[i],P[k])-1)<1e-6){
      const vb=[[i,j],[j,k],[i,k]].map(([x,y])=>bonds.findIndex(b=>b[0]===x&&b[1]===y));
      links.push([vb[0],vb[1]],[vb[1],vb[2]],[vb[0],vb[2]]);
    }
  }
  // maximum matching by exhaustive search (16 vertices)
  const adj=verts.map(()=>[]); links.forEach(([u,v],l)=>{ adj[u].push([v,l]); adj[v].push([u,l]); });
  let best=0; const rec=(v,used,c)=>{ if(v>=verts.length){ best=Math.max(best,c); return; } if(used>>v&1) return rec(v+1,used,c);
    rec(v+1,used|(1<<v),c); for(const [w,l] of adj[v]) if(!(used>>w&1)) rec(v+1,used|(1<<v)|(1<<w),c+1); };
  rec(0,0,0);
  return {verts,links,best};
}
KINDS.dimer=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({g:kagomePatch(), sel:new Set(), msg:null, extra:0}));
  const {verts,links,best}=s.g;
  const cnt=verts.map(()=>0); for(const l of s.sel){ cnt[links[l][0]]++; cnt[links[l][1]]++; }
  const viol=cnt.filter(c=>c>1).length, mono=cnt.filter(c=>c===0).length;
  const body=simShell(C,lv,`Dimers <b>${s.sel.size}</b> · blockade violations <b style="color:${viol?COL.bad:COL.txt}">${viol}</b> · empty vertices ${mono}`);
  const xs=verts.map(v=>v[0]), ys=verts.map(v=>v[1]);
  const svg=S('svg',{viewBox:`${Math.min(...xs)-0.4} ${Math.min(...ys)-0.4} ${Math.max(...xs)-Math.min(...xs)+0.8} ${Math.max(...ys)-Math.min(...ys)+0.8}`}); atomDefs(svg);
  links.forEach(([u,v],l)=>{ const on=s.sel.has(l); S('line',{x1:verts[u][0],y1:verts[u][1],x2:verts[v][0],y2:verts[v][1],stroke:on?COL.gold:'#2a3a5e','stroke-width':on?.06:.02},svg); });
  verts.forEach((v,i)=>S('circle',{cx:v[0],cy:v[1],r:.05,fill:cnt[i]>1?COL.bad:cnt[i]===1?COL.gold:COL.mut},svg));
  links.forEach(([u,v],l)=>{ const x=(verts[u][0]+verts[v][0])/2, y=(verts[u][1]+verts[v][1])/2; drawAtom(svg,x,y,.06,s.sel.has(l)?'r':'g');
    const hit=S('circle',{cx:x,cy:y,r:.12,fill:'transparent',style:'cursor:pointer'},svg); hit.addEventListener('click',()=>{ if(s.done) return; s.sel.has(l)?s.sel.delete(l):s.sel.add(l); s.msg=null; rerender(); }); });
  body.appendChild(svg);
  body.appendChild(H('div',{cls:'small mut',style:'padding:2px 12px 8px'},'Small dots are kagome vertices. Every atom (on a link) is a potential dimer touching two vertices. Gold atom = Rydberg excitation = dimer. Red vertex = two dimers within one blockade radius (forbidden).'));
  const card=sidePanel(Rt,lv);
  if(!s.done){
    card.appendChild(H('div',{cls:'small'},`Place as many dimers as the blockade allows: at most one per vertex. On this open patch the maximum is <b>${best}</b>.`));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Check covering',()=>{
      if(viol){ s.extra++; s.msg={t:'Red vertices: two Rydberg atoms within one blockade radius. The blockade forbids that.',c:'warn'}; }
      else if(s.sel.size<best){ s.extra++; s.msg={t:`Valid, but ${best-s.sel.size} more dimer${best-s.sel.size>1?'s':''} fit. ${mono} vertices are empty ("monomers").`,c:'warn'}; }
      else { s.done=true; s.msg={t:`Maximal dimer covering! Each filled vertex holds exactly one dimer. In the experiment the quantum ground state is a <b>superposition</b> of many such coverings: a resonating-valence-bond (toric-code-type) spin liquid.`,c:'good'}; }
      rerender(); },'pri'));
    a.appendChild(btn('Clear',()=>{s.sel.clear();rerender();}));
    card.appendChild(a);
  }
  msgBox(card,s.msg);
  if(s.done){
    const q1=miniQ(card,s,'z','How did Semeghini et al. detect the spin liquid, given that it has no local order?',['By finding a checkerboard pattern','By measuring closed-loop (topological string) operators in two bases: diagonal dimer parity and off-diagonal coherence between coverings','By heating the array','By counting lost atoms only'],1,'Z-type strings measure dimer-number parity along a loop. X-type strings measure coherence between coverings and were accessed by a short quasi-local evolution before imaging. Both together signal toric-code-type topological order.');
    const q2=q1&&miniQ(card,s,'prep','How was the state prepared?',['A quasi-adiabatic detuning sweep, like your chain and MIS lessons, ending near dimer density ¼ on 219 atoms','By rearranging atoms into dimers','By cooling to absolute zero'],0,'Same toolbox, new geometry: atoms on kagome links (a ruby lattice), with the blockade radius chosen so each vertex holds at most one dimer.');
    if(q1&&q2){ completeLesson(lv,3-Math.min(2,s.extra+missesOf(s))); doneBox(card,lv,'Frustrated blockade explored.'); }
  }
};

/* ---------- EIT & photon storage (Lukin RMP 2003) ---------- */
const EIT={g:TAU*3, gs:TAU*0.01, tasks:[{OD:20,Tp:0.5},{OD:60,Tp:0.25},{OD:200,Tp:1}]};
function eitAbs(dMHz, OcMHz){
  const d=TAU*dMHz, g=EIT.g, gs=EIT.gs, Oc=TAU*OcMHz;
  // a = Re[ γ(γs − iδ) / ((γ − iδ)(γs − iδ) + Ωc²/4) ]
  const nr=g*gs, ni=-g*d, dr=g*gs-d*d+Oc*Oc/4, di=-d*(g+gs);
  return (nr*dr+ni*di)/(dr*dr+di*di);
}
function eitEff(OcMHz,OD,Tp){
  const Oc=TAU*OcMHz, tg=2*EIT.g*OD/(Oc*Oc), w=Oc*Oc/(2*EIT.g*Math.sqrt(OD)), sig=2/Tp;
  return {eta:(1-Math.exp(-((tg/Tp)**2)))*Math.exp(-((sig/w)**2)), tg, w};
}
KINDS.eit=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({k:0, Oc:2, found:[], extra:0, msg:null}));
  const done=s.k>=EIT.tasks.length, T=EIT.tasks[Math.min(s.k,EIT.tasks.length-1)];
  const body=simShell(C,lv, done?'All three memories optimised':`Task <b>${s.k+1}/3</b>: OD = ${T.OD}, probe pulse ${T.Tp*1000} ns`);
  const draw=()=>{
    body.innerHTML='';
    const xs=[]; for(let x=-12;x<=12;x+=0.04) xs.push(x);
    const tr=xs.map(x=>Math.exp(-T.OD*eitAbs(x,s.Oc)));
    const sigMHz=2/T.Tp/TAU, spec=xs.map(x=>Math.exp(-(x*x)/(2*sigMHz*sigMHz)));
    const P=plotSVG({h:260,xr:[-12,12],yr:[0,1.05],xlabel:'probe detuning (MHz)',ylabel:'probe transmission',series:[{xs,ys:spec,color:COL.X,dash:'5 4',width:1.5},{xs,ys:tr,color:COL.Z,width:2.5}],
      legend:[{label:'EIT transmission',color:COL.Z},{label:'probe-pulse spectrum',color:COL.X}]});
    body.appendChild(P.svg);
    const e=eitEff(s.Oc,T.OD,T.Tp);
    body.appendChild(H('div',{cls:'kv'},`<span>Ω_c = 2π×<b>${s.Oc.toFixed(2)}</b> MHz</span><span>group delay <b>${(e.tg*1000).toFixed(0)}</b> ns vs pulse ${T.Tp*1000} ns</span><span>window width 2π×<b>${(e.w/TAU).toFixed(2)}</b> MHz</span><span>storage efficiency ≈ <b style="color:${COL.gold}">${fmtP(e.eta,0)}</b></span>`+s.found.map((f,i)=>`<span>OD ${EIT.tasks[i].OD}: best ≈ ${fmtP(f,0)}</span>`).join('')));
  };
  draw();
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(slider('Control-field Rabi frequency Ω_c',0.3,15,0.05,s.Oc,v=>`2π×${v.toFixed(2)} MHz`,v=>{s.Oc=v;draw();}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Store & retrieve the pulse',()=>{
      const e=eitEff(s.Oc,T.OD,T.Tp); let best=0; for(let o=0.3;o<=15;o+=0.01) best=Math.max(best,eitEff(o,T.OD,T.Tp).eta);
      if(e.eta>=0.93*best){ s.found.push(best); s.k++; s.msg={t:`Efficiency ${fmtP(e.eta,0)} (best ≈ ${fmtP(best,0)}).`,c:'good'}; }
      else { s.extra++; const tooStrong=e.tg<T.Tp; s.msg={t:`Efficiency ${fmtP(e.eta,0)}. ${tooStrong?'The control is too strong: light moves fast, so the pulse leaks out before it is fully inside the medium.':'The control is too weak: the transparency window is narrower than the pulse spectrum, so its edges get absorbed.'}`,c:'warn'}; }
      rerender();
    },'pri'));
    card.appendChild(a);
    msgBox(card,s.msg);
    card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'Model: Λ-system susceptibility with Γ = 2π×6 MHz. Efficiency = (pulse fits in medium) × (spectrum fits in window), a simplified delay-bandwidth estimate.'));
  } else {
    msgBox(card,s.msg);
    const q=miniQ(card,s,'od','Your best efficiencies rose with optical depth. Why?',['More atoms scatter more light','The delay-bandwidth product grows with OD: more delay for the same transparency window','OD changes the wavelength'],1,'Slowing light by τ_g ∝ OD/Ω_c² while keeping a window ∝ Ω_c²/√OD means delay × bandwidth ∝ √OD. Dense ensembles are better memories.');
    if(q){ completeLesson(lv,3-Math.min(2,s.extra+missesOf(s))); doneBox(card,lv,'Light stopped and released.'); }
  }
};

/* ================================================================
   Theory unit: circuits, complexity, algorithms, codes (Preskill, Ph219/CS219 lecture notes, Ch. 5–7)
   ================================================================ */
const cx=(r,i=0)=>[r,i], cmul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]], cadd=(a,b)=>[a[0]+b[0],a[1]+b[1]], cconj=a=>[a[0],-a[1]];
function mmul(A,B){ const n=A.length; return A.map(row=>B[0].map((_,j)=>{ let s=[0,0]; for(let k=0;k<n;k++) s=cadd(s,cmul(row[k],B[k][j])); return s; })); }
function kron(A,B){ const n=A.length,m=B.length,R=[]; for(let i=0;i<n*m;i++){ R.push([]); for(let j=0;j<n*m;j++) R[i].push(cmul(A[Math.floor(i/m)][Math.floor(j/m)],B[i%m][j%m])); } return R; }
const ident=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>[i===j?1:0,0]));
function opDist(A,B){ let s=[0,0]; const n=A.length; for(let i=0;i<n;i++) for(let k=0;k<n;k++) s=cadd(s,cmul(cconj(A[k][i]),B[k][i])); return Math.sqrt(Math.max(0,1-Math.hypot(s[0],s[1])/n)); }
const R2=Math.SQRT1_2, M_=rows=>rows.map(r=>r.map(v=>Array.isArray(v)?v:cx(v)));
const G1={H:M_([[R2,R2],[R2,-R2]]), T:M_([[1,0],[0,[R2,R2]]]), S:M_([[1,0],[0,[0,1]]]), X:M_([[0,1],[1,0]]), Z:M_([[1,0],[0,-1]])};
const G2={H0:kron(G1.H,ident(2)), H1:kron(ident(2),G1.H), CNOT01:M_([[1,0,0,0],[0,1,0,0],[0,0,0,1],[0,0,1,0]]), CNOT10:M_([[1,0,0,0],[0,0,0,1],[0,0,1,0],[0,1,0,0]])};
const CIRC_TASKS=[
  {t:'Make Z from T gates', dim:2, pal:['T','H'], max:4, target:G1.Z, why:'T = diag(1, e^{iπ/4}), so T⁴ = diag(1, −1) = Z. T is the "π/8 gate" that, with H, makes the set universal.'},
  {t:'Make X from H and T', dim:2, pal:['T','H'], max:6, target:G1.X, why:'HZH = X: Hadamard swaps the X and Z axes. Z = T⁴, so X = H T⁴ H.'},
  {t:'Make CZ from CNOT and H', dim:4, pal:['H0','H1','CNOT01'], max:3, target:M_([[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,-1]]), why:'Conjugating the target of a CNOT by H turns the controlled-X into a controlled-Z. That is exactly how Rydberg CZ gates become CNOTs.'},
  {t:'Make SWAP from CNOTs', dim:4, pal:['CNOT01','CNOT10'], max:3, target:M_([[1,0,0,0],[0,0,1,0],[0,1,0,0],[0,0,0,1]]), why:'Three alternating CNOTs swap two qubits, the quantum version of the XOR-swap trick.'},
  {t:'Reverse a CNOT with Hadamards', dim:4, pal:['H0','H1','CNOT01'], max:5, target:G2.CNOT10, why:'(H⊗H)·CNOT·(H⊗H) swaps control and target. In the X basis, information flows "backwards".'},
];
// Brute-force search over H/T words (no HH, no T⁸) for the best approximation of a target.
function skSearch(target, L){
  let best={d:1,w:''};
  const rec=(U,w,lastH,tRun)=>{
    const d=opDist(target,U); if(d<best.d-1e-12 || (Math.abs(d-best.d)<1e-12 && w.length<best.w.length)) best={d,w};
    if(w.length>=L) return;
    if(!lastH) rec(mmul(G1.H,U),w+'H',true,0);
    if(tRun<7) rec(mmul(G1.T,U),w+'T',false,tRun+1);
  };
  rec(ident(2),'',false,0);
  return best;
}
function randomSU2(){ const th=0.3+rnd()*2.5, ax=[gauss(),gauss(),gauss()], n=Math.hypot(...ax); const [x,y,z]=ax.map(v=>v/n), c=Math.cos(th/2), s=Math.sin(th/2);
  return [[[c,-s*z],[-s*y,-s*x]],[[s*y,-s*x],[c,s*z]]]; }
function fmtMat(U){ return '<table class="st tt mat">'+U.map(r=>'<tr>'+r.map(v=>{ const m=Math.hypot(v[0],v[1]); if(m<1e-9) return '<td class="mut">0</td>'; const ph=Math.atan2(v[1],v[0])/Math.PI; const pf=Math.abs(ph)<1e-9?'':(Math.abs(Math.abs(ph)-1)<1e-9?'−':`e^{${(+ph.toFixed(3))}iπ}`); return `<td>${pf==='−'?'−':''}${m.toFixed(3)}${pf&&pf!=='−'?' '+pf:''}</td>`; }).join('')+'</tr>').join('')+'</table>'; }
KINDS.circuit=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({k:0, seq:[], extra:0, msg:null, sk:null, L:6, runs:[]}));
  const done=s.k>=CIRC_TASKS.length;
  const body=simShell(C,lv, done?'Part B: approximating any gate (Solovay–Kitaev)':`Part A, task <b>${s.k+1}/${CIRC_TASKS.length}</b>: ${CIRC_TASKS[s.k].t}`);
  const card=sidePanel(Rt,lv);
  if(!done){
    const T=CIRC_TASKS[s.k], gOf=g=>T.dim===2?G1[g]:G2[g];
    let U=ident(T.dim); for(const g of s.seq) U=mmul(gOf(g),U);
    const d=opDist(T.target,U);
    body.appendChild(H('div',{cls:'timeline'},`<div class="rail"><span class="rname">circuit (time →)</span>${s.seq.map(g=>`<span class="pulse on">${g.replace('CNOT01','CX₀→₁').replace('CNOT10','CX₁→₀').replace('H0','H₀').replace('H1','H₁')}</span>`).join('')||'<span class="mut small">empty</span>'}</div>`));
    body.appendChild(H('div',{cls:'simrow',style:'padding:0 12px 12px;gap:24px'},`<div><div class="small mut">your unitary</div>${fmtMat(U)}</div><div><div class="small mut">target (up to global phase)</div>${fmtMat(T.target)}</div><div class="small" style="align-self:center">distance to target: <b style="color:${d<1e-6?COL.ok:COL.gold}">${d.toFixed(3)}</b></div>`));
    card.appendChild(H('div',{cls:'small'},`Gates allowed: ${T.pal.join(', ')} · at most ${T.max}.`));
    const t=H('div',{cls:'tools'}); T.pal.forEach(g=>t.appendChild(btn(g,()=>{ s.seq.push(g); rerender(); },'',s.seq.length>=T.max))); card.appendChild(t);
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Undo',()=>{s.seq.pop();rerender();},'',!s.seq.length));
    a.appendChild(btn('Check',()=>{ if(d<1e-6){ s.msg={t:'✓ '+T.why,c:'good'}; s.k++; s.seq=[]; } else { s.extra++; s.msg={t:'Not equal to the target yet (even up to a global phase).',c:'warn'}; } rerender(); },'pri'));
    card.appendChild(a);
  } else {
    while(!s.sk){ const target=randomSU2(); for(let L=4;L<=18;L++){ if(skSearch(target,L).d<=0.1){ s.sk={target,Lmin:L}; break; } } }
    const xs=s.runs.map(r=>r.L), P=plotSVG({h:260,xr:[0,24],yr:[-2.5,0],xlabel:'maximum word length L (H and T gates)',ylabel:'best distance (log₁₀)',xticks:[0,4,8,12,16,20,24],yticks:[-2.5,-2,-1.5,-1,-0.5,0],
      points:s.runs.map(r=>({x:r.L,y:Math.log10(Math.max(r.d,1e-3)),color:r.d<=0.1?COL.ok:COL.gold,r:5})),hlines:[{y:Math.log10(0.1),color:COL.ok,label:'target ε = 0.1'}]});
    body.appendChild(P.svg);
    body.appendChild(H('div',{cls:'kv'},s.runs.map(r=>`<span>L=${r.L}: ε=${r.d.toFixed(3)} via <code>${r.w||'I'}</code></span>`).join('')||'<span class="mut">Pick a word length and search.</span>'));
    card.appendChild(H('div',{cls:'small'},'A random single-qubit rotation can\'t be built exactly from H and T: there are only countably many finite words, but uncountably many unitaries. You can approximate it, though. Find the <b>shortest</b> word length that reaches distance ε ≤ 0.1.'));
    card.appendChild(slider('Word length L',2,22,1,s.L,v=>`${v}`,v=>{s.L=v;}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Search all words',()=>{ const b=skSearch(s.sk.target,s.L); s.runs.push({L:s.L,d:b.d,w:b.w}); rerender(); },'pri'));
    a.appendChild(btn(`Claim: L = ${s.L} is the shortest`,()=>{ const b=skSearch(s.sk.target,s.L);
      if(b.d<=0.1 && s.L<=s.sk.Lmin+1){ s.passed=true; completeLesson(lv,3-Math.min(2,s.extra+(s.runs.length>6?1:0))); s.msg={t:`✓ ε = ${b.d.toFixed(3)} with ${b.w.length} gates. The Solovay–Kitaev theorem guarantees ε needs only O(log^c(1/ε)) gates from any finite universal set, so universality is cheap (Preskill §5.4.4).`,c:'good'}; }
      else { s.extra++; s.msg={t: b.d>0.1?`At L = ${s.L} the best is ε = ${b.d.toFixed(3)}: not good enough.`:'That works, but a shorter length also does.',c:'warn'}; }
      rerender(); },'',!!s.passed));
    card.appendChild(a);
  }
  msgBox(card,s.msg);
  if(s.passed) doneBox(card,lv,'Universal gate sets mastered.');
};

/* ---------- Complexity: known, false, or open? ---------- */
const CPX=[
  {s:'P ⊆ BQP', a:'true', why:'A quantum computer can run any reversible version of a classical circuit (Preskill §5.2).'},
  {s:'BQP ⊆ PSPACE', a:'true', why:'Sum over computational paths one at a time, reusing memory: polynomial space, exponential time (§5.3.2).'},
  {s:'NP ⊆ BQP (quantum computers solve NP-complete problems efficiently)', a:'open', why:'Unproven either way, and widely believed false. Grover gives only a quadratic speed-up for unstructured search.'},
  {s:'Factoring is in BQP', a:'true', why:'Shor\'s algorithm: factoring reduces to period finding, which the QFT solves in polynomial time (§6.3).'},
  {s:'Factoring is NP-complete', a:'open', why:'Factoring is in NP ∩ coNP, so if it were NP-complete then NP = coNP: believed false, but unproven.'},
  {s:'BPP = BQP', a:'open', why:'Oracle separations exist (Simon, Bernstein–Vazirani), but no unconditional proof for unrelativized classes.'},
  {s:'3-SAT is NP-complete', a:'true', why:'Cook–Levin: any NP verification can be encoded as satisfiability of local constraints (§6.10.1).'},
  {s:'The k-local Hamiltonian problem is QMA-complete', a:'true', why:'Kitaev\'s quantum Cook–Levin theorem: estimating ground-state energies of local Hamiltonians is as hard as any QMA problem (§6.10).'},
  {s:'Unstructured search over N items can be done with O(log N) quantum queries', a:'false', why:'Grover is optimal: any quantum algorithm needs Ω(√N) queries (§6.7).'},
  {s:'Most n-qubit unitaries need a number of gates exponential in n', a:'true', why:'Counting argument: poly-size circuits can\'t come ε-close to most of the vast space of unitaries (§5.3.3).'},
  {s:'Any classical computation can be made reversible with modest overhead', a:'true', why:'Bennett: compute, copy the answer, uncompute. The pebble game trades time for space (§5.2.3).'},
  {s:'A finite gate set can implement every unitary exactly', a:'false', why:'Countably many circuits vs uncountably many unitaries. Finite sets only approximate (densely, via Solovay–Kitaev).'},
  {s:'Two-qubit gates are exactly universal', a:'true', why:'Any n-qubit unitary decomposes exactly into two-qubit gates (§5.4.2), though typically exponentially many.'},
  {s:'P ≠ NP', a:'open', why:'The most famous open problem in computer science.'},
  {s:'Quantum circuits that stay only slightly entangled can be simulated efficiently on a classical computer', a:'true', why:'Matrix-product-state simulation is efficient when Schmidt ranks stay polynomial (§6.9). Entanglement is necessary for speed-up.'},
  {s:'Erasing one bit of information must dissipate at least kT ln 2 of heat', a:'true', why:'Landauer\'s principle (§5.2.1). That\'s why reversible logic is interesting, and why quantum gates must be reversible.'},
];
KINDS.complexity=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({deck:shuffle(CPX.slice()).slice(0,10), i:0, miss:0, pick:null}));
  const done=s.i>=s.deck.length;
  const body=simShell(C,lv, done?'Complete':`Statement <b>${s.i+1}/${s.deck.length}</b>`);
  const box=H('div',{cls:'quizbox'});
  if(done) box.innerHTML=`<div class="big">Complexity zoo navigated</div><p class="mut">${s.miss} mistake${s.miss===1?'':'s'}.</p>
    <p class="small">Known containments: P ⊆ BPP ⊆ BQP ⊆ PP ⊆ PSPACE, and NP ⊆ QMA ⊆ PP. Where NP and BQP sit relative to each other is unknown.</p>`;
  else {
    const c=s.deck[s.i];
    box.appendChild(H('div',{cls:'qq'},c.s));
    const o=H('div',{cls:'qopts'});
    [['true','Proven true'],['false','Proven false'],['open','Open problem']].forEach(([k,l])=>o.appendChild(btn(l,()=>{ if(s.pick===c.a) return; s.pick=k; if(k!==c.a) s.miss++; rerender(); },'qopt'+(s.pick===k?(k===c.a?' good':' badb'):''))));
    box.appendChild(o);
    if(s.pick!==null){ const ok=s.pick===c.a; box.appendChild(H('div',{cls:'msg '+(ok?'good':'bad')},(ok?'<b>Correct.</b> ':'<b>Not quite.</b> ')+(ok?c.why:'Try again.')));
      if(ok){ const a=H('div',{cls:'acts'}); a.appendChild(btn(s.i+1<s.deck.length?'Next statement →':'Finish',()=>{ s.i++; s.pick=null; if(s.i>=s.deck.length) completeLesson(lv,s.miss===0?3:s.miss<=2?2:1); rerender(); },'pri')); box.appendChild(a); } }
  }
  body.appendChild(box);
  const card=sidePanel(Rt,lv);
  card.appendChild(H('div',{cls:'small mut'},'For each statement, decide whether it is a theorem, provably false, or an open problem.'));
  if(done) doneBox(card,lv,'Complexity checkpoint passed.');
};

/* ---------- Oracle problems: Deutsch–Jozsa & Bernstein–Vazirani ---------- */
const OR_N=4, OR_SIZE=1<<OR_N;
KINDS.oracle=(C,Rt,lv)=>{
  const mk=kind=>{ if(kind==='bv'){ const sv=Math.floor(rnd()*OR_SIZE); return {kind,sv,f:Array.from({length:OR_SIZE},(_,x)=>popcnt(x&sv)&1)}; }
    if(rnd()<0.5){ const c=rnd()<.5?0:1; return {kind,isConst:true,f:new Array(OR_SIZE).fill(c)}; }
    const idx=shuffle(Array.from({length:OR_SIZE},(_,i)=>i)), f=new Array(OR_SIZE).fill(0); idx.slice(0,OR_SIZE/2).forEach(i=>f[i]=1); return {kind,isConst:false,f}; };
  const plan=['dj','dj','dj','bv','bv'];
  const s=lstate(lv,()=>({r:0, o:mk('dj'), q:[], qOut:null, queries:0, wrong:0, x:0, bits:0, msg:null}));
  const done=s.r>=plan.length, o=s.o;
  const body=simShell(C,lv, done?`Done · total oracle queries: <b>${s.queries}</b>`:`Round <b>${s.r+1}/5</b>: ${o.kind==='dj'?'Deutsch–Jozsa (constant or balanced?)':'Bernstein–Vazirani (find the hidden string s, f(x) = s·x mod 2)'} · queries so far ${s.queries}`);
  const bin=x=>x.toString(2).padStart(OR_N,'0');
  if(!done){
    const g=H('div',{cls:'kv',style:'padding:10px 14px'});
    g.innerHTML=s.q.length?s.q.map(([x,v])=>`<span>f(${bin(x)}) = <b>${v}</b></span>`).join(''):'<span class="mut">No classical queries yet.</span>';
    body.appendChild(g);
    if(s.qOut!==null) body.appendChild(H('div',{cls:'msg',style:'margin:8px 14px'},`Quantum circuit (H⊗ⁿ → oracle → H⊗ⁿ → measure) returned <b>${bin(s.qOut)}</b>.`));
  }
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(H('h3',{},'Classical query'));
    card.appendChild(slider('Input x',0,OR_SIZE-1,1,s.x,v=>bin(v),v=>{s.x=v;}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Query f(x) (1 query)',()=>{ s.q.push([s.x,o.f[s.x]]); s.queries++; rerender(); }));
    a.appendChild(btn('Run quantum circuit (1 query)',()=>{
      // amplitude of |y⟩ after H f H on |0…0⟩|−⟩: (1/N) Σ_x (−1)^{f(x)+x·y}
      const pr=Array.from({length:OR_SIZE},(_,y)=>{ let sm=0; for(let x=0;x<OR_SIZE;x++) sm+=((o.f[x]+popcnt(x&y))&1)?-1:1; return (sm/OR_SIZE)**2; });
      let u=rnd(), y=0; for(;y<OR_SIZE-1;y++){ u-=pr[y]; if(u<=0) break; }
      s.qOut=y; s.queries++; rerender(); },'pri'));
    card.appendChild(a);
    card.appendChild(H('h3',{},'Your answer'));
    const ans=H('div',{cls:'acts'});
    const finish=(ok,txt)=>{ if(!ok) s.wrong++; s.msg={t:(ok?'✓ ':'✗ ')+txt,c:ok?'good':'bad'}; s.r++; if(s.r<plan.length){ s.o=mk(plan[s.r]); s.q=[]; s.qOut=null; s.bits=0; } else if(s.wrong<=1) completeLesson(lv, s.wrong===0&&s.queries<=6?3:s.wrong===0?2:1); rerender(); };
    if(o.kind==='dj'){
      ans.appendChild(btn('Constant',()=>finish(o.isConst,o.isConst?'Constant.':'It was balanced.')));
      ans.appendChild(btn('Balanced',()=>finish(!o.isConst,!o.isConst?'Balanced.':'It was constant.')));
    } else {
      const bits=H('div',{cls:'opt'});
      for(let b=OR_N-1;b>=0;b--) bits.appendChild(btn(String((s.bits>>b)&1),()=>{ s.bits^=1<<b; rerender(); },(s.bits>>b)&1?'on':''));
      card.appendChild(bits);
      ans.appendChild(btn(`Answer s = ${bin(s.bits)}`,()=>finish(s.bits===o.sv,`s = ${bin(o.sv)}.`)));
    }
    card.appendChild(ans);
    msgBox(card,s.msg);
    card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},`f maps ${OR_N}-bit strings to one bit. A deterministic classical algorithm needs up to 2^(n−1)+1 = ${OR_SIZE/2+1} queries for Deutsch–Jozsa and n = ${OR_N} for Bernstein–Vazirani. Guessing early risks a wrong answer: you decide.`));
  } else {
    msgBox(card,s.msg);
    if(s.wrong<=1) doneBox(card,lv,`${5-s.wrong}/5 correct with ${s.queries} queries.`);
    else { card.appendChild(H('div',{cls:'msg bad'},'Too many wrong answers. One quantum query answers each round with certainty.')); const a=H('div',{cls:'acts'}); a.appendChild(btn('Retry',()=>resetLesson(lv),'pri')); card.appendChild(a); }
  }
};

/* ---------- Shor: factoring via period finding ---------- */
const gcd=(a,b)=>{ while(b){ [a,b]=[b,a%b]; } return a; };
const modpow=(a,e,m)=>{ let r=1; a%=m; while(e>0){ if(e&1) r=r*a%m; a=a*a%m; e>>=1; } return r; };
const orderOf=(a,N)=>{ let x=a%N, r=1; while(x!==1){ x=x*a%N; r++; if(r>N) return null; } return r; };
function convergents(num,den,maxQ){ const out=[]; let a=num, b=den, h1=1,h0=0,k1=0,k0=1; while(b){ const q=Math.floor(a/b); [a,b]=[b,a-q*b]; const h=q*h1+h0, k=q*k1+k0; if(k>=maxQ) break; out.push([h,k]); h0=h1; h1=h; k0=k1; k1=k; } return out; }
function shorDist(r,Q){ const P=new Float64Array(Q); for(let y=0;y<Q;y++){ const th=2*Math.PI*r*y/Q, s2=Math.sin(th/2)**2; for(let x0=0;x0<r;x0++){ const M=Math.ceil((Q-x0)/r); P[y]+= s2<1e-14 ? M*M : Math.sin(M*th/2)**2/s2; } P[y]/=Q*Q; } return P; }
const SHOR_N=[15,21,35];
KINDS.shor=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({k:0, a:null, r:null, rc:null, samples:[], stage:'a', msg:null, extra:0, found:[]}));
  const done=s.k>=SHOR_N.length, N=SHOR_N[Math.min(s.k,SHOR_N.length-1)], Q=1<<Math.ceil(Math.log2(N*N));
  const body=simShell(C,lv, done?'All three numbers factored':`Factor <b>N = ${N}</b> · register Q = 2^${Math.log2(Q)} = ${Q}`);
  const card=sidePanel(Rt,lv);
  if(!done){
    if(s.a){
      const hist=new Map(); s.samples.forEach(y=>hist.set(y,(hist.get(y)||0)+1));
      const bars=[...hist].map(([y,c])=>({x0:y-Q/200,x1:y+Q/200,y:c,color:COL.gold}));
      const series=s.r&&s.stage!=='quantum'?(()=>{ const P=shorDist(s.r,Q), xs=[], ys=[]; const sc=Math.max(1,s.samples.length); for(let y=0;y<Q;y++){ xs.push(y); ys.push(P[y]*sc*Q/100); } return [{xs,ys,color:COL.Z,op:.6,width:1}]; })():[];
      const P=plotSVG({h:230,xr:[0,Q],yr:[0,Math.max(2,...[...hist.values()])+0.5],xlabel:'measured y (0 … Q−1)',ylabel:'counts',bars,series,yfmt:v=>Math.round(v)});
      body.appendChild(P.svg);
      body.appendChild(H('div',{cls:'kv'},`<span>a = <b>${s.a}</b></span>`+s.samples.slice(-6).map(y=>`<span>y = ${y} → y/Q = ${(y/Q).toFixed(4)}</span>`).join('')));
    } else body.appendChild(H('div',{cls:'quizbox'},`<div class="qq">Shor's recipe for N = ${N}</div><p class="small">1. Pick a random a. If gcd(a, N) > 1 you got lucky.<br>2. Quantum part: find the period r of f(x) = aˣ mod N. Run the QFT on a superposition, then measure y ≈ (integer)·Q/r.<br>3. Classical part: continued fractions turn y/Q into a guess for r. If r is even and a^{r/2} ≢ −1 (mod N), then gcd(a^{r/2} ± 1, N) are factors.</p>`));
    if(s.stage==='a'){
      const a=H('div',{cls:'acts'});
      a.appendChild(btn('Pick a random a',()=>{ const x=2+Math.floor(rnd()*(N-3)); s.a=x; s.samples=[]; s.rc=null;
        const g=gcd(x,N); if(g>1){ s.msg={t:`gcd(${x}, ${N}) = ${g}: a lucky factor, no quantum computer needed! (This happens rarely for large N.) Try again for the real algorithm.`,c:'warn'}; s.a=null; }
        else { s.r=orderOf(x,N); s.stage='quantum'; s.msg={t:`a = ${x}. Now find the period of ${x}ˣ mod ${N}.`}; } rerender(); },'pri'));
      card.appendChild(a);
    } else if(s.stage==='quantum'){
      const a=H('div',{cls:'acts'});
      a.appendChild(btn('Run period-finding circuit (1 shot)',()=>{ const P=shorDist(s.r,Q); let u=rnd(), y=0; for(;y<Q-1;y++){ u-=P[y]; if(u<=0) break; } s.samples.push(y); rerender(); },'pri'));
      card.appendChild(a);
      const y=s.samples[s.samples.length-1];
      if(y!==undefined){
        const cf=convergents(y,Q,N);
        card.appendChild(H('div',{cls:'small'},`Continued-fraction convergents of ${y}/${Q} with denominator < N:<br>${cf.map(([h,k])=>`${h}/${k}`).join(', ')||'(none: y = 0 carries no information)'}`));
        card.appendChild(H('h3',{},'Test a candidate period r'));
        const t=H('div',{cls:'tools'});
        const cands=[...new Set(cf.map(c=>c[1]).filter(k=>k>1))];
        cands.forEach(k=>[k,2*k,3*k].filter(v=>v<N).forEach(v=>t.appendChild(btn(`r = ${v}`,()=>{
          const val=modpow(s.a,v,N);
          if(val===1){ s.rc=v; s.stage='classical'; s.msg={t:`${s.a}^${v} mod ${N} = 1 ✓. Period candidate r = ${v}.`,c:'good'}; }
          else { s.extra++; s.msg={t:`${s.a}^${v} mod ${N} = ${val} ≠ 1. Not the period. A convergent can give a divisor of r: try multiples, or take another shot.`,c:'warn'}; }
          rerender(); }))));
        card.appendChild(t);
      }
    } else if(s.stage==='classical'){
      const r=s.rc, half=r%2===0?modpow(s.a,r/2,N):null;
      card.appendChild(H('div',{cls:'small'},`r = ${r}. ${r%2===0?`a^{r/2} mod N = ${half}.`:'r is odd.'}`));
      card.appendChild(H('h3',{},'Decision'));
      const usable=r%2===0 && half!==N-1;
      const a=H('div',{cls:'acts'});
      a.appendChild(btn('Compute gcd(a^{r/2} ± 1, N)',()=>{
        if(!usable){ s.extra++; s.msg={t:r%2?'r is odd, so a^{r/2} isn\'t an integer power. This a fails.':`a^{r/2} ≡ −1 (mod N), so gcd(a^{r/2}+1, N) = N: trivial. This a fails.`,c:'bad'}; }
        else { const f1=gcd(half-1,N), f2=gcd(half+1,N), f=[f1,f2].find(x=>x>1&&x<N);
          if(f){ s.found.push(`${N} = ${f} × ${N/f}`); s.msg={t:`🎉 ${N} = ${f} × ${N/f}.`,c:'good'}; s.k++; Object.assign(s,{a:null,r:null,rc:null,samples:[],stage:'a'}); if(s.k>=SHOR_N.length) completeLesson(lv,3-Math.min(2,Math.floor(s.extra/2))); }
          else { s.msg={t:'Both gcds were trivial. Pick a new a.',c:'warn'}; s.stage='a'; s.a=null; } }
        rerender(); },'pri'));
      a.appendChild(btn('This a is unusable: pick a new a',()=>{ if(usable){ s.extra++; s.msg={t:'Actually this r works: it is even and a^{r/2} ≢ −1.',c:'warn'}; } else { s.msg={t:'Right: discard this a. Each random a succeeds with probability at least ½.',c:'good'}; s.stage='a'; s.a=null; } rerender(); }));
      card.appendChild(a);
    }
    msgBox(card,s.msg);
  } else { card.appendChild(H('div',{cls:'msg good'},s.found.join('<br>'))); doneBox(card,lv,'You ran Shor\'s algorithm.'); }
  card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'The quantum measurement is genuinely random: each shot gives y near a random multiple j·Q/r. When gcd(j, r) > 1, continued fractions return only a divisor of r. Factoring a 2048-bit RSA key this way needs on the order of thousands of logical qubits running fault-tolerantly, which is why the error-correction units matter.'));
};

/* ---------- Grover search ---------- */
const GR_ROUNDS=[{n:4,M:1},{n:6,M:1},{n:8,M:3},{n:8,M:null}];
KINDS.grover=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({r:0, k:1, calls:0, runs:[], hiddenM:1+Math.floor(rnd()*4), msg:null, extra:0}));
  const done=s.r>=GR_ROUNDS.length, R=GR_ROUNDS[Math.min(s.r,GR_ROUNDS.length-1)], N=1<<R.n, M=R.M??s.hiddenM;
  const pk=(k,m)=>Math.sin((2*k+1)*Math.asin(Math.sqrt(m/N)))**2;
  const body=simShell(C,lv, done?`All searches done · oracle calls: <b>${s.calls}</b>`:`Round <b>${s.r+1}/4</b>: N = ${N} items, ${R.M?`M = ${R.M} marked`:'<b>unknown</b> number of marked items (1–4)'}`);
  const lastRuns=s.runs.filter(x=>x.r===s.r);
  if(lastRuns.length || done){
    const kmax=Math.ceil(Math.PI/4*Math.sqrt(N))*2+2, xs=[]; for(let k=0;k<=kmax;k++) xs.push(k);
    const series=R.M?[{xs,ys:xs.map(k=>pk(k,M)),color:COL.Z}]:[1,2,3,4].map(m=>({xs,ys:xs.map(k=>pk(k,m)),color:m===M?COL.Z:'#3a4f7c',width:m===M?2.5:1}));
    const P=plotSVG({h:260,xr:[0,kmax],yr:[0,1.05],xlabel:'Grover iterations k',ylabel:'success probability',series,points:lastRuns.map(x=>({x:x.k,y:pk(x.k,M),color:x.hit?COL.ok:COL.bad,r:5}))});
    body.appendChild(P.svg);
  } else body.appendChild(H('div',{cls:'quizbox'},`<div class="qq">Choose the number of Grover iterations</div><p class="small">Each iteration (oracle + inversion about the mean) rotates the state by 2θ toward the marked items, where sin θ = √(M/N). After k iterations, P(success) = sin²((2k+1)θ). Too many iterations <b>overshoot</b>.</p>`));
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(slider('Iterations k',0,Math.ceil(Math.PI/4*Math.sqrt(N))*2+2,1,s.k,v=>`${v}`,v=>{s.k=v;}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Run & measure',()=>{
      const p=pk(s.k,M), hit=rnd()<p; s.calls+=s.k+1; s.runs.push({r:s.r,k:s.k,hit});
      const best=R.M?Math.max(...Array.from({length:60},(_,k)=>pk(k,M))):Math.max(...Array.from({length:60},(_,k)=>[1,2,3,4].reduce((a,m)=>a+pk(k,m),0)/4));
      const mine=R.M?p:[1,2,3,4].reduce((a,m)=>a+pk(s.k,m),0)/4;
      if(mine>=0.85*best){ s.msg={t:`${hit?'✓ Found a marked item.':'✗ Unlucky measurement, but your k was right.'} ${R.M?`P = ${fmtP(p,0)}.`:`Expected success over M = 1–4: ${fmtP(mine,0)} (best possible ${fmtP(best,0)}). With M unknown you can't hit them all, so randomizing k (Boyer–Brassard–Høyer–Tapp) or quantum counting fixes this.`}`,c:hit?'good':'warn'}; s.r++; if(s.r>=GR_ROUNDS.length) completeLesson(lv,3-Math.min(2,s.extra)); }
      else { s.extra++; s.msg={t:`${hit?'Found one, but by luck: ':'✗ Missed: '}P(success) at k = ${s.k} is only ${fmtP(R.M?p:mine,0)}. Aim for (2k+1)θ ≈ π/2.`,c:'warn'}; }
      rerender(); },'pri'));
    card.appendChild(a);
    msgBox(card,s.msg);
    card.appendChild(H('div',{cls:'small mut',style:'margin-top:8px'},'Classically you need ~N/2M queries on average. Grover needs ~(π/4)√(N/M), and no quantum algorithm can do better: the BBBV lower bound (Preskill §6.7).'));
  } else { msgBox(card,s.msg); doneBox(card,lv,'Amplitude amplification mastered.'); }
};

/* ---------- Phase estimation ---------- */
KINDS.phaseest=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({phi:rnd(), t:3, budget:1000, outs:[], est:0.5, res:null}));
  const pm=(t,m)=>{ const T=1<<t, d=s.phi-m/T; if(Math.abs(Math.sin(Math.PI*d))<1e-12) return 1; return (Math.sin(Math.PI*T*d)/(T*Math.sin(Math.PI*d)))**2; };
  const body=simShell(C,lv,`Controlled-U applications left: <b>${s.budget}</b>`);
  const draw=()=>{
    body.innerHTML='';
    const pts=s.outs.map((o,i)=>({x:o.v,y:(i%12)+1,color:o.t>=7?COL.ok:o.t>=5?COL.gold:COL.mut,r:4}));
    const P=plotSVG({h:240,xr:[0,1],yr:[0,13],xlabel:'outcome m/2ᵗ (estimate of φ)',ylabel:'run #',points:pts,vlines:[{x:s.est,color:COL.gold,label:'your estimate'}].concat(s.res?[{x:s.phi,color:COL.ok,label:'true φ'}]:[]),yticks:[]});
    body.appendChild(P.svg);
    body.appendChild(H('div',{cls:'kv'},s.outs.slice(-8).map(o=>`<span>t=${o.t}: m/2ᵗ = ${o.v.toFixed(4)}</span>`).join('')||'<span class="mut">No runs yet.</span>'));
  };
  draw();
  const card=sidePanel(Rt,lv);
  card.appendChild(H('div',{cls:'small'},'U|ψ⟩ = e^{2πiφ}|ψ⟩ with φ unknown. Phase estimation with t control qubits applies U, U², U⁴, … (2ᵗ − 1 uses in total), then an inverse QFT. It outputs m with m/2ᵗ ≈ φ to t bits, <i>most</i> of the time. Goal: report φ within ±0.005.'));
  if(!s.res){
    card.appendChild(slider('Control qubits t',1,9,1,s.t,v=>`t = ${v} (costs ${(1<<v)-1} uses)`,v=>{s.t=v;}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn('Run phase estimation',()=>{ const T=1<<s.t, cost=T-1; if(cost>s.budget) return; let u=rnd(), m=0; for(;m<T-1;m++){ u-=pm(s.t,m); if(u<=0) break; } s.outs.push({t:s.t,v:m/T}); s.budget-=cost; rerender(); },'pri',((1<<s.t)-1)>s.budget));
    card.appendChild(a);
    card.appendChild(slider('Your estimate of φ',0,1,0.0005,s.est,v=>v.toFixed(4),v=>{s.est=v;draw();}));
    const b=H('div',{cls:'acts'});
    b.appendChild(btn('Report φ',()=>{ const e=Math.min(Math.abs(s.est-s.phi),1-Math.abs(s.est-s.phi)); s.res={e}; if(e<=0.005) completeLesson(lv, s.budget>=400?3:2); rerender(); },'pri'));
    card.appendChild(b);
  } else {
    const ok=s.res.e<=0.005;
    card.appendChild(H('div',{cls:'msg '+(ok?'good':'bad')},`True φ = ${s.phi.toFixed(4)}; error ${s.res.e.toFixed(4)}. ${ok?'Phase estimation is the engine inside Shor\'s algorithm and inside quantum chemistry energy estimation (§6.4, §6.8.2).':'Too few bits, or an unlucky outlier: repeat a high-t run to rule out the occasional off-by-a-lot result.'}`));
    if(ok) doneBox(card,lv,'Phase estimated.');
    else { const a=H('div',{cls:'acts'}); a.appendChild(btn('New unitary',()=>resetLesson(lv),'pri')); card.appendChild(a); }
  }
};

/* ---------- Stabilizer codes by table lookup ---------- */
const STAB_CODES=[
  {name:'Shor [[9,1,3]]', gens:['ZZIIIIIII','IZZIIIIII','IIIZZIIII','IIIIZZIII','IIIIIIZZI','IIIIIIIZZ','XXXXXXIII','IIIXXXXXX'], LX:'ZZZZZZZZZ', LZ:'XXXXXXXXX',
   note:'Three bit-flip codes nested inside a phase-flip code (§7.1). It is degenerate: Z₁ and Z₂ have the same effect on the code, so either correction works.'},
  {name:'Steane [[7,1,3]]', gens:['IIIXXXX','IXXIIXX','XIXIXIX','IIIZZZZ','IZZIIZZ','ZIZIZIZ'], LX:'XXXXXXX', LZ:'ZZZZZZZ',
   note:'A CSS code built from the classical [7,4,3] Hamming code (§7.7–7.8). The Z-check syndrome spells, in binary, the position of an X error. CSS codes correct X and Z errors separately, and the Steane code has transversal H, S and CNOT.'},
  {name:'Five-qubit [[5,1,3]]', gens:['XZZXI','IXZZX','XIXZZ','ZXIXZ'], LX:'XXXXX', LZ:'ZZZZZ',
   note:'The smallest code correcting any single-qubit error (§7.11). It is "perfect": its 2⁴ = 16 syndromes exactly match 1 + 3·5 = 16 correctable errors, saturating the quantum Hamming bound.'},
];
const pauliBits=str=>({x:[...str].map(c=>c==='X'||c==='Y'?1:0), z:[...str].map(c=>c==='Z'||c==='Y'?1:0)});
const symp=(a,b)=>{ let s=0; for(let i=0;i<a.x.length;i++) s^=(a.x[i]&b.z[i])^(a.z[i]&b.x[i]); return s; };
KINDS.stabtab=(C,Rt,lv)=>{
  const newErr=n=>{ const e={x:new Array(n).fill(0),z:new Array(n).fill(0)}; const q=Math.floor(rnd()*n), P=pick(['X','Y','Z']); if(P!=='Z') e.x[q]=1; if(P!=='X') e.z[q]=1; return e; };
  const s=lstate(lv,()=>({c:0, round:0, E:newErr(9), Cr:null, tool:'X', miss:0, revealed:null, msg:null}));
  const done=s.c>=STAB_CODES.length, code=STAB_CODES[Math.min(s.c,STAB_CODES.length-1)], n=code.gens[0].length;
  if(!s.Cr||s.Cr.x.length!==n) s.Cr={x:new Array(n).fill(0),z:new Array(n).fill(0)};
  const R={x:s.E.x.map((v,i)=>v^s.Cr.x[i]), z:s.E.z.map((v,i)=>v^s.Cr.z[i])};
  const gb=code.gens.map(pauliBits), syn=gb.map(g=>symp(g,R));
  const body=simShell(C,lv, done?'All three codes decoded':`<b>${code.name}</b> · error ${s.round+1}/3`);
  if(!done){
    const col=c=>c==='X'?COL.X:c==='Z'?COL.Z:c==='Y'?'#d68bff':'#3a4f7c';
    let tb='<table class="st tt stabt"><tr><th>generator</th>'+Array.from({length:n},(_,i)=>`<th>${i+1}</th>`).join('')+'<th>syndrome</th></tr>';
    code.gens.forEach((g,gi)=>{ tb+=`<tr><td class="mut">S${gi+1}</td>`+[...g].map(c=>`<td style="color:${col(c)};font-weight:${c==='I'?400:700}">${c}</td>`).join('')+`<td><span class="sbit ${syn[gi]?'on':''}">${syn[gi]?'−1':'+1'}</span></td></tr>`; });
    tb+=`<tr><td class="mut">fix</td>`+Array.from({length:n},(_,i)=>{ const p=pauliOf(s.Cr.x[i],s.Cr.z[i]); return `<td style="color:${COL.ok};font-weight:700">${p||'·'}</td>`; }).join('')+'<td></td></tr>';
    if(s.revealed) tb+=`<tr><td class="mut">error</td>`+Array.from({length:n},(_,i)=>{ const p=pauliOf(s.E.x[i],s.E.z[i]); return `<td style="color:${COL.bad};font-weight:700">${p||'·'}</td>`; }).join('')+'<td></td></tr>';
    tb+='</table>';
    const box=H('div',{style:'padding:12px 14px'}); box.innerHTML=tb; body.appendChild(box);
    const atoms=H('div',{cls:'qrow'});
    for(let i=0;i<n;i++) atoms.appendChild(btn(`q${i+1}`,()=>{ if(s.revealed) return; if(s.tool!=='Z') s.Cr.x[i]^=1; if(s.tool!=='X') s.Cr.z[i]^=1; rerender(); },'qbtn'));
    body.appendChild(atoms);
  }
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(H('div',{cls:'small'},`One random single-qubit Pauli error hit the block. A syndrome of −1 means the error anticommutes with that generator. Read the syndrome, pick a Pauli, then click a qubit to apply it.<br><span class="mut">${code.note}</span>`));
    const t=H('div',{cls:'tools'}); ['X','Z','Y'].forEach(P=>t.appendChild(btn(P,()=>{s.tool=P;rerender();},(s.tool===P?'on ':'')+'t'+P))); card.appendChild(t);
    const a=H('div',{cls:'acts'});
    if(!s.revealed) a.appendChild(btn('Submit correction',()=>{
      if(syn.some(v=>v)){ s.msg={t:'Some syndromes are still −1: your correction doesn\'t yet cancel the error\'s syndrome.',c:'warn'}; return rerender(); }
      const lx=symp(pauliBits(code.LX),R), lz=symp(pauliBits(code.LZ),R), ok=!lx&&!lz;
      if(!ok) s.miss++;
      const same=s.E.x.every((v,i)=>v===s.Cr.x[i])&&s.E.z.every((v,i)=>v===s.Cr.z[i]);
      s.revealed={ok}; s.msg={t:ok?(same?'✓ Exactly the error.':'✓ Different from the error, but they differ by a stabilizer: equivalent (degeneracy).'):'✗ Error × correction is a logical operator: the encoded qubit flipped. For a distance-3 code the unique minimal-weight fix is a single-qubit Pauli.',c:ok?'good':'bad'};
      rerender(); },'pri'));
    else a.appendChild(btn('Next →',()=>{ if(s.revealed.ok){ s.round++; } if(s.round>=3){ s.round=0; s.c++; }
      if(s.c<STAB_CODES.length){ const nn=STAB_CODES[s.c].gens[0].length; s.E=newErr(nn); s.Cr={x:new Array(nn).fill(0),z:new Array(nn).fill(0)}; } else completeLesson(lv,3-Math.min(2,s.miss));
      s.revealed=null; s.msg=null; rerender(); },'pri'));
    a.appendChild(btn('Clear fix',()=>{ s.Cr={x:new Array(n).fill(0),z:new Array(n).fill(0)}; rerender(); },'',!!s.revealed));
    card.appendChild(a);
    msgBox(card,s.msg);
  } else doneBox(card,lv,'Stabilizer decoding mastered.');
};

/* ---------- Bounds on code parameters ---------- */
const binomC=(n,k)=>{ let r=1; for(let i=0;i<k;i++) r=r*(n-i)/(i+1); return r; };
const hammingOK=(n,k,d)=>{ const t=Math.floor((d-1)/2); let s=0; for(let j=0;j<=t;j++) s+=binomC(n,j)*3**j; return 2**(n-k)>=s; };
const singletonOK=(n,k,d)=>n-k>=2*(d-1);
const BD_TASKS=[{k:1,d:3,ans:5,why:'n = 5 meets the Hamming bound with equality: 2⁴ = 16 = 1 + 3·5. The five-qubit code achieves it, a perfect code.'},
  {k:1,d:5,ans:10,why:'Singleton allows n = 9, but the (non-degenerate) Hamming bound needs 2⁹ ≥ 1 + 3·10 + 9·45 = 436, so n ≥ 10. The best known code is [[11,1,5]].'},
  {k:3,d:3,ans:8,why:'2⁵ = 32 ≥ 1 + 3·8 = 25 works and n = 7 fails (16 < 22). The [[8,3,3]] code (Preskill §7.13.3) achieves it.'}];
KINDS.bounds=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({k:0, n:5, miss:0, msg:null}));
  const done=s.k>=BD_TASKS.length, T=BD_TASKS[Math.min(s.k,BD_TASKS.length-1)];
  const body=simShell(C,lv, done?'All bounds explored':`Task <b>${s.k+1}/3</b>: smallest n for a [[n, ${T.k}, ${T.d}]] code allowed by both bounds`);
  const draw=()=>{
    body.innerHTML='';
    const ns=[]; for(let n=1;n<=20;n++) ns.push(n);
    const t=Math.floor((T.d-1)/2);
    const lhs=ns.map(n=>Math.log2(2**(n-T.k))), rhs=ns.map(n=>{ let s2=0; for(let j=0;j<=t;j++) s2+=binomC(n,j)*3**j; return Math.log2(s2); });
    const P=plotSVG({h:260,xr:[1,20],yr:[-2,20],xlabel:'block length n',ylabel:'log₂',series:[{xs:ns,ys:lhs,color:COL.Z},{xs:ns,ys:rhs,color:COL.X}],vlines:[{x:2*(T.d-1)+T.k,color:COL.er,dash:'5 4',label:'Singleton: n ≥ k + 2(d−1)'},{x:s.n,color:COL.gold,label:`n = ${s.n}`}],
      legend:[{label:'syndromes 2^(n−k)',color:COL.Z},{label:'correctable errors Σ C(n,j)3ʲ',color:COL.X}],xticks:[1,4,8,12,16,20]});
    body.appendChild(P.svg);
    body.appendChild(H('div',{cls:'kv'},`<span>[[${s.n}, ${T.k}, ${T.d}]]</span><span>Hamming: <b style="color:${hammingOK(s.n,T.k,T.d)?COL.ok:COL.bad}">${hammingOK(s.n,T.k,T.d)?'allowed':'violated'}</b></span><span>Singleton: <b style="color:${singletonOK(s.n,T.k,T.d)?COL.ok:COL.bad}">${singletonOK(s.n,T.k,T.d)?'allowed':'violated'}</b></span>`));
  };
  if(!done) draw();
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(H('div',{cls:'small'},'An [[n, k, d]] code puts k logical qubits into n physical ones and corrects ⌊(d−1)/2⌋ arbitrary errors. Two constraints (Preskill §7.9):<br>• <b>Quantum Hamming bound</b> (non-degenerate codes): every correctable error needs its own syndrome, 2^(n−k) ≥ Σ_{j≤t} C(n,j)·3ʲ.<br>• <b>Quantum Singleton bound</b>: n − k ≥ 2(d − 1), from no-cloning.'));
    card.appendChild(slider('Block length n',1,20,1,s.n,v=>`n = ${v}`,v=>{s.n=v;draw();}));
    const a=H('div',{cls:'acts'});
    a.appendChild(btn(`Claim n = ${s.n} is the smallest`,()=>{ if(s.n===T.ans){ s.msg={t:'✓ '+T.why,c:'good'}; s.k++; s.n=5; if(s.k>=BD_TASKS.length) completeLesson(lv,3-Math.min(2,s.miss)); } else { s.miss++; s.msg={t: hammingOK(s.n,T.k,T.d)&&singletonOK(s.n,T.k,T.d)?'Allowed, but a smaller n also satisfies both bounds.':'At least one bound is violated at this n.',c:'warn'}; } rerender(); },'pri'));
    card.appendChild(a);
  }
  msgBox(card,s.msg);
  if(done) doneBox(card,lv,'Code-parameter bounds understood.');
};

/* ---------- Concatenation and the threshold theorem ---------- */
const CC_TASKS=[{p:1e-3,pth:1e-2,target:1e-15},{p:5e-3,pth:1e-2,target:1e-12},{p:2e-2,pth:1e-2,target:1e-9}];
KINDS.concat=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({k:0, lev:1, d:5, phase:'concat', miss:0, msg:null}));
  const done=s.k>=CC_TASKS.length, T=CC_TASKS[Math.min(s.k,CC_TASKS.length-1)];
  const pL=L=>T.pth*Math.pow(T.p/T.pth,2**L), pS=d=>0.1*Math.pow(T.p/T.pth,(d+1)/2);
  const minL=(()=>{ if(T.p>=T.pth) return null; for(let L=0;L<12;L++) if(pL(L)<=T.target*(1+1e-9)) return L; return null; })();
  const minD=(()=>{ if(T.p>=T.pth) return null; for(let d=3;d<=201;d+=2) if(pS(d)<=T.target*(1+1e-9)) return d; return null; })();
  const body=simShell(C,lv, done?'Threshold theorem mastered':`Scenario <b>${s.k+1}/3</b>: p = ${T.p}, threshold p_th = ${T.pth}, target logical error ≤ ${T.target}`);
  const draw=()=>{
    body.innerHTML='';
    const Ls=[0,1,2,3,4,5,6,7];
    const P=plotSVG({h:250,xr:[0,7],yr:[-20,1],xlabel:'concatenation level L',ylabel:'log₁₀ logical error',xticks:Ls,
      series:[{xs:Ls,ys:Ls.map(L=>Math.max(-20,Math.log10(Math.min(1,pL(L))))),color:T.p<T.pth?COL.ok:COL.bad}],hlines:[{y:Math.log10(T.target),color:COL.gold,label:'target'}],points:[{x:s.lev,y:Math.max(-20,Math.log10(Math.min(1,pL(s.lev)))),color:'#fff',r:5}]});
    body.appendChild(P.svg);
    body.appendChild(H('div',{cls:'kv'},`<span>level ${s.lev}: p_L ≈ ${pL(s.lev).toExponential(1)}, ${7**s.lev} physical qubits per logical (Steane)</span><span>surface code d = ${s.d}: p_L ≈ ${pS(s.d).toExponential(1)}, ≈ ${2*s.d*s.d} qubits</span>`));
  };
  if(!done) draw();
  const card=sidePanel(Rt,lv);
  if(!done){
    card.appendChild(H('div',{cls:'small'},'Encode, then encode each physical qubit again. If one level maps p → p²/p_th, then L levels give p_L = p_th (p/p_th)^(2^L): doubly exponential suppression below threshold, at a cost of 7^L qubits for the Steane code. That is the <b>accuracy threshold theorem</b> (§7.17, §7.18.5). Compare with a surface code, where p_L ≈ 0.1 (p/p_th)^((d+1)/2).'));
    if(s.phase==='concat'){
      card.appendChild(slider('Concatenation level L',0,7,1,s.lev,v=>`L = ${v}`,v=>{s.lev=v;draw();}));
      const a=H('div',{cls:'acts'});
      a.appendChild(btn(`L = ${s.lev} is the minimum`,()=>{ if(minL!==null && s.lev===minL){ s.phase='surface'; s.msg={t:`✓ L = ${minL}: ${7**minL} qubits per logical qubit. Now the surface-code alternative.`,c:'good'}; } else { s.miss++; s.msg={t:minL===null?'No level works here.':pL(s.lev)>T.target*(1+1e-9)?'Not enough suppression yet.':'A lower level already suffices.',c:'warn'}; } rerender(); },'pri'));
      a.appendChild(btn('Impossible: above threshold',()=>{ if(minL===null){ s.msg={t:'✓ Above threshold every level of encoding makes things worse. Improve the hardware first.',c:'good'}; s.k++; s.lev=1; s.phase='concat'; if(s.k>=CC_TASKS.length) completeLesson(lv,3-Math.min(2,s.miss)); } else { s.miss++; s.msg={t:'p is below threshold here, so some level works.',c:'warn'}; } rerender(); }));
      card.appendChild(a);
    } else {
      card.appendChild(slider('Surface-code distance d',3,101,2,s.d,v=>`d = ${v}`,v=>{s.d=v;draw();}));
      const a=H('div',{cls:'acts'});
      a.appendChild(btn(`d = ${s.d} is the minimum`,()=>{ if(s.d===minD){ s.msg={t:`✓ d = ${minD}: about ${2*minD*minD} qubits, vs ${7**minL} for concatenated Steane. Surface codes also need only nearest-neighbour checks and tolerate higher error rates.`,c:'good'}; s.k++; s.lev=1; s.d=5; s.phase='concat'; if(s.k>=CC_TASKS.length) completeLesson(lv,3-Math.min(2,s.miss)); } else { s.miss++; s.msg={t:pS(s.d)>T.target*(1+1e-9)?'Not enough suppression yet.':'A smaller distance already suffices.',c:'warn'}; } rerender(); },'pri'));
      card.appendChild(a);
    }
  }
  msgBox(card,s.msg);
  if(done) doneBox(card,lv,'You can size a fault-tolerant computer.');
};

/* ---------- Levine et al. 2019: two-global-pulse CZ ---------- */
// One detuned pulse on a 2-level system (|1⟩, |r⟩): exact exp(−iHτ), H = [[0, Ω/2 e^{iφ}], [Ω/2 e^{−iφ}, −Δ]].
function pulse2(st, Om, D, tau, ph){
  const g=0.5*Math.hypot(Om,D), c=Math.cos(g*tau), sn=g>0?Math.sin(g*tau)/g:tau;
  const k01=[Om/2*Math.cos(ph), Om/2*Math.sin(ph)], k10=[Om/2*Math.cos(ph), -Om/2*Math.sin(ph)];
  const mi=z=>[z[1],-z[0]];                       // multiply by −i
  const a=st[0], b=st[1];
  const na=cadd([c*a[0],c*a[1]], mi(cadd([sn*D/2*a[0],sn*D/2*a[1]], cmul([sn*k01[0],sn*k01[1]],b))));
  const nb=cadd([c*b[0],c*b[1]], mi(cadd(cmul([sn*k10[0],sn*k10[1]],a), [-sn*D/2*b[0],-sn*D/2*b[1]])));
  const gp=[Math.cos(D*tau/2),Math.sin(D*tau/2)];   // global phase from the −Δ/2 shift
  return [cmul(gp,na), cmul(gp,nb)];
}
function levineGate(D, tau, xi){
  const run=Om=>pulse2(pulse2([[1,0],[0,0]],Om,D,tau,0),Om,D,tau,xi)[0];
  const a01=run(1), a11=run(Math.SQRT2);
  const th=Math.atan2(a01[1],a01[0]);
  const t=[[1,0],[Math.cos(th),Math.sin(th)],[Math.cos(th),Math.sin(th)],[-Math.cos(2*th),-Math.sin(2*th)]];
  const u=[[1,0],a01,a01,a11];
  let tr=[0,0], nn=0; for(let i=0;i<4;i++){ tr=cadd(tr,cmul(cconj(t[i]),u[i])); nn+=u[i][0]**2+u[i][1]**2; }
  const F=((tr[0]**2+tr[1]**2)+nn)/20;
  const cp=(((Math.atan2(a11[1],a11[0])-2*th)%TAU)+TAU)%TAU;
  return {a01,a11,F,cp,leak01:1-(a01[0]**2+a01[1]**2),leak11:1-(a11[0]**2+a11[1]**2)};
}
function levineBestXi(D,tau){ let best={F:-1,xi:0}; for(let i=0;i<720;i++){ const xi=i/720*TAU, g=levineGate(D,tau,xi); if(g.F>best.F) best={F:g.F,xi,g}; } return best; }
KINDS.levine=(C,Rt,lv)=>{
  const s=lstate(lv,()=>({D:0.6, tau:3.5, tries:0, hint:false, msg:null, done:false}));
  const body=simShell(C,lv,'Global pulses on both atoms · perfect blockade · units of Ω');
  const draw=()=>{
    body.innerHTML='';
    const b=levineBestXi(s.D,s.tau), g=b.g;
    // trajectories of |r⟩ population during the two pulses for |01⟩ and |11⟩
    const xs=[], p01=[], p11=[];
    for(let i=0;i<=120;i++){ const t=i/120*2*s.tau; xs.push(t);
      const pr=Om=>{ const st1=pulse2([[1,0],[0,0]],Om,s.D,Math.min(t,s.tau),0); const st=t<=s.tau?st1:pulse2(st1,Om,s.D,t-s.tau,b.xi); return st[1][0]**2+st[1][1]**2; };
      p01.push(pr(1)); p11.push(pr(Math.SQRT2)); }
    const P=plotSVG({h:250,xr:[0,2*s.tau],yr:[0,1.05],xlabel:'time (units of 1/Ω)',ylabel:'Rydberg population',series:[{xs,ys:p01,color:COL.Z},{xs,ys:p11,color:COL.X}],
      vlines:[{x:s.tau,color:COL.gold,dash:'4 3',label:`laser phase jump ξ = ${b.xi.toFixed(2)} rad`}],legend:[{label:'|01⟩: one atom drives |1⟩↔|r⟩',color:COL.Z},{label:'|11⟩: blockaded pair, Ω→√2Ω',color:COL.X}]});
    body.appendChild(P.svg);
    body.appendChild(H('div',{cls:'kv'},`<span>Δ = <b>${s.D.toFixed(3)}</b> Ω</span><span>pulse length τ = <b>${s.tau.toFixed(3)}</b>/Ω</span><span>left in |r⟩: |01⟩ ${fmtP(g.leak01,2)}, |11⟩ ${fmtP(g.leak11,2)}</span><span>conditional phase <b>${(g.cp*180/Math.PI).toFixed(1)}°</b></span><span>CZ fidelity (best ξ) <b style="color:${g.F>0.995?COL.ok:COL.gold}">${fmtP(g.F,2)}</b></span>`));
  };
  draw();
  const card=sidePanel(Rt,lv);
  card.appendChild(H('div',{cls:'small'},'Two identical detuned pulses hit <b>both</b> atoms. Between them, the laser phase jumps by ξ, which is optimized automatically for each setting. Find the detuning Δ and pulse length τ where both |01⟩ and |11⟩ return fully to the ground state and |11⟩ picks up an extra π. Then CZ fidelity reaches > 99.5%.'));
  card.appendChild(slider('Detuning Δ/Ω',0,1,0.001,s.D,v=>v.toFixed(3),v=>{s.D=v;draw();}));
  card.appendChild(slider('Pulse length τΩ',2,7,0.005,s.tau,v=>v.toFixed(3),v=>{s.tau=v;draw();}));
  const a=H('div',{cls:'acts'});
  a.appendChild(btn('Run gate & measure fidelity',()=>{ const b=levineBestXi(s.D,s.tau); s.tries++;
    if(b.F>0.995){ s.done=true; completeLesson(lv, s.hint?2:3); s.msg={t:`✓ F = ${fmtP(b.F,2)} at Δ = ${s.D.toFixed(3)}Ω, τ = ${s.tau.toFixed(3)}/Ω, ξ = ${b.xi.toFixed(2)} rad. Levine et al. found Δ ≈ 0.377Ω, τ ≈ 4.29/Ω (total 2.73π/Ω), ξ ≈ 3.90 rad, and measured F ≥ 97.4% on five atom pairs <b>in parallel</b>. No individual addressing is needed.`,c:'good'}; }
    else s.msg={t:`F = ${fmtP(b.F,1)}. ${b.g.leak01>0.01||b.g.leak11>0.01?'Population is still left in the Rydberg state: change τ to close the loops.':'Both states return, but the conditional phase is off π. Adjust Δ.'}`,c:'warn'};
    rerender(); },'pri'));
  if(!s.hint&&!s.done) a.appendChild(btn('Hint',()=>{ s.hint=true; s.msg={t:'Look for Δ a bit below 0.4 Ω and τ a bit above 4/Ω.'}; rerender(); }));
  card.appendChild(a);
  msgBox(card,s.msg);
  if(s.done){
    const q=miniQ(card,s,'tof','The same paper extended the idea to three atoms. What gate did they demonstrate?',['A SWAP','A three-qubit Toffoli (controlled-controlled-phase) using blockade among three atoms','A Grover search','A teleportation'],1,'Atoms within one blockade radius of each other share the constraint. Native multi-qubit gates save many two-qubit gates in compiled circuits.');
    if(q) doneBox(card,lv,'You designed the gate behind modern neutral-atom processors.');
  }
};

/* ================================================================
   Syllabus
   ================================================================ */
const Q = id => ({...QEC_LEVELS.find(l=>l.id===id), id:'q'+id});
const UNITS=[
 {t:'Atoms & tweezers', ls:[
  {id:'tweezers', kind:'loading', title:'Optical tweezers',
   brief:`<p>A tightly focused, <b>red-detuned</b> laser beam pulls atoms toward its intensity maximum: an optical tweezer (dipole trap) about 1 µm wide. Laser-cooled atoms (~10 µK) from a magneto-optical trap fall in.</p>
   <p>Tweezers come in arrays made by acousto-optic deflectors (AODs) or spatial light modulators (SLMs). The Caltech group trapped over 6,100 atoms in about 12,000 sites (Manetsch et al. 2025).</p>
   <p><b>Try it:</b> load a 10×10 array several times and watch the statistics.</p>`},
  {id:'rearrange', kind:'rearrange', title:'Assembling defect-free arrays',
   brief:`<p>Image the array, find the empty sites, and use a <b>moving tweezer</b> to drag atoms into the pattern you want. Then image again to verify (Barredo et al. 2016; Endres et al. 2016).</p>
   <p>Every move takes time and risks losing the atom: heating during transport, plus background-gas collisions. Real control software plans moves to minimize total distance, and AODs move many atoms in parallel.</p>
   <p><b>Goal:</b> fill the gold 4×4 square with as little total travel as possible.</p>`},
  {id:'quiz-atoms', kind:'quiz', title:'Checkpoint: atoms & tweezers', brief:'<p>Six questions on trapping and loading.</p>', qs:[
   {q:'Tweezer light is red-detuned (lower frequency) from the atomic transition. What does that do?',o:['Pushes atoms away from the focus','Pulls atoms toward the intensity maximum','Heats atoms until they are ejected','Has no effect on ground-state atoms'],a:1,why:'Below resonance, the induced dipole follows the field in phase, so the energy is lowered where intensity is highest. The focus becomes a potential well.'},
   {q:'A 1000-site array loads each site with 50% probability. About how many atoms load per shot?',o:['~50','~500','~1000','exactly 500'],a:1,why:'On average 500, with binomial fluctuations of about ±16. That\'s why rearrangement exists.'},
   {q:'What mostly limits how long an atom stays trapped in a room-temperature vacuum?',o:['Gravity','Collisions with background gas','Spontaneous decay of the qubit','Photon recoil from the trap laser'],a:1,why:'Hot background molecules knock atoms out. Good vacuum gives trap lifetimes of minutes (~23 min in Manetsch et al. 2025).'},
   {q:'Why do AOD-based rearrangements move atoms in parallel batches?',o:['AOD tones address whole rows/columns at once, so many atoms translate together','To save laser power','Atoms must always move in pairs','The SLM requires it'],a:0,why:'Each AOD frequency tone makes one row or column of moving tweezers. Driving several tones moves a grid of atoms at once, but tones must not cross during a move.'},
   {q:'Compared with quantum-gas microscopes (atoms in optical lattices), what do tweezer arrays add?',o:['Nothing','Arbitrary, reconfigurable geometries assembled atom by atom, with single-site addressing and spacings matched to the blockade radius','Lower temperatures only','Bosonic statistics'],a:1,why:'Browaeys & Lahaye (2020): lattices give sub-µm spacing and many atoms, while tweezers give programmable geometry (kagome, ruby, 3D) with few-µm spacing, ideal for Rydberg interactions.'},
   {q:'How did Chiu et al. (2025) keep a 3,000-atom array running for over two hours?',o:['By never measuring it','Continuously reloading atoms from reservoirs into tweezers while stored qubits stay coherent','By cooling to millikelvin in a dilution fridge','By using ions instead of atoms'],a:1,why:'Optical-lattice conveyor belts bring fresh atoms, refilling the array at ~300 000 atoms/s without disturbing stored qubits.'},
  ]},
 ]},
 {t:'The qubit', ls:[
  Q('1.1'),
  {id:'spectro', kind:'spectro', title:'Finding the resonance',
   brief:`<p>Before any gate, you must know the qubit frequency precisely. For Rb-87 that's the 6.8 GHz hyperfine clock transition between |F=1, m=0⟩ and |F=2, m=0⟩. Trap light shifts it slightly, and nobody tells you by how much.</p>
   <p>Drive a π-pulse at a guessed frequency and measure P(|1⟩). Off resonance by Δ, the peak excitation drops to Ω²/(Ω²+Δ²).</p>
   <p>You have <b>14 measurements</b>. Choose where, and with which pulse strength, to locate the line within ±4 kHz.</p>`},
  {id:'bloch', kind:'bloch', title:'Steering on the Bloch sphere',
   brief:`<p>A resonant pulse rotates the qubit about an axis on the equator. The <b>pulse area</b> (Ω·t) sets the angle and the <b>laser phase</b> sets the axis. Z rotations are "virtual": just re-reference the phase of later pulses.</p>
   <p>Complete five steering tasks with the fewest pulses.</p>`},
  {id:'ramsey', kind:'ramsey', title:'Dephasing & spin echo',
   brief:`<p>In a Ramsey experiment (π/2, wait, π/2), each atom's phase drifts at its own detuning. Differences come from trap depth, temperature and magnetic noise, so the ensemble dephases. That decay time is T₂*.</p>
   <p>A π-pulse halfway <b>reverses</b> the phase evolution, so static differences cancel: a spin echo. More pulses (dynamical decoupling, CPMG) also filter slowly fluctuating noise. Each pulse has a small error, though.</p>
   <p>With echoes and careful trap design, hyperfine qubits reach coherence times of ~12.6 s (Manetsch et al. 2025).</p>`},
  {id:'readout', kind:'readout', title:'Reading out with photons',
   brief:`<p>Readout: atoms in |0⟩ are removed or shelved dark, and resonant light makes the remaining |1⟩ atoms fluoresce. A camera counts photons.</p>
   <p>Only a few percent of scattered photons are collected, and counts are <b>Poisson-random</b>. Scattering also heats atoms, which can boil them out of the trap.</p>
   <p>Pick exposure and threshold to hit <b>≤ 0.6% misread with ≤ 0.6% loss</b>. State-of-the-art arrays achieve imaging fidelity above 99.99%.</p>`},
  {id:'quiz-qubit', kind:'quiz', title:'Checkpoint: the qubit', brief:'<p>Five questions on qubit control.</p>', qs:[
   {q:'Why are qubits stored in m = 0 "clock" states?',o:['They are the lowest energy states','Their splitting is insensitive to magnetic fields to first order','They cannot be excited to Rydberg states','They scatter no light'],a:1,why:'m = 0 → m = 0 transitions have no linear Zeeman shift, so magnetic-field noise barely dephases them.'},
   {q:'Detuned by Δ with Rabi frequency Ω, the maximum excitation probability is…',o:['1','Ω/Δ','Ω²/(Ω²+Δ²)','Δ²/(Ω²+Δ²)'],a:2,why:'The generalized Rabi oscillation has amplitude Ω²/(Ω²+Δ²) at frequency √(Ω²+Δ²).'},
   {q:'A single spin-echo π-pulse removes which noise?',o:['Fast noise that changes within the sequence','Static (or slow) detuning differences','Spontaneous decay (T₁)','Atom loss'],a:1,why:'Static phase gained before the echo is undone after it. Noise that changes during the sequence needs more pulses, and decay is never undone.'},
   {q:'Measuring |+⟩ 1000 times gives…',o:['1000 random outcomes, about half 0 and half 1','Always 0','Always 1','A value of ½ every time'],a:0,why:'Each projective measurement is random with P = ½. Only the statistics are predictable.'},
   {q:'How is a "virtual Z" gate implemented?',o:['A microwave π pulse','Shifting the phase of all subsequent drive pulses in software','Moving the atom','Turning off the trap'],a:1,why:'Rotating the reference frame is free, instantaneous and perfect, so Z gates cost nothing.'},
  ]},
 ]},
 {t:'Rydberg interactions', ls:[
  {id:'twophoton', kind:'twophoton', title:'Exciting Rydberg states',
   brief:`<p>Rb ground-state atoms are excited to Rydberg states with <b>two photons</b>: 420 nm to the 6P₃/₂ intermediate level and 1013 nm onward to nS (or 480 + 780 nm via 5P in older setups). Both lasers are detuned by Δ from the short-lived intermediate state, so it's barely populated.</p>
   <p>Experimental knobs: Δ, both beam powers, and the laser frequency. Each beam also AC-Stark-shifts the levels, which moves the resonance you must hit.</p>
   <p>Calibrate a low-error π-pulse on three different setups.</p>
   <p class="cite">Saffman, Walker & Mølmer 2010 (RMP); Levine et al. 2019; Browaeys & Lahaye 2020.</p>`},
  {id:'blockade', kind:'blockade', title:'The Rydberg blockade',
   brief:`<p>A Rydberg atom (n ≈ 50–100) has an electron orbiting hundreds of nanometres out. Two Rydberg atoms interact by the van der Waals force: V(r) = C₆/r⁶, with C₆ ∝ n¹¹.</p>
   <p>When V ≫ Ω, the doubly excited state is shifted out of resonance. Only <b>one</b> atom can be excited: the <b>Rydberg blockade</b> (Jaksch et al. 2000; Lukin et al. 2001; first seen by Urban et al. and Gaëtan et al. 2009).</p>
   <p>Drag the atoms apart and together, then answer the tasks.</p>`},
  {id:'superatom', kind:'superatom', title:'Superatoms: one excitation shared by N atoms',
   brief:`<p>Put N atoms inside one blockade sphere. The laser can only create the symmetric single excitation (|r g g…⟩ + |g r g…⟩ + …)/√N, and it does so √N times faster than for one atom.</p>
   <p>Lukin et al. (2001) proposed using such <b>mesoscopic ensembles</b> as collective qubits, entanglers and single-photon sources. In the lab, measuring the √N speed-up is the standard proof of blockade (Gaëtan et al. 2009 for N = 2; later ensemble experiments for larger N).</p>
   <p>A cloud holds an unknown number of atoms. Measure its collective Rabi oscillation (12 measurements, shot noise included) and work out N.</p>`},
  {id:'lossdet', kind:'lossdet', title:'Detecting Rydberg atoms: loss & SPAM',
   brief:`<p>How do you see a Rydberg atom? Most array experiments don't image it directly. They switch the tweezers off during the Rydberg pulse and back on afterwards. Ground-state atoms are recaptured; Rydberg atoms are pushed away or ionized and <b>go missing</b>.</p>
   <p>The method is imperfect, so every Rydberg dataset needs a <b>state-preparation-and-measurement (SPAM)</b> correction. This is how the first two-atom blockade experiments (Urban et al. 2009 with 79D atoms about 10 µm apart; Gaëtan et al. 2009 at 4 µm) and later many-body experiments were analysed.</p>
   <p>You have 600 calibration shots. Recover the true π-pulse transfer.</p>
   <p class="cite">Browaeys & Lahaye 2020; Urban et al. 2009.</p>`},
  {id:'rydlevel', kind:'rydlevel', title:'Choosing the Rydberg level',
   brief:`<p>Which Rydberg state should your CZ gate use? Every choice trades one error for another: decay, imperfect blockade, atom motion (Doppler), Stark shifts from stray electric fields, and laser scattering.</p>
   <p>Rb is typically excited in two photons (420 nm + 1013 nm). The model here is a simplified error budget with realistic scalings (Saffman, Walker & Mølmer 2010).</p>
   <p>Each day the stray field changes. <b>Tune n and laser power</b> for a near-optimal gate on three days.</p>`},
  {id:'quiz-ryd', kind:'quiz', title:'Checkpoint: Rydberg physics', brief:'<p>Eight questions on Rydberg atoms and how they are measured.</p>', qs:[
   {q:'How does the van der Waals coefficient C₆ scale with principal quantum number n?',o:['n²','n⁴','n⁷','n¹¹'],a:3,why:'Dipole moments ∝ n² and energy spacings ∝ n⁻³ give C₆ ∝ n¹¹. That\'s why Rydberg atoms interact over micrometres.'},
   {q:'The blockade radius R_b is where the interaction equals the drive. So R_b equals…',o:['C₆/Ω','(C₆/Ω)^{1/6}','√(C₆ Ω)','Ω/C₆'],a:1,why:'Setting C₆/R⁶ = ħΩ gives R_b = (C₆/ħΩ)^{1/6}.'},
   {q:'Doubling the Rabi frequency Ω changes the blockade radius by…',o:['×2','×0.5','×2^(−1/6) ≈ 0.89','no change'],a:2,why:'The 1/6 power makes R_b very insensitive to Ω.'},
   {q:'Why not simply use n = 150 for an enormous blockade?',o:['Such states don\'t exist','Polarizability ∝ n⁷ makes it fragile to stray fields, and laser coupling ∝ n^(−3/2) gets weak','The atom would become an ion','Lifetime gets shorter with n'],a:1,why:'Lifetime actually grows with n, but field sensitivity and weak coupling dominate. Most gates use n ≈ 50–80.'},
   {q:'Two blockaded atoms driven together oscillate between |gg⟩ and (|gr⟩+|rg⟩)/√2 at…',o:['Ω','√2·Ω','2Ω','Ω/2'],a:1,why:'Collective enhancement: N blockaded atoms share one excitation at √N·Ω.'},
   {q:'Two atoms in the same nS state interact via C₆/r⁶. An nS–nP pair interacts via…',o:['C₆/r⁶ as well','Resonant dipole–dipole exchange C₃/r³, which hops an excitation (XY model)','No interaction','Gravity'],a:1,why:'Browaeys & Lahaye (2020): van der Waals shifts give an Ising model, and resonant dipolar flip-flops give an XY model. The choice of Rydberg states picks the spin model.'},
   {q:'Why does Rydberg excitation use two photons with a large intermediate detuning Δ?',o:['Single-photon UV lasers at ~297 nm are hard; detuning suppresses scattering from the short-lived intermediate state','To make the atoms hotter','Two photons double the blockade radius','It is required by selection rules for every state'],a:0,why:'Scattering ∝ Ω²/Δ² falls faster than Ω_eff = Ω₁Ω₂/2Δ, so a large Δ with enough power wins. Some groups do use direct UV excitation to P states.'},
   {q:'Rydberg atoms are most often detected by…',o:['Seeing them glow brighter','Their loss: they are not recaptured when the tweezers turn back on','Weighing the array','Measuring their spin with a magnet'],a:1,why:'Loss-based detection needs SPAM correction: ε (ground atoms lost anyway) and ε′ (Rydberg atoms that decay and get recaptured).'},
  ]},
 ]},
 {t:'Entangling gates', ls:[
  {id:'gateerr', kind:'gateerr', title:'How good can a blockade gate be?',
   brief:`<p>Jaksch et al. (2000) proposed fast (~µs) neutral-atom gates using Rydberg interactions. The <b>blockade gate</b> only needs the interaction B to be much larger than the drive Ω, not precisely known, so position jitter of the atoms barely matters.</p>
   <p>What limits it fundamentally? Find the optimal Rabi frequency for three combinations of blockade shift B and Rydberg lifetime τ, then spot the scaling law.</p>
   <p class="cite">Jaksch et al. 2000; Saffman, Walker & Mølmer 2010.</p>`},
  {id:'czbuild', kind:'czbuild', title:'Build a CZ gate',
   brief:`<p>The blockade turns into a gate: the controlled-Z. Only |1⟩ couples to the Rydberg state |r⟩. A full 2π Rabi cycle returns an atom to |1⟩ with a <b>−1 sign</b>, unless the blockade stops it.</p>
   <p>Assemble a pulse sequence on atoms A and B that leaves no population in |r⟩ and gives an entangling phase of 180°.</p>
   <p class="cite">Jaksch et al. 2000; Levine et al. 2019; Evered et al. 2023.</p>`},
  {id:'levine', kind:'levine', title:'The two-pulse global CZ (Levine 2019)',
   brief:`<p>The Jaksch protocol needs light focused on each atom separately. Levine et al. (2019) found a CZ made of <b>two global laser pulses</b> that hit both atoms identically, with a laser phase jump ξ in between. Because no atom is singled out, every pair in the entangling zone gets the gate simultaneously.</p>
   <p>The trick: a detuned pulse drives |01⟩ (Rabi Ω) and |11⟩ (blockaded, Rabi √2Ω) around different closed loops, accumulating different phases. Choose Δ and τ so both loops close and the phases differ by π.</p>
   <p>Experimental details from the paper: Rb atoms excited to a Rydberg state with 420 + 1013 nm light; F ≥ 97.4% after SPAM correction, raw Bell fidelity ≈ 95%, gates run in parallel on five pairs; and a three-atom Toffoli.</p>
   <p class="cite">Levine et al., PRL 123, 170503 (2019).</p>`},
  {id:'firstent', kind:'firstent', title:'2010: the first Rydberg gates in the lab',
   brief:`<p>In 2010 two back-to-back PRLs showed the first neutral-atom entanglement via Rydberg blockade:</p>
   <p>• <b>Isenhower et al.</b> (Wisconsin): a CNOT between two atoms more than 8 µm apart, with truth-table fidelity ≈ 0.73.<br>• <b>Wilk et al.</b> (Institut d'Optique): entanglement of two atoms 4 µm apart, using collective blockade excitation, F = 0.75 after loss correction.</p>
   <p>Reproduce both measurement methods with realistic atom loss, and decide what the data really prove.</p>`},
  {id:'bell', kind:'bell', title:'Certify entanglement',
   brief:`<p>You prepared what should be a Bell state. But was it entangled, or just classically correlated? You have <b>600 shots</b> per state, measured in batches of 100 in the ZZ, XX or YY basis.</p>
   <p>The Bell-state fidelity F = (1 + ⟨ZZ⟩ + ⟨XX⟩ − ⟨YY⟩)/4 certifies entanglement when F > ½. Every outcome is random, so error bars matter.</p>
   <p>Three mystery states. Judge each one.</p>`},
  {id:'quiz-gates', kind:'quiz', title:'Checkpoint: gates', brief:'<p>Seven questions on Rydberg gates.</p>', qs:[
   {q:'In the π–2π–π protocol, why does |11⟩ behave differently from |01⟩?',o:['The control in |r⟩ blockades the target, so the target\'s 2π pulse (and its −1) never happens','|11⟩ is not coupled to the laser','The target decays','It doesn\'t; all states get the same phase'],a:0,why:'|01⟩ gets −1 from the target\'s 2π cycle, |10⟩ gets −1 from the control\'s two π pulses, and |11⟩ gets only the control\'s −1. The net conditional phase is π.'},
   {q:'What was special about the Levine et al. (2019) gate?',o:['It needed no lasers','It used two global pulses on both atoms, so no individual addressing was needed (fidelity ≥ 97.4%)','It worked without the blockade','It entangled 100 atoms at once'],a:1,why:'Global pulses with a phase jump made gates parallel across many pairs at once.'},
   {q:'Which statement about a measured Bell fidelity F is correct?',o:['F > ½ certifies entanglement','F > 0 certifies entanglement','Perfect ⟨ZZ⟩ correlations alone certify entanglement','Only F = 1 is entangled'],a:0,why:'Separable states have F ≤ ½ with any maximally entangled target. Correlations in one basis can be classical.'},
   {q:'Why are CZ plus single-qubit rotations enough for any computation?',o:['They form a universal gate set','They are the only gates atoms allow','CZ is its own inverse','They are transversal'],a:0,why:'Any unitary can be approximated with an entangling gate plus arbitrary single-qubit gates.'},
   {q:'Parallel CZ gates on neutral atoms reached what fidelity in 2023 (Evered et al.)?',o:['90%','97%','99.5%','99.99%'],a:2,why:'99.5% across 60 atoms in parallel, at or above the surface-code threshold.'},
   {q:'In the Levine et al. (2019) gate, what does the laser phase jump ξ between the two global pulses do?',o:['Nothing; it is a calibration artefact','It makes both the single-atom (|01⟩) and blockaded (|11⟩) trajectories close back on the ground state, while their accumulated phases differ by π','It turns the blockade off','It selects which atom is the control'],a:1,why:'With Δ ≈ 0.377Ω, τ ≈ 4.29/Ω and ξ ≈ 3.90 rad, both loops close, and the dynamical phases give a CZ up to single-qubit Z rotations, applied in parallel to every pair.'},
   {q:'The intrinsic blockade-gate error (Rydberg decay + leakage into |rr⟩) is minimized at a finite Ω and scales as…',o:['(Bτ)^(−2/3)','(Bτ)^(−2)','independent of B','e^(−Bτ)'],a:0,why:'Balancing 7π/(4Ωτ) against Ω²/(8B²) gives E_min ∝ (Bτ)^(−2/3) (Saffman, Walker & Mølmer 2010).'},
   {q:'Wilk et al. and Isenhower et al. (2010) only exceeded F = ½ after correcting for atom loss. What did the field fix next?',o:['Nothing; loss is irrelevant','Atom loss and Rydberg-laser noise, leading to deterministic entanglement and today\'s >99.5% gates','They switched to ions','They removed the blockade'],a:1,why:'Better vacuum, colder atoms, cleaner lasers and loss-aware protocols turned post-corrected entanglement into deterministic, high-fidelity gates.'},
  ]},
 ]},
 {t:'Architecture', ls:[
  {id:'schedule', kind:'schedule', title:'Zoned architecture & scheduling',
   brief:`<p>Modern processors split the array into zones. Atoms sit in a <b>storage</b> zone, move into an <b>entangling</b> zone for gates, and go to a <b>readout</b> zone for mid-circuit measurement. A single global Rydberg pulse performs every CZ in the entangling zone at once.</p>
   <p>Schedule three circuits with the fewest pulses: each pulse costs transport time and Rydberg errors.</p>
   <p class="cite">Bluvstein et al. 2022 (coherent transport), 2024 (logical processor).</p>`},
  {id:'quiz-arch', kind:'quiz', title:'Checkpoint: architecture', brief:'<p>Five questions on processor design.</p>', qs:[
   {q:'Why keep idle qubits in a separate storage zone?',o:['They are shielded from the global Rydberg beam, avoiding unwanted gates and errors','Storage is colder','To make them easier to image','Regulations require it'],a:0,why:'Global pulses hit everything in the entangling zone. Idle atoms are parked away from it.'},
   {q:'How can atoms be moved without destroying their qubit state?',o:['They can\'t','The qubit is in internal states; moving the trap smoothly barely disturbs them','By turning the trap off and catching them','By measuring them first'],a:1,why:'Transport is a slow (adiabatic) translation of the trap. The hyperfine coherence survives (Bluvstein et al. 2022).'},
   {q:'Why is atom loss worse than an ordinary error?',o:['It isn\'t','The qubit disappears entirely, checks touching it become random, and it must be detected and replaced','Lost atoms explode','It only happens at high n'],a:1,why:'Loss leaves a hole in the code. It\'s detectable, so it can be treated as an erasure once replaced.'},
   {q:'Surface-code syndrome extraction in a zoned processor needs how many CZ layers per round?',o:['d²','2d','4, regardless of distance','1'],a:2,why:'Each check atom has ≤ 4 data neighbours. All checks run in parallel in 4 layers.'},
   {q:'What is the main reason neutral atoms scale well to thousands of qubits?',o:['Identical atoms; arrays made by optics; long coherence; reconfigurable connectivity','They need no lasers','They work at room temperature with no vacuum','Each atom has 100 qubits'],a:0,why:'Nature makes every atom identical, and tweezers scale with optics: 6100 sites (Caltech 2025) and continuous 3000-atom operation (Harvard 2025).'},
  ]},
 ]},
 {t:'Analog quantum simulation', ls:[
  {id:'sweep', kind:'sweep', title:'Adiabatic preparation of order',
   brief:`<p>Without breaking the computation into gates, you can let the array evolve under its native Hamiltonian:</p>
   <p style="text-align:center">H = Σ Ω/2 σˣ − Σ Δ n + Σ V<sub>ij</sub> n<sub>i</sub>n<sub>j</sub></p>
   <p>Start with all atoms in |g⟩ at Δ < 0 (the ground state), then sweep Δ positive. If the sweep is slow compared with the energy gap, the chain follows the ground state into the antiferromagnetic <b>Z₂ order</b> r g r g r. That was the 51-atom simulator of Bernien et al. (2017).</p>
   <p>Exact simulation of 9 atoms here (89 blockade-allowed states). Snapshots sample the quantum state at random. Goal: P(Z₂) ≥ 50% <i>after</i> Rydberg decay, which punishes slow sweeps.</p>`},
  {id:'mis', kind:'mis', title:'Solving MIS with atoms',
   brief:`<p>Place atoms on the vertices of a graph so that edges = pairs within the blockade radius (a <b>unit-disk graph</b>). The Rydberg ground state at large Δ is then the graph's <b>maximum independent set</b>, an NP-hard optimization problem.</p>
   <p>Ebadi et al. (2022) ran this on up to 289 atoms. First solve it yourself, then let the quantum sweep do it.</p>`},
  {id:'dimer', kind:'dimer', title:'Spin liquids from frustrated blockade',
   brief:`<p>Semeghini et al. (2021) placed 219 atoms on the <b>links of a kagome lattice</b> (a ruby lattice). The blockade radius covers all links that meet at a vertex, so a Rydberg excitation acts as a <b>dimer</b>, and each vertex can touch at most one dimer.</p>
   <p>Near dimer density ¼ the ground state becomes a quantum superposition of dimer coverings: a toric-code-type <b>topological spin liquid</b>, with no local order at all.</p>
   <p>First, build a maximal dimer covering yourself.</p>`},
  {id:'quiz-analog', kind:'quiz', title:'Checkpoint: analog simulation', brief:'<p>Six questions on analog simulation.</p>', qs:[
   {q:'In H = Σ Ω/2 σˣ − Σ Δ n + Σ V nn, what does positive Δ favour?',o:['Atoms in the ground state','Rydberg excitations','Larger interactions','Atom loss'],a:1,why:'−Δ·n lowers the energy of each excitation when Δ > 0. The interactions then decide which arrangement wins.'},
   {q:'Sweeping too fast leaves…',o:['A perfect ordered state','Defects (domain walls), as predicted by Kibble–Zurek scaling','A lower temperature','Nothing; speed is irrelevant'],a:1,why:'Near the minimum gap the system can\'t follow adiabatically, so it freezes in with defects whose density depends on sweep rate.'},
   {q:'Why does the Rydberg ground state at large Δ encode MIS on a unit-disk graph?',o:['Δ rewards every excitation, and the blockade forbids neighbouring excitations','Because atoms like graphs','It is random','Only for 1D chains'],a:0,why:'Maximize the number of excitations subject to no two adjacent: that\'s exactly MIS.'},
   {q:'Bernien et al. (2017) observed persistent oscillations after quenching to the Z₂ state. These are…',o:['Quantum many-body scars','Rabi oscillations of one atom','Lasers turning on and off','Atom loss'],a:0,why:'Special non-thermalizing eigenstates ("scars") cause revivals, a discovery made on this platform.'},
   {q:'In the ruby-lattice spin liquid, a single snapshot shows…',o:['A perfect checkerboard','A dimer covering. The topological order lives in superpositions of coverings, so it shows up only in loop (string) correlations','Nothing, the atoms are gone','A ferromagnet'],a:1,why:'Topological phases have no local order parameter. Semeghini et al. measured closed-loop string operators in two bases.'},
   {q:'Browaeys & Lahaye (2020) describe the steps of every Rydberg simulation run. Which order is right?',o:['Load & rearrange → optically pump to |g⟩ → Rydberg pulse sequence → image (loss = Rydberg)','Image → load → excite','Excite → load → rearrange','Ionize → load → image'],a:0,why:'Each shot takes a fraction of a second, and thousands of shots build up statistics and snapshots.'},
  ]},
 ]},
 {t:'Atom–photon interfaces', ls:[
  {id:'eit', kind:'eit', title:'Stopping light in an atomic ensemble',
   brief:`<p>A strong <b>control</b> beam turns an opaque atomic cloud transparent for a weak <b>probe</b> in a narrow window: electromagnetically induced transparency (EIT), from destructive interference into a dark state.</p>
   <p>Inside the window the probe slows dramatically. Turning the control off <b>maps the photon onto a collective spin excitation</b> (a dark-state polariton), and turning it back on releases it (Lukin, RMP 2003).</p>
   <p>Replace the storage level with a Rydberg state and blockade makes photons interact one by one. That links Rydberg arrays to photonic quantum networks.</p>
   <p>Tune the control field to store pulses in three ensembles.</p>`},
  {id:'quiz-photon', kind:'quiz', title:'Checkpoint: atoms & photons', brief:'<p>Five questions on light–matter interfaces.</p>', qs:[
   {q:'Why does EIT make an absorbing medium transparent?',o:['The control beam heats atoms out of the beam','Two excitation pathways interfere destructively, leaving atoms in a dark state that does not absorb','The probe changes wavelength','The atoms are ionized'],a:1,why:'The probe-coupled and control-coupled amplitudes cancel in the excited state, so nothing scatters on two-photon resonance.'},
   {q:'How is a light pulse "stopped" in an atomic ensemble?',o:['With mirrors','By adiabatically switching off the control field once the pulse is inside, converting it into a collective spin excitation','By cooling the photons','By trapping it in a tweezer'],a:1,why:'The dark-state polariton becomes purely atomic when the control is off. Reversing the process retrieves the photon (Lukin 2003).'},
   {q:'Storage efficiency improves with optical depth because…',o:['The delay-bandwidth product grows ∝ √OD','Dense clouds are colder','OD reduces the photon energy','It does not'],a:0,why:'More delay for the same window width means the pulse can be fully compressed inside the medium.'},
   {q:'What changes when the storage state is a Rydberg level ("Rydberg EIT")?',o:['Nothing','Blockade makes the medium respond to single photons: photon–photon interactions, single-photon switches and sources','Light becomes faster than c','The atoms become ions'],a:1,why:'One stored Rydberg polariton blocks EIT for others within the blockade radius: an optical nonlinearity at the single-quantum level (Lukin et al. 2001; Lukin 2003).'},
   {q:'Why do atom-array quantum computers care about photonic interfaces?',o:['To heat the atoms','To link separate processors and distribute entanglement in a modular quantum network','To replace tweezers','To read out faster than light'],a:1,why:'Atom–photon entanglement lets modules share entanglement, a path to scaling beyond one vacuum chamber.'},
  ]},
 ]},
 {t:'Theory I: circuits, algorithms & complexity', ls:[
  {id:'th-circuit', kind:'circuit', title:'Universal gates & Solovay–Kitaev',
   brief:`<p>Any quantum computation is a circuit of gates drawn from a small <b>universal set</b>. Two-qubit gates are exactly universal. A finite set such as {H, T, CNOT} can only <i>approximate</i> arbitrary unitaries, but it does so efficiently.</p>
   <p>Part A: build five standard gates from smaller pieces. Part B: approximate a random rotation and find the shortest word that works.</p>
   <p class="cite">Preskill, Ph219/CS219 lecture notes, Ch. 5 §5.3–5.4.</p>`},
  {id:'th-complexity', kind:'complexity', title:'The complexity zoo',
   brief:`<p><b>BQP</b> is the class of problems a quantum computer solves in polynomial time with bounded error. Where does it sit? P ⊆ BPP ⊆ BQP ⊆ PSPACE is proven. Whether BQP contains NP-complete problems is open. <b>QMA</b>, the quantum analogue of NP, has the local Hamiltonian problem as its complete problem.</p>
   <p>Ten statements: decide which are theorems, which are false, and which are open.</p>
   <p class="cite">Preskill, Ph219/CS219 lecture notes, Ch. 5 §5.1–5.3, Ch. 6 §6.7–6.10.</p>`},
  {id:'th-oracle', kind:'oracle', title:'Oracle problems: Deutsch–Jozsa & Bernstein–Vazirani',
   brief:`<p>The first quantum speed-ups were proven in the <b>query model</b>: a black box computes f(x), and we count how many times we must call it. Interference between all inputs at once answers some global questions in one query.</p>
   <p>Five rounds with random oracles. Query classically, run the quantum circuit, or guess: total queries and correctness both count.</p>
   <p class="cite">Preskill, Ph219/CS219 lecture notes, Ch. 6 §6.1.</p>`},
  {id:'th-phase', kind:'phaseest', title:'Phase estimation',
   brief:`<p>Given a unitary U and an eigenstate |ψ⟩, phase estimation reads out the eigenphase φ to t bits using controlled-U^(2^j) gates and an inverse quantum Fourier transform. It is the subroutine behind factoring, discrete logs and energy estimation in quantum simulation.</p>
   <p>You have a budget of 1000 controlled-U applications. Choose t wisely: outcomes are random.</p>
   <p class="cite">Preskill, Ph219/CS219 lecture notes, Ch. 6 §6.4, §6.8.</p>`},
  {id:'th-shor', kind:'shor', title:'Shor: factoring by period finding',
   brief:`<p>RSA's security rests on factoring being hard. Shor showed that factoring N reduces to finding the period r of aˣ mod N. A quantum computer finds r with the quantum Fourier transform; the rest is classical number theory.</p>
   <p>Factor 15, 21 and 35. The measurements are random: you choose which candidate periods to test and when to give up on an a.</p>
   <p class="cite">Preskill, Ph219/CS219 lecture notes, Ch. 6 §6.2–6.3.</p>`},
  {id:'th-grover', kind:'grover', title:'Grover search and its optimality',
   brief:`<p>Searching N unsorted items for a marked one takes ~N/2 classical queries, but only ~(π/4)√N quantum queries via amplitude amplification. That is optimal: no quantum algorithm beats √N. So quantum computers don't trivially solve NP-complete problems by brute force.</p>
   <p>Four searches, the last with an unknown number of marked items.</p>
   <p class="cite">Preskill, Ph219/CS219 lecture notes, Ch. 6 §6.6–6.7.</p>`},
  {id:'quiz-theory1', kind:'quiz', title:'Checkpoint: computation & complexity', brief:'<p>Six questions on Preskill Ch. 5–6.</p>', qs:[
   {q:'What does the Solovay–Kitaev theorem guarantee?',o:['Every unitary can be built exactly from H and T','Any single-qubit unitary can be approximated to accuracy ε with O(log^c(1/ε)) gates from a finite universal set','Quantum computers solve NP-complete problems','Two-qubit gates are not universal'],a:1,why:'Polylogarithmic overhead, so the choice of universal gate set barely matters for complexity.'},
   {q:'Why is BQP ⊆ PSPACE?',o:['Quantum states fit in polynomial memory','Amplitudes can be computed by summing over exponentially many computational paths one at a time, reusing polynomial space','PSPACE includes everything','Measurement collapses the state'],a:1,why:'Exponential time, but only polynomial memory (Preskill §5.3.2). So quantum computers cannot solve PSPACE-hard problems unless BQP = PSPACE.'},
   {q:'Shor\'s algorithm turns factoring into…',o:['Unstructured search','Period finding of f(x) = aˣ mod N, solved with the quantum Fourier transform','Solving a linear system','The local Hamiltonian problem'],a:1,why:'Once r is known, gcd(a^{r/2} ± 1, N) usually reveals a factor.'},
   {q:'How many queries does Grover need for one marked item among N, and can that be improved?',o:['O(log N), yes','~(π/4)√N, and Ω(√N) is a proven lower bound','N/2, no','O(1)'],a:1,why:'The BBBV argument shows each query moves the state only a little, so √N queries are needed (§6.7).'},
   {q:'Which problem is QMA-complete?',o:['Factoring','Estimating the ground-state energy of a k-local Hamiltonian (to inverse-polynomial precision)','Graph isomorphism','Sorting'],a:1,why:'Kitaev\'s quantum Cook–Levin theorem: finding ground states of local Hamiltonians is hard even for quantum computers in general (§6.10).'},
   {q:'Why must quantum gates be reversible, and what does Landauer say?',o:['Unitary evolution is invertible; erasing a bit costs at least kT ln 2 of heat','Reversibility makes gates faster','Irreversible gates are illegal in physics','No reason'],a:0,why:'Unitarity forbids erasure. Bennett showed any classical computation can be made reversible, so nothing is lost (§5.2).'},
  ]},
 ]},
 {t:'Theory II: quantum error-correcting codes', ls:[
  {id:'th-stab', kind:'stabtab', title:'Stabilizer codes: Shor, Steane, five-qubit',
   brief:`<p>A <b>stabilizer code</b> is the joint +1 eigenspace of commuting Pauli operators (the generators). An error that anticommutes with a generator flips that measurement to −1, and the pattern of −1s (the syndrome) points to the correction.</p>
   <p>The Knill–Laflamme condition says a code corrects an error set {E_a} iff ⟨i|E_a†E_b|j⟩ = C_ab δ_ij: errors either act distinguishably or identically on the code. Identical action is <b>degeneracy</b>.</p>
   <p>Decode random single-qubit errors in the three classic distance-3 codes.</p>
   <p class="cite">Preskill, Ph219/CS219 lecture notes, Ch. 7 §7.1–7.11.</p>`},
  {id:'th-bounds', kind:'bounds', title:'How small can a code be?',
   brief:`<p>Before building codes, ask what is possible. Counting syndromes gives the <b>quantum Hamming bound</b>, and no-cloning gives the <b>quantum Singleton bound</b>. Together they tell you the smallest block that could protect your logical qubits.</p>
   <p class="cite">Preskill, Ph219/CS219 lecture notes, Ch. 7 §7.9, §7.11, §7.13.</p>`},
  {id:'th-concat', kind:'concat', title:'Concatenation & the threshold theorem',
   brief:`<p>If physical error rates are below a constant threshold, arbitrarily long quantum computations are possible with polylogarithmic overhead. Concatenated codes give doubly exponential suppression; topological (surface) codes reach the same goal with local checks and fewer qubits.</p>
   <p>Size the error-correcting overhead for three hardware scenarios.</p>
   <p class="cite">Preskill, Ph219/CS219 lecture notes, Ch. 7 §7.17–7.18.</p>`},
  {id:'quiz-theory2', kind:'quiz', title:'Checkpoint: quantum codes', brief:'<p>Six questions on Preskill Ch. 7.</p>', qs:[
   {q:'The Knill–Laflamme condition ⟨i|E_a†E_b|j⟩ = C_ab δ_ij means…',o:['Errors never happen','Errors map different code states to orthogonal states, and the environment learns nothing about which code state is present','The code has distance 1','Only bit flips are correctable'],a:1,why:'If C_ab is independent of the logical state, measuring the syndrome reveals nothing about the encoded information, so recovery is possible (§7.2–7.3).'},
   {q:'How is a CSS code built?',o:['From two classical linear codes C₂ ⊆ C₁, one fixing bit flips and the other (in the dual basis) fixing phase flips','From a random unitary','From a single parity check','From the toric code only'],a:0,why:'The Steane code uses the [7,4,3] Hamming code and its dual. X and Z errors are corrected independently (§7.7).'},
   {q:'What is the smallest code that corrects an arbitrary error on any one qubit?',o:['[[3,1,1]]','[[5,1,3]]','[[7,1,3]]','[[9,1,3]]'],a:1,why:'The five-qubit code saturates the quantum Hamming bound, and the Singleton bound forbids n < 5 for d = 3 (§7.11).'},
   {q:'What does the accuracy threshold theorem state?',o:['Any noise can be corrected','If each component fails with probability below a constant p_th, arbitrarily long computations succeed with polylogarithmic overhead','Codes must be concatenated infinitely','Thresholds only exist for classical computers'],a:1,why:'Concatenation gives p_L = p_th (p/p_th)^(2^L). Surface codes give a threshold around 1% under circuit noise (§7.17–7.18).'},
   {q:'Logical operators of the toric/surface code are…',o:['Single-qubit Paulis','Strings of Paulis that wrap around the torus or stretch between boundaries','Random matrices','Measurements'],a:1,why:'Their length is the code distance. Local errors must conspire along a whole string to cause a logical error (§7.18).'},
   {q:'Preskill §7.20 shows 2D local stabilizer codes are not "self-correcting". Why does that matter?',o:['It doesn\'t','A 2D memory cannot protect itself thermally. It needs active syndrome measurement and decoding, which is exactly what the earlier error-correction units had you do','2D codes have no threshold','They cannot store qubits'],a:1,why:'String-like logical operators mean no energy barrier grows with system size, so active error correction is essential.'},
  ]},
 ]},
 {t:'Error correction I: repetition codes', ls:[Q('1.2'),Q('1.3'),Q('1.4'),Q('1.5')]},
 {t:'Error correction II: the surface code', ls:[Q('2.1'),Q('2.2'),Q('2.3'),Q('2.4'),Q('2.5'),Q('2.6')]},
 {t:'Error correction III: Rydberg noise', ls:[Q('3.1'),Q('3.2'),Q('3.3'),Q('3.4'),Q('3.5')]},
 {t:'Error correction IV: memory experiments', ls:[Q('4.1'),Q('4.2'),Q('4.3')]},
 {t:'Logical computation', ls:[
  {id:'propagate', kind:'propagate', title:'Errors through a transversal CNOT',
   brief:`<p>Two surface-code blocks can be entangled by a <b>transversal CNOT</b>: CNOT between atom i of block A and atom i of block B, for every i at once. Neutral atoms do this by moving one whole block onto the other and firing one global pulse.</p>
   <p>The gate copies errors between blocks. Predict exactly where errors end up, 4 times.</p>`},
  {id:'quiz-logical', kind:'quiz', title:'Final checkpoint: logical computing', brief:'<p>Five questions on logical computation.</p>', qs:[
   {q:'What makes a gate "transversal"?',o:['It acts qubit-by-qubit between blocks, never coupling two qubits inside one block','It uses a transverse laser','It is applied to a single physical qubit','It requires magic states'],a:0,why:'Then one fault can affect at most one qubit per block, so it stays correctable.'},
   {q:'The Eastin–Knill theorem says…',o:['No code has a transversal universal gate set','Every code has transversal T','Surface codes cannot do CNOT','Errors cannot be corrected'],a:0,why:'Some gate must be done another way: magic-state injection/distillation, code switching, or teleportation.'},
   {q:'How did Bluvstein et al. (2025) get non-Clifford rotations?',o:['By transversal teleportation using 3D [[15,1,3]] codes, which have a transversal T','By ignoring them','With analog sweeps','They used ions'],a:0,why:'Codes with transversal T plus teleportation give arbitrary-angle synthesis with logarithmic overhead.'},
   {q:'Why decode logical circuits "correlatedly"?',o:['Transversal gates spread errors between blocks, so syndromes from different blocks are correlated','To save memory','Decoders are bored','It removes the need for measurements'],a:0,why:'Decoding blocks jointly across gates (Cain et al. 2024) lowers logical error rates and reduces rounds needed.'},
   {q:'After this course, what is the key remaining challenge for neutral-atom QC?',o:['Nothing; it is solved','Scaling to many logical qubits running deep circuits below threshold at useful speed (cycle rate, decoding, continuous reloading)','Making atoms identical','Finding any entangling gate'],a:1,why:'All the pieces exist; the frontier is putting them together at scale and at speed. That\'s what the Lab lets you play at.'},
  ]},
 ]},
];
const LEVELS=[];
UNITS.forEach((u,ui)=>u.ls.forEach((lv,li)=>{ lv.unit=ui; lv.num=`${ui+1}.${li+1}`; LEVELS.push(lv); }));
KINDS.intro=renderIntro;

/* ---------- sidebar ---------- */
function renderCourseList(L){
  L.innerHTML='';
  const card=H('div',{cls:'card'});
  card.appendChild(H('h2',{},'Neutral-atom quantum computing'));
  const cur=LEVELS[G.levelIdx];
  if(!G.openUnits) G.openUnits={};
  UNITS.forEach((u,ui)=>{
    const done=u.ls.filter(l=>G.progress.done[l.id]).length, open=G.openUnits[ui]!==undefined?G.openUnits[ui]:ui===cur.unit;
    const head=H('div',{cls:'unit'+(open?' open':'')},`<span>${open?'▾':'▸'} ${ui+1}. ${u.t}</span><span class="mut small">${done}/${u.ls.length}</span>`);
    head.addEventListener('click',()=>{ G.openUnits[ui]=!open; rerender(); });
    card.appendChild(head);
    if(!open) return;
    u.ls.forEach(lv=>{
      const i=LEVELS.indexOf(lv), ok=unlocked(i), stars=G.progress.done[lv.id]||0;
      const row=H('div',{cls:`lvl${i===G.levelIdx?' cur':''}${ok?'':' lock'}`},
        `<span class="id">${lv.num}</span><span>${lv.title}</span><span class="st">${stars?'★'.repeat(stars)+'<span style="opacity:.25">'+'★'.repeat(3-stars)+'</span>':''}</span>`);
      if(ok) row.addEventListener('click',()=>selectLevel(i));
      card.appendChild(row);
    });
  });
  const done=LEVELS.filter(l=>G.progress.done[l.id]).length;
  card.appendChild(H('div',{cls:'small mut',style:'margin-top:10px'},`${done}/${LEVELS.length} lessons complete. Units can be started in any order; lessons inside a unit unlock in sequence.`));
  if(!G.unlockAll) card.appendChild(H('div',{style:'margin-top:6px'})).appendChild(btn('Unlock all lessons',()=>{G.unlockAll=true;save();rerender();},'small'));
  L.appendChild(card);
}

const COURSE_REFS=`
  <div class="card"><h2>Theory units: Preskill's lecture notes</h2>
  <p class="ref">J. Preskill, Lecture Notes for Ph219/CS219: Quantum Information and Computation, Caltech. <a href="https://preskill.caltech.edu/ph229/index.html" target="_blank">preskill.caltech.edu/ph229</a>. Chapter 5, Classical and Quantum Circuits (2015); Chapter 6, Quantum Algorithms (2020); Chapter 7, Quantum Error Correction (2026). Fall 2020 lecture videos are linked there.</p>
  <p class="ref"><b>Model caveats:</b> the theory lessons compute exact unitaries, query outcomes, QFT and phase-estimation distributions, and code syndromes. The concatenation and surface-code scalings use standard textbook approximations.</p>
  </div>
  <div class="card"><h2>Course reading list: neutral-atom hardware</h2>
  <p class="ref">Saffman, Walker & Mølmer, "Quantum information with Rydberg atoms," <i>Rev. Mod. Phys.</i> 82, 2313 (2010). The standard review.</p>
  <p class="ref">Schlosser et al., "Sub-poissonian loading of single atoms in a microscopic dipole trap," <i>Nature</i> 411, 1024 (2001).</p>
  <p class="ref">Barredo et al., "An atom-by-atom assembler of defect-free arbitrary 2D atomic arrays," <i>Science</i> 354, 1021 (2016); Endres et al., "Atom-by-atom assembly of defect-free one-dimensional cold atom arrays," <i>Science</i> 354, 1024 (2016).</p>
  <p class="ref">Jaksch et al., "Fast quantum gates for neutral atoms," <i>PRL</i> 85, 2208 (2000); Lukin et al., "Dipole blockade and quantum information processing in mesoscopic atomic ensembles," <i>PRL</i> 87, 037901 (2001).</p>
  <p class="ref">Urban et al., <i>Nat. Phys.</i> 5, 110 (2009) and Gaëtan et al., <i>Nat. Phys.</i> 5, 115 (2009): first observations of Rydberg blockade between two atoms.</p>
  <p class="ref">Levine et al., "Parallel implementation of high-fidelity multiqubit gates with neutral atoms," <i>PRL</i> 123, 170503 (2019). <a href="https://arxiv.org/abs/1908.06101" target="_blank">arXiv:1908.06101</a></p>
  <p class="ref">Jandura & Pupillo, "Time-optimal two- and three-qubit gates for Rydberg atoms," <i>Quantum</i> 6, 712 (2022).</p>
  <p class="ref">Lukin, "Colloquium: Trapping and manipulating photon states in atomic ensembles," <i>Rev. Mod. Phys.</i> 75, 457 (2003). EIT, stopped light, Rydberg ensembles.</p>
  <p class="ref">Wilk et al., "Entanglement of two individual neutral atoms using Rydberg blockade," <i>PRL</i> 104, 010502 (2010). <a href="https://arxiv.org/abs/0908.0454" target="_blank">arXiv:0908.0454</a></p>
  <p class="ref">Isenhower et al., "Demonstration of a neutral atom controlled-NOT quantum gate," <i>PRL</i> 104, 010503 (2010). <a href="https://arxiv.org/abs/0907.5552" target="_blank">arXiv:0907.5552</a></p>
  <p class="ref">Browaeys & Lahaye, "Many-body physics with individually controlled Rydberg atoms," <i>Nat. Phys.</i> 16, 132 (2020). <a href="https://arxiv.org/abs/2002.07413" target="_blank">arXiv:2002.07413</a></p>
  <p class="ref">Semeghini et al., "Probing topological spin liquids on a programmable quantum simulator," <i>Science</i> 374, 1242 (2021). <a href="https://arxiv.org/abs/2104.04119" target="_blank">arXiv:2104.04119</a></p>
  <p class="ref">Bernien et al., "Probing many-body dynamics on a 51-atom quantum simulator," <i>Nature</i> 551, 579 (2017).</p>
  <p class="ref">Pichler, Wang, Zhou, Choi & Lukin, "Quantum optimization for maximum independent set using Rydberg atom arrays," arXiv:1808.10816 (2018); Ebadi et al., "Quantum optimization of maximum independent set using Rydberg atom arrays," <i>Science</i> 376, 1209 (2022).</p>
  <p class="ref">Bluvstein et al., "A quantum processor based on coherent transport of entangled atom arrays," <i>Nature</i> 604, 451 (2022).</p>
  <p class="ref">Cain et al., "Correlated decoding of logical algorithms with transversal gates," <i>PRL</i> 133, 240602 (2024).</p>
  <p class="ref">Manetsch et al., "A tweezer array with 6100 highly coherent atomic qubits," <i>Nature</i> 647, 60 (2025). <a href="https://arxiv.org/abs/2403.12021" target="_blank">arXiv:2403.12021</a></p>
  <p class="ref">Chiu et al., "Continuous operation of a coherent 3,000-qubit system," <i>Nature</i> 646, 1075 (2025). <a href="https://arxiv.org/abs/2506.20660" target="_blank">arXiv:2506.20660</a></p>
  <p class="ref"><b>Model caveats:</b> numbers in the hardware lessons (lifetimes, Stark shifts, Doppler, scattering, readout rates) are simplified scalings tuned for play, not a precise atomic-physics calculation. The analog lessons solve the Schrödinger equation exactly in the blockade subspace, with decay added as a simple survival factor.</p>
  </div>`;
