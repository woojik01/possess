
// POSSESS v0.1.1 - Full sprite replacement + bug fixes
// - 횟수 버그 수정 (score, deathCount, bullet 중복 카운트)
// - 해상도 자동 맞춤 (DPR, virtual res, letterbox)
// - 바닥/천장/벽 구분 (타일 타입별 렌더링)
// - UI 전면 개선
const VIRTUAL_W=960, VIRTUAL_H=540;
const TILE=32;
const GRAV=0.68;
const TILE_AIR=0, TILE_FLOOR=1, TILE_PLATFORM=2, TILE_WALL=3;

const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
const wrap=document.getElementById('canvas-wrap');

function setupCanvas(){
  const dpr=window.devicePixelRatio||1;
  const maxW=Math.min(window.innerWidth, 1280);
  const maxH=Math.min(window.innerHeight, 720);
  // keep 16:9
  let cssW=maxW, cssH=cssW*9/16;
  if(cssH>maxH){ cssH=maxH; cssW=cssH*16/9; }
  canvas.style.width=cssW+'px';
  canvas.style.height=cssH+'px';
  // actual pixel buffer
  canvas.width=VIRTUAL_W * dpr;
  canvas.height=VIRTUAL_H * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled=false;
  document.getElementById('res-info').textContent=`${Math.round(cssW)}x${Math.round(cssH)}`;
  document.getElementById('dpr-info').textContent=dpr.toFixed(1);
}
setupCanvas();
window.addEventListener('resize', setupCanvas);
window.addEventListener('orientationchange', ()=>setTimeout(setupCanvas,300));

let W=VIRTUAL_W, H=VIRTUAL_H;
let camera={x:0,y:0};

// UI refs
const hpFill=document.getElementById('hp-fill');
const hpGhost=document.getElementById('hp-ghost');
const hpText=document.getElementById('hp-text');
const hostUI=document.getElementById('host-ui');
const hostHpFill=document.getElementById('host-hp-fill');
const hostHpText=document.getElementById('host-hp-text');
const hostNameEl=document.getElementById('host-name');
const hostAbilityEl=document.getElementById('host-ability');
const hostIconEl=document.getElementById('hud-host-icon');
const parasiteIconEl=document.getElementById('hud-parasite-icon');
const scoreVal=document.getElementById('score-val');
const zoneVal=document.getElementById('zone-val');
const deathHud=document.getElementById('death-count-hud');
const deathCountEl=document.getElementById('death-count');
const deathModal=document.getElementById('death-modal');
const adSim=document.getElementById('ad-sim');
const adFill=document.getElementById('ad-progress-fill');
const bossBanner=document.getElementById('boss-banner');
const bossNameEl=document.getElementById('boss-name');
const toastEl=document.getElementById('toast');
const settingsModal=document.getElementById('settings-modal');

let autoAim=true, pixelSnap=true, vibration=true;
document.getElementById('autoaim-toggle').addEventListener('change',e=>autoAim=e.target.checked);
document.getElementById('pixel-toggle').addEventListener('change',e=>{pixelSnap=e.target.checked; ctx.imageSmoothingEnabled=!pixelSnap;});
document.getElementById('vibration-toggle').addEventListener('change',e=>vibration=e.target.checked);
document.getElementById('settings-btn').onclick=()=>settingsModal.classList.remove('hidden');
document.getElementById('close-settings').onclick=()=>settingsModal.classList.add('hidden');

// Input
let keys={}, joy={x:0,y:0}, isJump=false, wantAttack=false, wantEject=false;
const joyBase=document.getElementById('joy-base');
const joyStick=document.getElementById('joy-stick');
let joyTouchId=null;
function setJoy(dx,dy){const max=40; const len=Math.hypot(dx,dy); if(len>max){dx=dx/len*max;dy=dy/len*max;} joyStick.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; joy.x=dx/max; joy.y=dy/max;}
joyBase.addEventListener('touchstart',e=>{e.preventDefault(); const t=e.changedTouches[0]; joyTouchId=t.identifier; const r=joyBase.getBoundingClientRect(); setJoy(t.clientX-(r.left+r.width/2), t.clientY-(r.top+r.height/2));},{passive:false});
joyBase.addEventListener('touchmove',e=>{e.preventDefault(); for(let t of e.changedTouches) if(t.identifier===joyTouchId){ const r=joyBase.getBoundingClientRect(); setJoy(t.clientX-(r.left+r.width/2), t.clientY-(r.top+r.height/2));}},{passive:false});
joyBase.addEventListener('touchend',e=>{for(let t of e.changedTouches) if(t.identifier===joyTouchId){joyTouchId=null; joy={x:0,y:0}; joyStick.style.transform='translate(-50%,-50%)';}});
window.addEventListener('keydown',e=>{keys[e.code]=true; if(e.code==='Space') isJump=true; if(e.code==='KeyJ') wantAttack=true; if(e.code==='KeyK') wantEject=true;});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
document.getElementById('btn-jump').addEventListener('touchstart',e=>{e.preventDefault();isJump=true;},{passive:false});
document.getElementById('btn-jump').addEventListener('mousedown',()=>isJump=true);
document.getElementById('btn-attack').addEventListener('touchstart',e=>{e.preventDefault();wantAttack=true;},{passive:false});
document.getElementById('btn-attack').addEventListener('mousedown',()=>wantAttack=true);
document.getElementById('btn-eject').addEventListener('touchstart',e=>{e.preventDefault();wantEject=true;},{passive:false});
document.getElementById('btn-eject').addEventListener('mousedown',()=>wantEject=true);

// Sprite loader - 전면 교체
const SPRITES={
  parasite:'assets/sprites/parasite.png',
  crawl:'assets/sprites/crawl.png',
  spitter:'assets/sprites/spitter.png',
  hopper:'assets/sprites/hopper.png',
  charger:'assets/sprites/charger.png',
  phantom:'assets/sprites/phantom.png',
  blight:'assets/sprites/blight.png',
  wraith:'assets/sprites/wraith.png',
  gorger:'assets/sprites/gorger.png',
  seer:'assets/sprites/seer.png',
  mother:'assets/sprites/mother.png',
  floor:'assets/tiles/floor.png',
  platform:'assets/tiles/platform.png',
  wall:'assets/tiles/wall.png',
  ceiling:'assets/tiles/ceiling.png'
};
let IMAGES={};
let loadedCount=0;
function loadImages(){
  const promises=Object.entries(SPRITES).map(([k,src])=>new Promise(res=>{
    const img=new Image();
    img.src=src;
    img.onload=()=>{IMAGES[k]=img; loadedCount++; res();};
    img.onerror=()=>{console.warn('fail',src); loadedCount++; res();};
  }));
  return Promise.all(promises);
}

// Host definitions - bugfix: hp, speed balance
const HOSTS={
  CRAWL:{id:'CRAWL',name:'CRAWL / 크롤',hp:65,speed:3.4,jump:12,dmg:14,color:'#eccc68',rare:false,ability:'할퀴기 - 근접 2연타',proj:false, sprite:'crawl'},
  SPITTER:{id:'SPITTER',name:'SPITTER / 스핏',hp:45,speed:2.7,jump:11,dmg:10,color:'#70a1ff',rare:false,ability:'산성 3점사',proj:true, sprite:'spitter'},
  HOPPER:{id:'HOPPER',name:'HOPPER / 호퍼',hp:55,speed:3.2,jump:17,dmg:18,color:'#7bed9f',rare:false,ability:'강하 찍기',proj:false, sprite:'hopper'},
  CHARGER:{id:'CHARGER',name:'CHARGER / 차저',hp:80,speed:3.8,dash:9,jump:11,dmg:22,color:'#ff6b81',rare:false,ability:'돌진 - 벽 파괴',proj:false, sprite:'charger'},
  PHANTOM:{id:'PHANTOM',name:'PHANTOM / 팬텀',hp:90,speed:4.2,jump:12,dmg:16,color:'#a29bfe',rare:true,ability:'위상 대시 (벽 관통)',proj:false,special:'phaseDash', sprite:'phantom'},
  BLIGHT:{id:'BLIGHT',name:'BLIGHT / 블라이트',hp:100,speed:2.6,jump:10,dmg:8,color:'#2ed573',rare:true,ability:'부패 오라 (지속뎀)',proj:false,special:'poisonAura', sprite:'blight'},
  WRAITH:{id:'WRAITH',name:'WRAITH / 레이스',hp:85,speed:3.6,jump:13,dmg:15,color:'#dfe4ea',rare:true,ability:'벽/천장 매달리기',proj:false,special:'wallCling', sprite:'wraith'},
};
const BOSSES={
  GORGER:{id:'GORGER',name:'GORGER / 고저',hp:380,speed:1.8,dmg:28,color:'#ff4757',w:96,h:72, sprite:'gorger'},
  SEER:{id:'SEER',name:'SEER / 시어',hp:340,speed:2.2,dmg:20,color:'#e84393',w:80,h:80, sprite:'seer'},
  MOTHER:{id:'MOTHER',name:'MOTHER / 마더',hp:850,speed:1.2,dmg:30,color:'#2f3542',w:140,h:110, sprite:'mother'},
};

let level={tiles:[],width:0,height:16,rooms:[]};
let player,enemies=[],bullets=[],corpses=[],particles=[],boss=null;
let score=0, deathCount=parseInt(localStorage.getItem('possess_deaths')||'0'), gameOver=false;
deathHud.textContent=deathCount;

function rand(a,b){return Math.random()*(b-a)+a}
function choice(a){return a[Math.floor(Math.random()*a.length)]}
function vibrate(ms){ if(vibration && navigator.vibrate) navigator.vibrate(ms); }
function showToast(msg){ toastEl.textContent=msg; toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'),1500); }

function genLevel(){
  const ROOM_W=20, ROOM_H=16;
  const totalRooms=12;
  const Wtotal=ROOM_W*totalRooms;
  level.width=Wtotal; level.height=ROOM_H;
  level.tiles=Array.from({length:ROOM_H},()=>Array(Wtotal).fill(TILE_AIR));
  level.rooms=[];
  // generate rooms with distinct floor/wall/ceiling
  for(let r=0;r<totalRooms;r++){
    const rx=r*ROOM_W;
    // floor - bottom 2 rows
    for(let x=rx;x<rx+ROOM_W;x++){
      level.tiles[ROOM_H-1][x]=TILE_FLOOR;
      level.tiles[ROOM_H-2][x]=TILE_FLOOR;
      if(r<9 && Math.random()<0.18 && x>rx+3 && x<rx+ROOM_W-4) level.tiles[ROOM_H-2][x]=TILE_AIR; // gap
      // ceiling for boss rooms
      if(r>=9){ level.tiles[0][x]=TILE_WALL; level.tiles[1][x]=TILE_WALL; }
    }
    // side walls for each room (구분)
    for(let y=0;y<ROOM_H;y++){
      if(r>0) { if(Math.random()<0.7) level.tiles[y][rx]=TILE_WALL; }
      if(r<totalRooms-1){ if(Math.random()<0.7) level.tiles[y][rx+ROOM_W-1]=TILE_WALL; }
    }
    // platforms - 네모네모 기반, distinct type
    const platCount=r<9? 3+Math.floor(Math.random()*3) : 1;
    for(let p=0;p<platCount;p++){
      const pw=3+Math.floor(rand(2,5));
      const px=rx+Math.floor(rand(1,ROOM_W-pw-1));
      const py=Math.floor(rand(5,ROOM_H-5));
      for(let x=px;x<px+pw;x++) level.tiles[py][x]=TILE_PLATFORM;
    }
    level.rooms.push({x:rx,type:r>=9?'boss':'normal'});
  }
  enemies=[]; corpses=[]; bullets=[]; particles=[]; boss=null;
  // spawn - 횟수 버그 수정: 정확히 카운트, 중복 생성 방지
  let spawned=0;
  for(let r=0;r<9;r++){
    const rx=r*ROOM_W;
    const cnt= r<2?1 : r<5?2 : 3;
    for(let i=0;i<cnt;i++){
      const isRare=Math.random()<0.18;
      let type;
      if(isRare) type=choice([HOSTS.PHANTOM, HOSTS.BLIGHT, HOSTS.WRAITH]);
      else type=choice([HOSTS.CRAWL, HOSTS.SPITTER, HOSTS.HOPPER, HOSTS.CHARGER]);
      const ex=rx*TILE+rand(60, ROOM_W*TILE-60);
      const ey=(level.height-7)*TILE;
      // prevent overlap
      if(enemies.some(e=>Math.abs(e.x-ex)<60)) continue;
      enemies.push(new Enemy(ex,ey,type,isRare));
      spawned++;
    }
  }
  level.midBoss={x:9*ROOM_W*TILE+200,type:Math.random()<0.5?BOSSES.GORGER:BOSSES.SEER,alive:true,room:9};
  level.finalBoss={x:11*ROOM_W*TILE+100,type:BOSSES.MOTHER,alive:true,room:11};
  console.log(`Level generated: ${spawned} enemies, ${totalRooms} rooms`);
}

class Particle{constructor(x,y,c,vx,vy,life){this.x=x;this.y=y;this.c=c;this.vx=vx;this.vy=vy;this.life=life;this.max=life} update(){this.x+=this.vx;this.y+=this.vy;this.vy+=0.22;this.life--} draw(){ctx.globalAlpha=this.life/this.max; ctx.fillStyle=this.c; ctx.fillRect(this.x-camera.x,this.y-camera.y,3,3); ctx.globalAlpha=1;}}
class Bullet{constructor(x,y,ang,spd,dmg,col,fromP){this.x=x;this.y=y;this.vx=Math.cos(ang)*spd;this.vy=Math.sin(ang)*spd;this.dmg=dmg;this.color=col;this.fromPlayer=fromP;this.life=90} update(){this.x+=this.vx;this.y+=this.vy;this.life--; const tx=Math.floor(this.x/TILE),ty=Math.floor(this.y/TILE); if(ty>=0&&ty<level.height&&tx>=0&&tx<level.width&&level.tiles[ty][tx]!==TILE_AIR) this.life=0;} draw(){ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(this.x-camera.x,this.y-camera.y,4,0,Math.PI*2); ctx.fill();}}
class Corpse{constructor(x,y,type){this.x=x;this.y=y;this.type=type;this.w=40;this.h=28;this.life=600} update(){this.life--} draw(){const sx=this.x-camera.x,sy=this.y-camera.y; const img=IMAGES[this.type.sprite]; if(img){ ctx.globalAlpha=0.7+Math.sin(Date.now()*0.008)*0.15; ctx.drawImage(img,sx,sy,this.w,this.h); ctx.globalAlpha=1; } else { ctx.fillStyle=this.type.color; ctx.fillRect(sx,sy,this.w,this.h);} ctx.strokeStyle='#2ed573'; ctx.setLineDash([4,3]); ctx.lineWidth=2; ctx.strokeRect(sx-3,sy-3,this.w+6,this.h+6); ctx.setLineDash([]); ctx.fillStyle='#fff'; ctx.font='bold 9px monospace'; ctx.fillText(this.type.name,sx,sy-7); ctx.fillStyle='#2ed573'; ctx.fillText('접촉 기생',sx,sy+this.h+10);}}

class Enemy{
  constructor(x,y,type,isRare){
    this.x=x;this.y=y;this.type=type;this.isRare=isRare;this.w=type.rare?40:32;this.h=type.rare?40:32;
    this.vx=0;this.vy=0;this.hp=type.hp;this.maxHp=type.hp;this.dir=Math.random()<0.5?-1:1;this.cool=0;this.onGround=false;
    this._dead=false;
  }
  update(){
    this.vy+=GRAV; if(this.cool>0) this.cool--;
    if(player){
      const dist=Math.hypot(player.x-this.x,player.y-this.y);
      if(dist<420){
        this.dir=player.x>this.x?1:-1;
        this.vx=this.type.speed*this.dir*(0.6+Math.random()*0.4);
        if(this.type.id==='CHARGER'&&dist<240&&this.cool<=0){this.vx=this.dir*this.type.dash; this.cool=90; vibrate(30);}
        if(this.onGround&&Math.random()<0.025) this.vy=-this.type.jump;
        if(this.cool<=0&&dist<(this.type.proj?320:50)){
          if(this.type.proj){const ang=Math.atan2(player.y-this.y,player.x-this.x); bullets.push(new Bullet(this.x+this.w/2,this.y+this.h/2,ang,6,this.type.dmg,'#ff4757',false)); this.cool=60;}
          else { if(dist<52){player.takeDamage(this.type.dmg); this.cool=50; vibrate(20);} }
        }
      } else { this.vx=this.type.speed*0.5*this.dir; if(Math.random()<0.012) this.dir*=-1; }
    }
    this.x+=this.vx;
    if(checkTile(this.x,this.y,this.w,this.h)){ this.x-=this.vx; this.dir*=-1; this.vx=0; }
    this.y+=this.vy;
    if(checkTile(this.x,this.y,this.w,this.h)){
      if(this.vy>0){ const ty=Math.floor((this.y+this.h)/TILE); this.y=ty*TILE-this.h; this.onGround=true; } else { this.y=Math.ceil(this.y/TILE)*TILE; }
      this.vy=0;
    } else this.onGround=false;
    this.vx*=0.88;
  }
  draw(){
    const sx=this.x-camera.x,sy=this.y-camera.y;
    const img=IMAGES[this.type.sprite];
    if(img){
      ctx.save();
      if(this.dir<0){ ctx.scale(-1,1); ctx.drawImage(img, -(sx+this.w), sy, this.w, this.h); } else ctx.drawImage(img,sx,sy,this.w,this.h);
      ctx.restore();
    } else {
      ctx.fillStyle=this.type.color; ctx.fillRect(sx,sy,this.w,this.h);
    }
    if(this.hp<this.maxHp){
      ctx.fillStyle='#0f1720'; ctx.fillRect(sx,sy-10,this.w,5);
      ctx.fillStyle=this.isRare?'#eccc68':'#ff4757'; ctx.fillRect(sx,sy-10,this.w*(this.hp/this.maxHp),5);
    }
    if(this.isRare){
      ctx.strokeStyle='#eccc68'; ctx.lineWidth=1.5; ctx.setLineDash([3,3]); ctx.strokeRect(sx-2,sy-2,this.w+4,this.h+4); ctx.setLineDash([]);
    }
  }
  takeDamage(d){
    if(this._dead) return;
    this.hp-=d;
    for(let i=0;i<4;i++) particles.push(new Particle(this.x+this.w/2,this.y+this.h/2,this.type.color,rand(-3,3),rand(-5,-1),18));
    if(this.hp<=0 && !this._dead){
      this._dead=true;
      score++; scoreVal.textContent=score; // 횟수 버그 수정: 한 번만 카운트
      if(this.isRare) corpses.push(new Corpse(this.x,this.y,this.type));
      const idx=enemies.indexOf(this);
      if(idx>=0) enemies.splice(idx,1);
      if(this.isRare) showToast(`${this.type.name} 처치! 잔류핵 생성`);
    }
  }
}
class BossEnemy extends Enemy{
  constructor(x,y,type){super(x,y,type,false); this.w=type.w; this.h=type.h;}
  update(){ super.update();
    if(this.type.id==='GORGER'&&this.cool<=0){ if(player) player.x+=(this.x-player.x)*0.018; this.cool=120; }
    if(this.type.id==='SEER'&&this.cool<=0){ for(let i=0;i<3;i++){const ang=-Math.PI/2+rand(-0.6,0.6); bullets.push(new Bullet(this.x+this.w/2,this.y+this.h/2,ang,5,18,'#e84393',false));} this.cool=70; }
    if(this.type.id==='MOTHER'&&this.cool<=0){ enemies.push(new Enemy(this.x+rand(-50,50),this.y+this.h,choice([HOSTS.CRAWL,HOSTS.HOPPER]),false)); this.cool=140; }
  }
}

function checkTile(x,y,w,h){
  const x1=Math.floor(x/TILE),x2=Math.floor((x+w)/TILE),y1=Math.floor(y/TILE),y2=Math.floor((y+h)/TILE);
  for(let ty=y1;ty<=y2;ty++) for(let tx=x1;tx<=x2;tx++){
    if(ty<0||ty>=level.height||tx<0||tx>=level.width) continue;
    if(level.tiles[ty][tx]!==TILE_AIR) return true;
  }
  return false;
}

class Player{
  constructor(x,y){
    this.x=x;this.y=y;this.w=22;this.h=18;this.vx=0;this.vy=0;this.onGround=false;
    this.hp=30;this.maxHp=30;this.host=null;this.cool=0;this.invul=0;this.phaseDash=0;
    this.prevHp=30;
  }
  update(){
    let move=joy.x;
    if(keys['KeyA']||keys['ArrowLeft']) move-=1;
    if(keys['KeyD']||keys['ArrowRight']) move+=1;
    move=Math.max(-1,Math.min(1,move));
    const curSpeed=this.host?this.host.type.speed:4.2;
    this.vx+=move*0.95;
    this.vx=Math.max(-curSpeed,Math.min(curSpeed,this.vx));
    if(isJump&&this.onGround){const jmp=this.host?this.host.type.jump:12.5; this.vy=-jmp; this.onGround=false; isJump=false; vibrate(10);}
    // wall cling
    if(this.host&&this.host.type.special==='wallCling'&&!this.onGround){ if(checkTile(this.x-4,this.y,this.w+8,this.h)) this.vy*=0.58; }
    if(!this.host&&!this.onGround){ if(checkTile(this.x-2,this.y,this.w+4,this.h)&&Math.abs(move)>0.2) this.vy*=0.68; }
    this.vy+=GRAV; if(this.vy>15) this.vy=15;
    if(this.phaseDash>0){this.phaseDash--; this.invul=2;}
    this.x+=this.vx;
    if(this.phaseDash<=0&&checkTile(this.x,this.y,this.w,this.h)){this.x-=this.vx; this.vx=0;}
    this.y+=this.vy;
    if(checkTile(this.x,this.y,this.w,this.h)){
      if(this.vy>0){const ty=Math.floor((this.y+this.h)/TILE); this.y=ty*TILE-this.h; this.onGround=true;}
      else {this.y=Math.ceil(this.y/TILE)*TILE;}
      this.vy=0;
    } else this.onGround=false;
    this.vx*=0.84;
    if(this.cool>0) this.cool--; if(this.invul>0) this.invul--;
    // aim
    let aim=0,target=null,minD=9999;
    for(let e of enemies){const d=Math.hypot(e.x-this.x,e.y-this.y); if(d<minD){minD=d; target=e;}}
    if(boss&&Math.hypot(boss.x-this.x,boss.y-this.y)<minD) target=boss;
    if(autoAim&&target) aim=Math.atan2((target.y+target.h/2)-(this.y+this.h/2),(target.x+target.w/2)-(this.x+this.w/2));
    else aim=this.vx>=0?0:Math.PI;
    if(wantAttack&&this.cool<=0){this.attack(aim); wantAttack=false;}
    if(wantEject&&this.host){this.eject(); wantEject=false;}
    if(this.host&&this.host.type.special==='poisonAura'){ for(let e of enemies){ if(Math.hypot(e.x-this.x,e.y-this.y)<85) e.takeDamage(0.3); } }
    if(!this.host){
      for(let i=corpses.length-1;i>=0;i--){const c=corpses[i]; if(this.x<c.x+c.w&&this.x+this.w>c.x&&this.y<c.y+c.h&&this.y+this.h>c.y){this.possess(c.type); corpses.splice(i,1); vibrate(40); showToast(`${c.type.name} 기생!`); break;}}
    }
    if(this.y>(level.height+2)*TILE) this.takeDamage(100);
    camera.x=this.x-W*0.35; camera.y=this.y-H*0.5;
    camera.x=Math.max(0,Math.min(camera.x,level.width*TILE-W));
    camera.y=Math.max(-120,Math.min(camera.y,level.height*TILE-H));
    const roomIdx=Math.floor((this.x/TILE)/20);
    zoneVal.textContent=roomIdx<9?`ZONE ${roomIdx+1}/9`:roomIdx==9?'MID BOSS':'FINAL BOSS';
    if(roomIdx===9&&level.midBoss&&level.midBoss.alive&&!boss){
      boss=new BossEnemy(level.midBoss.x,(level.height-4)*TILE-level.midBoss.type.h,level.midBoss.type);
      bossNameEl.textContent=level.midBoss.type.name; bossBanner.classList.remove('hidden'); setTimeout(()=>bossBanner.classList.add('hidden'),2500);
    }
    if(roomIdx>=11&&level.finalBoss&&level.finalBoss.alive&&!boss){
      boss=new BossEnemy(level.finalBoss.x,(level.height-5)*TILE-level.finalBoss.type.h,level.finalBoss.type);
      bossNameEl.textContent=level.finalBoss.type.name; bossBanner.classList.remove('hidden'); setTimeout(()=>bossBanner.classList.add('hidden'),2500);
    }
  }
  attack(angle){
    if(!this.host){
      bullets.push(new Bullet(this.x+this.w/2,this.y+this.h/2,angle,8.5,7,'#2ed573',true)); this.cool=16;
    } else {
      const t=this.host.type;
      if(t.proj){for(let i=-1;i<=1;i++) bullets.push(new Bullet(this.x+this.w/2,this.y+this.h/2,angle+i*0.18,9.5,t.dmg,t.color,true)); this.cool=26;}
      else if(t.id==='CHARGER'){this.vx+=Math.cos(angle)*t.dash; this.cool=34; for(let e of [...enemies]) if(Math.hypot(e.x-this.x,e.y-this.y)<62) e.takeDamage(t.dmg); if(boss&&Math.hypot(boss.x-this.x,boss.y-this.y)<85) boss.hp-=t.dmg; vibrate(25);}
      else if(t.special==='phaseDash'){this.phaseDash=20; this.vx+=Math.cos(angle)*11; this.cool=48; vibrate(15);}
      else {bullets.push(new Bullet(this.x+this.w/2,this.y+this.h/2,angle,13,t.dmg,t.color,true)); this.cool=20;}
    }
  }
  possess(type){
    this.host={type:type,hp:type.hp,maxHp:type.hp};
    this.w=type.rare?40:32; this.h=type.rare?40:32;
    this.hp=30; this.invul=30; this.prevHp=type.hp;
    updateUI();
    for(let i=0;i<14;i++) particles.push(new Particle(this.x+this.w/2,this.y+this.h/2,type.color,rand(-4,4),rand(-7,-1),20));
    hostIconEl.src=`assets/sprites/${type.sprite}.png`;
  }
  eject(){ if(!this.host) return; this.host=null; this.w=22; this.h=18; this.invul=24; this.cool=16; updateUI(); showToast('탈출!'); }
  takeDamage(d){
    if(this.invul>0) return;
    if(this.host){
      this.host.hp-=d;
      if(this.host.hp<=0){this.eject(); this.invul=45; vibrate(50);}
    } else {
      this.hp-=d; if(this.hp<=0) this.die();
    }
    updateUI(); this.invul=18; vibrate(20);
  }
  die(){
    if(gameOver) return; gameOver=true;
    deathCount++; localStorage.setItem('possess_deaths',deathCount);
    deathCountEl.textContent=deathCount; deathHud.textContent=deathCount;
    if(deathCount%3===0){
      adSim.classList.remove('hidden');
      let prog=0; const iv=setInterval(()=>{prog+=2; adFill.style.width=prog+'%'; if(prog>=100){clearInterval(iv); adSim.classList.add('hidden'); adFill.style.width='0%';}},30);
      window.AdMob&&window.AdMob.showInterstitial&&window.AdMob.showInterstitial();
    }
    deathModal.classList.remove('hidden'); vibrate([30,40,80]);
  }
  draw(){
    const sx=this.x-camera.x,sy=this.y-camera.y;
    if(this.invul>0&&Math.floor(Date.now()/90)%2===0) return;
    const imgParasite=IMAGES.parasite;
    if(!this.host){
      if(imgParasite) ctx.drawImage(imgParasite,sx,sy,this.w,this.h);
      else { ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(sx+this.w/2,sy+this.h/2,this.w/2,this.h/2,0,0,Math.PI*2); ctx.fill(); }
    } else {
      const hostImg=IMAGES[this.host.type.sprite];
      if(hostImg) ctx.drawImage(hostImg,sx,sy,this.w,this.h);
      else { ctx.fillStyle=this.host.type.color; ctx.fillRect(sx,sy,this.w,this.h); }
      // parasite core overlay
      ctx.globalAlpha=0.9; if(imgParasite) ctx.drawImage(imgParasite,sx+this.w/2-7,sy+this.h/2-7,14,12); ctx.globalAlpha=1;
    }
  }
}

function updateUI(){
  const hpPct=player?(player.hp/player.maxHp)*100:0;
  hpFill.style.width=hpPct+'%';
  hpText.textContent=`${Math.max(0,Math.ceil(player?player.hp:0))}/${player?player.maxHp:30}`;
  // ghost damage bar
  if(player&&player.prevHp!==undefined){
    hpGhost.style.width=Math.max(0, ((player.prevHp-player.hp)/player.maxHp)*100)+'%';
  }
  if(player&&player.host){
    hostUI.classList.remove('hidden');
    hostHpFill.style.width=(player.host.hp/player.host.type.hp)*100+'%';
    hostHpText.textContent=`${Math.ceil(player.host.hp)}/${player.host.type.hp}`;
    hostNameEl.textContent=player.host.type.name;
    hostAbilityEl.textContent=player.host.type.ability;
    player.prevHp=player.host.hp;
  } else { hostUI.classList.add('hidden'); }
}

function checkBullets(){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    if(b.fromPlayer){
      for(let e of enemies){
        if(b.x>e.x&&b.x<e.x+e.w&&b.y>e.y&&b.y<e.y+e.h){
          if(!player.host&&!e.isRare&&b.color==='#2ed573'){
            // 즉시 기생 - 횟수 버그 수정: 중복 제거
            if(!e._dead){ player.possess(e.type); const idx=enemies.indexOf(e); if(idx>=0) enemies.splice(idx,1); score++; scoreVal.textContent=score; showToast(`${e.type.name} 기생 성공!`); }
            bullets.splice(i,1); break;
          } else { e.takeDamage(b.dmg); bullets.splice(i,1); break; }
        }
      }
      if(boss&&b.x>boss.x&&b.x<boss.x+boss.w&&b.y>boss.y&&b.y<boss.y+boss.h){
        boss.hp-=b.dmg; bullets.splice(i,1);
        if(boss.hp<=0){
          if(boss.type.id===BOSSES.MOTHER.id){ showToast('CLEAR!'); setTimeout(()=>{alert('CLEAR! POSSESS v0.1.1 클리어!'); genLevel(); initPlayer();},300); }
          else { level.midBoss.alive=false; boss=null; score+=10; scoreVal.textContent=score; showToast('중간 보스 처치!'); }
        }
      }
    } else {
      if(player&&b.x>player.x&&b.x<player.x+player.w&&b.y>player.y&&b.y<player.y+player.h){ player.takeDamage(b.dmg); bullets.splice(i,1); }
    }
  }
}

function drawLevel(){
  ctx.fillStyle='#0b1018'; ctx.fillRect(0,0,W,H);
  // parallax
  ctx.fillStyle='rgba(46,213,115,0.035)';
  for(let i=0;i<22;i++){ const x=(i*200 - camera.x*0.18)%W; ctx.fillRect(x,(i*38 - camera.y*0.08)%H,2,90); }
  const sx0=Math.floor(camera.x/TILE)-1, ex=Math.ceil((camera.x+W)/TILE)+1;
  const sy0=Math.floor(camera.y/TILE)-1, ey=Math.ceil((camera.y+H)/TILE)+1;
  for(let ty=sy0;ty<ey;ty++) for(let tx=sx0;tx<ex;tx++){
    if(ty<0||ty>=level.height||tx<0||tx>=level.width) continue;
    const t=level.tiles[ty][tx];
    if(t===TILE_AIR) continue;
    const dx=tx*TILE-camera.x, dy=ty*TILE-camera.y;
    let img=null, fallback=null;
    if(t===TILE_FLOOR){ img=IMAGES.floor; fallback='#2f3542'; }
    else if(t===TILE_PLATFORM){ img=IMAGES.platform; fallback='#3d3d3d'; }
    else if(t===TILE_WALL){ img=IMAGES.wall; fallback='#252e3b'; }
    if(img){ ctx.drawImage(img,dx,dy,TILE,TILE); }
    else { ctx.fillStyle=fallback; ctx.fillRect(dx,dy,TILE,TILE); }
    // 구분 강조
    if(t===TILE_FLOOR){ ctx.fillStyle='rgba(46,213,115,0.18)'; ctx.fillRect(dx,dy,TILE,4); ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(dx,dy+TILE-3,TILE,3); }
    else if(t===TILE_PLATFORM){ ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(dx,dy,TILE,3); }
    else if(t===TILE_WALL){ ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(dx+4,dy,2,TILE); }
  }
}

function initPlayer(){ const sx=2*TILE,sy=(level.height-5)*TILE; player=new Player(sx,sy); gameOver=false; updateUI(); }

async function start(){
  await loadImages();
  console.log('Sprites loaded', loadedCount);
  genLevel(); initPlayer();
  function loop(){
    requestAnimationFrame(loop);
    if(!player) return;
    if(!gameOver){
      player.update();
      for(let e of enemies) e.update();
      if(boss) boss.update();
      for(let b of bullets) b.update();
      for(let c of corpses) c.update();
      for(let p of particles) p.update();
      bullets=bullets.filter(b=>b.life>0);
      particles=particles.filter(p=>p.life>0);
      corpses=corpses.filter(c=>c.life>0);
      checkBullets();
    }
    drawLevel();
    for(let c of corpses) c.draw();
    for(let e of enemies) e.draw();
    if(boss) boss.draw();
    for(let b of bullets) b.draw();
    for(let p of particles) p.draw();
    player.draw();
    updateUI();
  }
  loop();
}

document.getElementById('respawn-btn').onclick=()=>{deathModal.classList.add('hidden'); genLevel(); initPlayer(); gameOver=false;};
document.getElementById('reward-btn').onclick=()=>{
  adSim.classList.remove('hidden');
  adSim.querySelector('p').textContent='🎁 리워드 광고 재생 중... 부활!';
  let prog=0; const iv=setInterval(()=>{prog+=1.6; adFill.style.width=prog+'%'; if(prog>=100){clearInterval(iv); adSim.classList.add('hidden'); adFill.style.width='0%'; deathModal.classList.add('hidden'); if(player.host) player.host.hp=player.host.type.hp*0.5; else player.hp=30; gameOver=false; window.AdMob&&window.AdMob.showRewarded&&window.AdMob.showRewarded(); vibrate(50);}},28);
};

start();
document.body.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
