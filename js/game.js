// ============================================================
// BUFF CHICKENS — js/game.js
// All game logic in one file (Canvas 2D top-down)
// ============================================================

// ---------- Constants ----------
const W = () => canvas.width;
const H = () => canvas.height;
const TWO_PI = Math.PI * 2;

const RUNE_TYPES = ['air','earth','water','fire'];
const SPECIAL_RUNE = ['buff','sand','rock','lava'];
const ALL_RUNES = [...RUNE_TYPES,...SPECIAL_RUNE];

const AREA_UNLOCK = { air:'gym', earth:'mountain', water:'beach', fire:'volcano' };
const AREA_RUNE   = { gym:'buff', mountain:'rock', beach:'sand', volcano:'lava' };
const AREA_ENEMY  = {
  gym:      { name:'Buff Pig',      color:'#e0a0e0', size:22, hp:80,  dmg:18, speed:1.1, ranged:false },
  beach:    { name:'Sand Cat',      color:'#f4e066', size:14, hp:30,  dmg:10, speed:2.4, ranged:false },
  mountain: { name:'Mountain Goat', color:'#888',    size:18, hp:50,  dmg:14, speed:1.4, ranged:false },
  volcano:  { name:'Rocky Rat',     color:'#c66',    size:12, hp:25,  dmg:8,  speed:2.0, ranged:false },
};

const ENEMY_DEFS = {
  cyborg_cow:    { label:'Cyborg Cow',    color:'#aaccff', size:26, hp:70,  dmg:14, speed:0.8, ranged:true,  runeType:'air'  },
  psychic_sheep: { label:'Psychic Sheep', color:'#cc88ff', size:20, hp:50,  dmg:18, speed:0.9, ranged:true,  runeType:'earth'},
  heavy_horse:   { label:'Heavy Horse',   color:'#a09060', size:34, hp:120, dmg:22, speed:0.65,ranged:false, runeType:'water'},
  monster_mutt:  { label:'Monster Mutt',  color:'#ff8844', size:18, hp:40,  dmg:16, speed:2.0, ranged:false, runeType:'fire' },
};

const CHICKEN_TRANSFORM = {
  air:   { color:'#c8f0ff', wingScale:2.0, label:'Air Chicken',   dmg:12, speed:2.5, atkRange:80,  projectile:true,  atkLabel:'Wind Slash'  },
  earth: { color:'#b8a060', wingScale:1.0, label:'Earth Chicken', dmg:20, speed:1.4, atkRange:50,  projectile:false, atkLabel:'Ground Smash' },
  water: { color:'#6699ff', wingScale:1.2, label:'Water Chicken', dmg:14, speed:2.0, atkRange:120, projectile:true,  atkLabel:'Water Bolt'  },
  fire:  { color:'#ff6622', wingScale:1.3, label:'Fire Chicken',  dmg:18, speed:1.8, atkRange:100, projectile:true,  atkLabel:'Fireball'    },
};

const FARM_SIZE = 4000;
const AREA_RADIUS = 600;
const AREAS = {
  farm:     { x:0,           y:0,           label:'The Farm',      color:'#2a4a1a' },
  gym:      { x:-1600,       y:-800,        label:'The Gym',       color:'#4a3a1a' },
  beach:    { x:1600,        y:-1000,       label:'The Beach',     color:'#4a4010' },
  mountain: { x:-1400,       y:1000,        label:'The Mountain',  color:'#3a3a3a' },
  volcano:  { x:1400,        y:1000,        label:'The Volcano',   color:'#4a1a0a' },
};

// ---------- Utilities ----------
function rnd(min,max){ return min + Math.random()*(max-min); }
function rndI(min,max){ return Math.floor(rnd(min,max+1)); }
function dist(a,b){ const dx=a.x-b.x,dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
function norm(dx,dy){ const l=Math.sqrt(dx*dx+dy*dy)||1; return [dx/l,dy/l]; }
function lerp(a,b,t){ return a+(b-a)*t; }

// ---------- Canvas Setup ----------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize',()=>{
  canvas.width=window.innerWidth;
  canvas.height=window.innerHeight;
});

// ---------- Input ----------
const keys = {};
let mouseX=0,mouseY=0,mouseDown=false;
window.addEventListener('keydown',e=>{
  keys[e.key.toLowerCase()]=true;
  handleKey(e.key.toLowerCase());
});
window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
canvas.addEventListener('mousemove',e=>{ mouseX=e.clientX; mouseY=e.clientY; });
canvas.addEventListener('mousedown',e=>{ mouseDown=true; handleClick(e); });
canvas.addEventListener('mouseup',()=>{ mouseDown=false; });

function handleKey(k){
  if(!G.running) return;
  if(k==='z') G.sleep();
  if(k==='c') G.toggleChickenPanel();
  if(k==='s') G.save();
  if(k==='l') G.load();
  if(k==='m') G.toggleMinimap();
  if(k==='e') G.interact();
  if(k==='f') G.playerAttack();
}
function handleClick(e){
  if(!G.running) return;
  // Feed panel buttons are HTML; canvas clicks = attack toward mouse
  G.playerAttack();
}

// ============================================================
// ENTITIES
// ============================================================

class Entity {
  constructor(x,y,size,color){
    this.x=x; this.y=y; this.size=size; this.color=color;
    this.hp=100; this.maxHp=100;
    this.vx=0; this.vy=0;
    this.dead=false;
    this.angle=0;
  }
  draw(cx,cy){} // override
  drawHpBar(cx,cy,sx,sy){
    if(this.hp>=this.maxHp) return;
    const bw=this.size*2, bh=4;
    const bx=sx-bw/2, by=sy-this.size-8;
    ctx.fillStyle='#550000';
    ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle='#e74c3c';
    ctx.fillRect(bx,by,bw*(this.hp/this.maxHp),bh);
  }
}

class Projectile {
  constructor(x,y,dx,dy,speed,dmg,color,owner){
    this.x=x; this.y=y;
    this.dx=dx; this.dy=dy;
    this.speed=speed; this.dmg=dmg;
    this.color=color; this.owner=owner; // 'player','chicken','enemy'
    this.life=60; this.dead=false;
    this.size=6;
  }
  update(){
    this.x+=this.dx*this.speed;
    this.y+=this.dy*this.speed;
    this.life--;
    if(this.life<=0) this.dead=true;
  }
  draw(sx,sy){
    ctx.beginPath();
    ctx.arc(sx,sy,this.size,0,TWO_PI);
    ctx.fillStyle=this.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx,sy,this.size*0.5,0,TWO_PI);
    ctx.fillStyle='#fff';
    ctx.fill();
  }
}

// ---------- Rune pickup ----------
class RunePickup {
  constructor(x,y,type){
    this.x=x; this.y=y; this.type=type;
    this.dead=false; this.size=10;
    this.bobPhase=rnd(0,TWO_PI);
  }
  draw(sx,sy){
    const bob=Math.sin(Date.now()/500+this.bobPhase)*4;
    const COLORS={air:'#87CEEB',earth:'#8B6914',water:'#4169E1',fire:'#FF4500',
                  buff:'#FFD700',sand:'#F4A460',rock:'#aaa',lava:'#FF6347'};
    const EMOJI={air:'💨',earth:'🪨',water:'💧',fire:'🔥',buff:'💪',sand:'🏖️',rock:'⛰️',lava:'🌋'};
    ctx.beginPath();
    ctx.arc(sx,sy+bob,this.size,0,TWO_PI);
    ctx.fillStyle=COLORS[this.type]||'#fff';
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.5)';
    ctx.lineWidth=1.5;
    ctx.stroke();
    ctx.font='12px serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(EMOJI[this.type],sx,sy+bob);
  }
}

// ---------- Enemy ----------
class Enemy {
  constructor(x,y,defKey,areaKey){
    this.x=x; this.y=y;
    const def = areaKey ? AREA_ENEMY[areaKey] : ENEMY_DEFS[defKey];
    this.defKey=defKey||areaKey;
    this.areaKey=areaKey||null;
    this.label=def.label||def.name;
    this.color=def.color;
    this.size=def.size;
    this.maxHp=def.hp; this.hp=def.hp;
    this.dmg=def.dmg; this.speed=def.speed;
    this.ranged=def.ranged||false;
    this.runeType=def.runeType||AREA_RUNE[areaKey]||'air';
    this.dead=false;
    this.attackCooldown=0;
    this.atkRange=this.ranged?220:60;
    this.aggroRange=300;
    this.vx=0; this.vy=0;
    this.angle=0;
    this.stunTime=0;
    this.phase=0; // boss phases
  }
  update(player,projectiles){
    if(this.dead||this.stunTime>0){ this.stunTime--; return; }
    const dx=player.x-this.x, dy=player.y-player.y;
    const d=dist(this,player);
    if(d<this.aggroRange){
      if(d>this.atkRange){
        const [nx,ny]=norm(player.x-this.x,player.y-this.y);
        this.x+=nx*this.speed;
        this.y+=ny*this.speed;
        this.angle=Math.atan2(player.y-this.y,player.x-this.x);
      }
      if(this.attackCooldown<=0 && d<this.atkRange){
        this.attackCooldown=90;
        if(this.ranged){
          const [nx,ny]=norm(player.x-this.x,player.y-this.y);
          projectiles.push(new Projectile(this.x,this.y,nx,ny,4,this.dmg,this.color,'enemy'));
        } else {
          player.takeDamage(this.dmg);
        }
      }
    }
    if(this.attackCooldown>0) this.attackCooldown--;
  }
  draw(sx,sy){
    ctx.save();
    ctx.translate(sx,sy);
    ctx.rotate(this.angle);

    if(this.defKey==='heavy_horse'||this.areaKey==='gym'){
      // Ball body
      ctx.beginPath();
      ctx.arc(0,0,this.size,0,TWO_PI);
      ctx.fillStyle=this.color;
      ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.4)';
      ctx.lineWidth=2;
      ctx.stroke();
      // Head
      ctx.beginPath();
      ctx.ellipse(this.size,0,this.size*0.55,this.size*0.4,0,0,TWO_PI);
      ctx.fillStyle=this.color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0,0,this.size,0,TWO_PI);
      ctx.fillStyle=this.color;
      ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.3)';
      ctx.lineWidth=2;
      ctx.stroke();
    }

    // Eyes
    ctx.fillStyle='#000';
    ctx.beginPath(); ctx.arc(this.size*0.35,-this.size*0.3,2.5,0,TWO_PI); ctx.fill();
    ctx.beginPath(); ctx.arc(this.size*0.35,this.size*0.3,2.5,0,TWO_PI); ctx.fill();

    // Psychic sheep third eye
    if(this.defKey==='psychic_sheep'){
      ctx.fillStyle='#ff00ff';
      ctx.beginPath(); ctx.arc(this.size*0.5,0,3.5,0,TWO_PI); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(this.size*0.5,0,1.5,0,TWO_PI); ctx.fill();
    }
    // Cyborg cow parts
    if(this.defKey==='cyborg_cow'){
      ctx.fillStyle='#445566';
      ctx.fillRect(-this.size*0.2,-this.size*0.8,this.size*0.4,this.size*0.5);
      ctx.fillStyle='#66aaff';
      ctx.beginPath(); ctx.arc(0,-this.size*0.55,4,0,TWO_PI); ctx.fill();
    }
    // Monster mutt horns
    if(this.defKey==='monster_mutt'){
      ctx.fillStyle='#cc4400';
      ctx.beginPath();
      ctx.moveTo(-this.size*0.3,-this.size*0.8);
      ctx.lineTo(-this.size*0.1,-this.size*1.4);
      ctx.lineTo(this.size*0.1,-this.size*0.8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(this.size*0.1,-this.size*0.8);
      ctx.lineTo(this.size*0.3,-this.size*1.4);
      ctx.lineTo(this.size*0.5,-this.size*0.8);
      ctx.fill();
    }

    ctx.restore();
    this.drawHpBar(sx,sy);
  }
  drawHpBar(sx,sy){
    if(this.hp>=this.maxHp) return;
    const bw=this.size*2+8, bh=4;
    ctx.fillStyle='#550000';
    ctx.fillRect(sx-bw/2,sy-this.size-10,bw,bh);
    ctx.fillStyle='#e74c3c';
    ctx.fillRect(sx-bw/2,sy-this.size-10,bw*(this.hp/this.maxHp),bh);
  }
  takeDamage(dmg){
    this.hp-=dmg;
    this.stunTime=8;
    if(this.hp<=0){ this.dead=true; return true; }
    return false;
  }
}

// ---------- Boss ----------
class Boss extends Enemy {
  constructor(){
    super(0,-300,null,null);
    this.label='Farmer Jim';
    this.color='#8B4513';
    this.size=70;
    this.maxHp=2000; this.hp=2000;
    this.dmg=35; this.speed=0.7;
    this.ranged=true;
    this.atkRange=350;
    this.aggroRange=9999;
    this.phase=1;
    this.specialCooldown=0;
    this.isBoss=true;
  }
  update(player,projectiles){
    if(this.dead) return;
    const d=dist(this,player);
    // Phase transitions
    if(this.hp<1500&&this.phase===1){ this.phase=2; this.speed=1.0; this.dmg=45; G.msg('Farmer Jim: PHASE 2! "I\'ll turn you all into nuggets!"','#ff4400'); }
    if(this.hp<800&&this.phase===2){ this.phase=3; this.speed=1.4; this.dmg=55; G.msg('Farmer Jim: PHASE 3! "NO MORE MISTER NICE FARMER!"','#ff0000'); }

    const [nx,ny]=norm(player.x-this.x,player.y-this.y);
    if(d>this.atkRange*0.7){
      this.x+=nx*this.speed;
      this.y+=ny*this.speed;
    }
    this.angle=Math.atan2(player.y-this.y,player.x-this.x);

    if(this.attackCooldown<=0){
      this.attackCooldown=50;
      // Triple shot
      for(let a=-0.3;a<=0.31;a+=0.3){
        const ang=Math.atan2(player.y-this.y,player.x-this.x)+a;
        projectiles.push(new Projectile(this.x,this.y,Math.cos(ang),Math.sin(ang),5,this.dmg,'#ff4400','enemy'));
      }
    }
    this.attackCooldown--;

    if(this.specialCooldown<=0){
      this.specialCooldown=200;
      // Ring attack
      for(let i=0;i<8;i++){
        const a=(i/8)*TWO_PI;
        projectiles.push(new Projectile(this.x,this.y,Math.cos(a),Math.sin(a),3.5,this.dmg*0.7,'#ff8800','enemy'));
      }
      G.msg('Farmer Jim uses RING OF PITCHFORKS!','#ff6600');
    }
    this.specialCooldown--;
  }
  draw(sx,sy){
    ctx.save();
    ctx.translate(sx,sy);

    // Body
    ctx.beginPath();
    ctx.arc(0,10,this.size*0.7,0,TWO_PI);
    ctx.fillStyle='#5a2d0c';
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0,-this.size*0.35,this.size*0.55,0,TWO_PI);
    ctx.fillStyle='#c68642';
    ctx.fill();

    // Overalls
    ctx.fillStyle='#3366aa';
    ctx.fillRect(-this.size*0.45,0,this.size*0.9,this.size*0.55);
    ctx.beginPath();
    ctx.arc(0,0,this.size*0.5,0,Math.PI);
    ctx.fillStyle='#3366aa';
    ctx.fill();

    // Pitchfork
    ctx.strokeStyle='#8B6914';
    ctx.lineWidth=5;
    ctx.beginPath();
    ctx.moveTo(this.size*0.7,-this.size*0.2);
    ctx.lineTo(this.size*0.7,-this.size*0.9);
    ctx.stroke();
    ctx.strokeStyle='#aaa';
    ctx.lineWidth=3;
    for(let i=-1;i<=1;i++){
      ctx.beginPath();
      ctx.moveTo(this.size*0.7+i*8,-this.size*0.9);
      ctx.lineTo(this.size*0.7+i*8,-this.size*1.15);
      ctx.stroke();
    }

    // Eyes (angry)
    ctx.fillStyle='#cc0000';
    ctx.beginPath(); ctx.arc(-this.size*0.15,-this.size*0.4,5,0,TWO_PI); ctx.fill();
    ctx.beginPath(); ctx.arc(this.size*0.15,-this.size*0.4,5,0,TWO_PI); ctx.fill();
    // Third eye (boss)
    ctx.fillStyle='#ff00ff';
    ctx.beginPath(); ctx.arc(0,-this.size*0.5,7,0,TWO_PI); ctx.fill();
    ctx.fillStyle='#000';
    ctx.beginPath(); ctx.arc(0,-this.size*0.5,3,0,TWO_PI); ctx.fill();

    // Hat
    ctx.fillStyle='#3a2010';
    ctx.fillRect(-this.size*0.4,-this.size*0.75,this.size*0.8,8);
    ctx.fillRect(-this.size*0.25,-this.size*0.75-30,this.size*0.5,32);

    ctx.restore();
    this.drawHpBar(sx,sy);
    // Boss hp bar (big)
    const bw=300, bh=18;
    const bx=canvas.width/2-bw/2, by=canvas.height-60;
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(bx-4,by-4,bw+8,bh+8);
    ctx.fillStyle='#550000';
    ctx.fillRect(bx,by,bw,bh);
    const pct=Math.max(0,this.hp/this.maxHp);
    ctx.fillStyle=pct>0.5?'#e74c3c':pct>0.25?'#e67e22':'#ff0000';
    ctx.fillRect(bx,by,bw*pct,bh);
    ctx.fillStyle='#fff';
    ctx.font='bold 13px sans-serif';
    ctx.textAlign='center';
    ctx.fillText(`FARMER JIM — ${Math.ceil(this.hp)} / ${this.maxHp}`,canvas.width/2,by+13);
  }
}

// ---------- Chicken ----------
class Chicken {
  constructor(x,y,gender){
    this.x=x; this.y=y;
    this.gender=gender; // 'hen'|'rooster'
    this.transform=null; // null | 'air'|'earth'|'water'|'fire'
    this.runesFed=[];
    this.buffLevel=0;
    this.following=false;
    this.maxHp=40; this.hp=40;
    this.dead=false;
    this.angle=0;
    this.attackCooldown=0;
    this.target=null;
    this.wanderTimer=rndI(60,180);
    this.wx=x+rnd(-60,60); this.wy=y+rnd(-60,60);
    this.id=Math.random().toString(36).slice(2,8);
    this.label = gender==='hen'?'Hen':'Rooster';
  }
  get speed(){ return (this.transform ? CHICKEN_TRANSFORM[this.transform].speed : 1.6)*(1+this.buffLevel*0.1); }
  get dmg(){   return (this.transform ? CHICKEN_TRANSFORM[this.transform].dmg   : 8)*(1+this.buffLevel*0.3); }
  get atkRange(){ return this.transform ? CHICKEN_TRANSFORM[this.transform].atkRange : 45; }
  get isProjectile(){ return this.transform ? CHICKEN_TRANSFORM[this.transform].projectile : false; }
  get size(){ return (12+(this.gender==='rooster'?2:0))*(1+this.buffLevel*0.2); }
  get color(){ return this.transform ? CHICKEN_TRANSFORM[this.transform].color : (this.gender==='rooster'?'#ffcc44':'#ffe080'); }

  update(player,enemies,projectiles){
    if(this.dead) return;
    if(this.following){
      const d=dist(this,player);
      if(d>80){
        const [nx,ny]=norm(player.x-this.x,player.y-this.y);
        this.x+=nx*this.speed;
        this.y+=ny*this.speed;
        this.angle=Math.atan2(player.y-this.y,player.x-this.x);
      }
      // Attack nearest enemy
      let nearest=null,nearD=this.atkRange;
      for(const e of enemies){
        if(e.dead) continue;
        const d=dist(this,e);
        if(d<nearD){ nearD=d; nearest=e; }
      }
      if(nearest && this.attackCooldown<=0){
        this.attackCooldown=40;
        if(this.isProjectile){
          const PCOL={air:'#87CEEB',earth:'#8B6914',water:'#4169E1',fire:'#FF4500'};
          const [nx,ny]=norm(nearest.x-this.x,nearest.y-this.y);
          projectiles.push(new Projectile(this.x,this.y,nx,ny,5,this.dmg,PCOL[this.transform]||'#fff','chicken'));
        } else {
          nearest.takeDamage(this.dmg);
        }
      }
    } else {
      // Wander
      this.wanderTimer--;
      if(this.wanderTimer<=0){
        this.wx=this.x+rnd(-100,100);
        this.wy=this.y+rnd(-100,100);
        this.wanderTimer=rndI(80,200);
      }
      const d=dist({x:this.wx,y:this.wy},{x:this.x,y:this.y});
      if(d>8){
        const [nx,ny]=norm(this.wx-this.x,this.wy-this.y);
        this.x+=nx*0.7;
        this.y+=ny*0.7;
        this.angle=Math.atan2(this.wy-this.y,this.wx-this.x);
      }
    }
    if(this.attackCooldown>0) this.attackCooldown--;
  }

  draw(sx,sy){
    const s=this.size;
    const t=this.transform;
    const col=this.color;
    const bs=1+this.buffLevel*0.15;

    ctx.save();
    ctx.translate(sx,sy);
    ctx.rotate(this.angle);
    ctx.scale(bs,bs);

    // Wings
    const wScale=t?CHICKEN_TRANSFORM[t].wingScale:1.0;
    ctx.fillStyle=t?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(-s*0.2,-s*0.8,s*0.5*wScale,s*0.3,Math.PI*0.2,0,TWO_PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s*0.2,-s*0.8,s*0.5*wScale,s*0.3,-Math.PI*0.2,0,TWO_PI);
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.ellipse(0,0,s,s*1.1,0,0,TWO_PI);
    ctx.fillStyle=col;
    ctx.fill();

    // Fire effect
    if(t==='fire'){
      for(let i=0;i<4;i++){
        const fa=i*Math.PI/2+Date.now()/200;
        ctx.beginPath();
        ctx.arc(Math.cos(fa)*s*0.7,Math.sin(fa)*s*0.7,4,0,TWO_PI);
        ctx.fillStyle=`hsl(${20+i*10},100%,${50+i*5}%)`;
        ctx.fill();
      }
    }
    // Water droplets
    if(t==='water'){
      ctx.fillStyle='rgba(100,150,255,0.4)';
      ctx.beginPath();
      ctx.arc(-s*0.6,0,4,0,TWO_PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s*0.6,0,4,0,TWO_PI);
      ctx.fill();
    }
    // Earth rocky patches
    if(t==='earth'){
      ctx.fillStyle='#6b5a30';
      ctx.fillRect(-s*0.4,-s*0.3,s*0.3,s*0.3);
      ctx.fillRect(s*0.1,s*0.1,s*0.3,s*0.3);
    }
    // Air Chicken — wind rings
    if(t==='air'){
      ctx.strokeStyle='rgba(135,206,235,0.5)';
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(0,0,s*1.3,0,TWO_PI);
      ctx.stroke();
    }

    // Head
    ctx.beginPath();
    ctx.arc(s*0.6,0,s*0.5,0,TWO_PI);
    ctx.fillStyle=col;
    ctx.fill();

    // Buff muscles
    if(this.buffLevel>0){
      ctx.fillStyle='rgba(255,200,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(-s*0.7,0,s*0.35,s*0.25,Math.PI*0.3,0,TWO_PI);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s*0.5,s*0.5,s*0.3,s*0.2,-Math.PI*0.3,0,TWO_PI);
      ctx.fill();
    }

    // Comb
    ctx.fillStyle='#e00';
    ctx.beginPath();
    ctx.moveTo(s*0.4,-s*0.35);
    ctx.lineTo(s*0.5,-s*0.65);
    ctx.lineTo(s*0.6,-s*0.35);
    ctx.lineTo(s*0.7,-s*0.6);
    ctx.lineTo(s*0.8,-s*0.35);
    ctx.fill();

    // Eye
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.arc(s*0.85,-s*0.05,s*0.1,0,TWO_PI);
    ctx.fill();

    // Beak
    ctx.fillStyle='#e8a020';
    ctx.beginPath();
    ctx.moveTo(s*1.05,-s*0.05);
    ctx.lineTo(s*1.35,0);
    ctx.lineTo(s*1.05,s*0.1);
    ctx.fill();

    // Rooster tail
    if(this.gender==='rooster'){
      ctx.fillStyle='#cc4400';
      ctx.beginPath();
      ctx.moveTo(-s*0.9,0);
      ctx.lineTo(-s*1.5,-s*0.5);
      ctx.lineTo(-s*1.1,0);
      ctx.lineTo(-s*1.5,s*0.3);
      ctx.lineTo(-s*0.9,0);
      ctx.fill();
    }

    ctx.restore();
    this.drawHpBar(sx,sy,s);
  }
  drawHpBar(sx,sy,s){
    if(this.hp>=this.maxHp) return;
    const bw=s*2+8, bh=3;
    ctx.fillStyle='#550000';
    ctx.fillRect(sx-bw/2,sy-s-8,bw,bh);
    ctx.fillStyle='#22ee44';
    ctx.fillRect(sx-bw/2,sy-s-8,bw*(this.hp/this.maxHp),bh);
  }
  takeDamage(dmg){
    this.hp-=dmg;
    if(this.hp<=0){ this.dead=true; return true; }
    return false;
  }
  feedRune(type){
    if(this.transform) return false; // already transformed
    if(!RUNE_TYPES.includes(type)) return false;
    this.transform=type;
    this.runesFed.push(type);
    this.following=true;
    this.maxHp=80+(this.buffLevel*20);
    this.hp=this.maxHp;
    this.label=CHICKEN_TRANSFORM[type].label;
    return true;
  }
  applyBuff(){
    this.buffLevel++;
    this.maxHp+=30;
    this.hp=Math.min(this.hp+30,this.maxHp);
  }
}

// ---------- Egg ----------
class Egg {
  constructor(x,y){
    this.x=x; this.y=y;
    this.dead=false; this.size=8;
  }
  draw(sx,sy){
    ctx.save();
    ctx.translate(sx,sy);
    ctx.beginPath();
    ctx.ellipse(0,0,this.size*0.7,this.size,0,0,TWO_PI);
    ctx.fillStyle='#ffe8b0';
    ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.2)';
    ctx.lineWidth=1;
    ctx.stroke();
    ctx.restore();
  }
}

// ============================================================
// WORLD TILES (decorative)
// ============================================================
function drawFarmTile(ctx,wx,wy,cameraX,cameraY){
  const sx=wx-cameraX+canvas.width/2;
  const sy=wy-cameraY+canvas.height/2;
  // Only draw if on screen
  if(sx<-100||sx>canvas.width+100||sy<-100||sy>canvas.height+100) return;
}

// ============================================================
// PLAYER
// ============================================================
class Player {
  constructor(){
    this.x=0; this.y=0;
    this.maxHp=100; this.hp=100;
    this.speed=3;
    this.size=16;
    this.dead=false;
    this.angle=0;
    this.attackCooldown=0;
    this.atkRange=70;
    this.dmg=25;
    this.invincible=0;
    this.color='#4488ff';
  }
  takeDamage(dmg){
    if(this.invincible>0) return;
    this.hp-=dmg;
    this.invincible=30;
    if(this.hp<=0){ this.hp=0; this.dead=true; }
  }
  draw(sx,sy){
    ctx.save();
    ctx.translate(sx,sy);
    // Flash when invincible
    if(this.invincible>0 && Math.floor(this.invincible/4)%2===1){
      ctx.globalAlpha=0.4;
    }
    ctx.rotate(this.angle);

    // Body
    ctx.beginPath();
    ctx.arc(0,0,this.size,0,TWO_PI);
    ctx.fillStyle='#4488ff';
    ctx.fill();
    // Torso
    ctx.fillStyle='#336699';
    ctx.fillRect(-this.size*0.4,this.size*0.1,this.size*0.8,this.size*0.7);
    // Head
    ctx.beginPath();
    ctx.arc(this.size*0.5,-this.size*0.1,this.size*0.55,0,TWO_PI);
    ctx.fillStyle='#ffd090';
    ctx.fill();
    // Hair
    ctx.fillStyle='#553300';
    ctx.beginPath();
    ctx.arc(this.size*0.5,-this.size*0.35,this.size*0.45,Math.PI,TWO_PI);
    ctx.fill();
    // Eye
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.arc(this.size*0.78,-this.size*0.1,2.5,0,TWO_PI);
    ctx.fill();
    // Sword/weapon indicator
    ctx.fillStyle='#ccc';
    ctx.fillRect(this.size*0.9,-3,this.size*0.8,5);
    ctx.fillStyle='#8B6914';
    ctx.fillRect(this.size*0.85,-5,8,9);

    ctx.restore();
    if(this.invincible>0) ctx.globalAlpha=1;
  }
}

// ============================================================
// MAIN GAME OBJECT
// ============================================================
const G = {
  running: false,
  day: 1,
  timeOfDay: 0,      // 0..1 per day  (advances with Z or auto in boss)
  chickens: [],
  eggs: [],
  enemies: [],
  projectiles: [],
  runes: {},
  runePickups: [],
  player: null,
  camera: {x:0,y:0},
  unlockedAreas: { farm:true, gym:false, beach:false, mountain:false, volcano:false },
  areaRuneFed: { air:0, earth:0, water:0, fire:0 },
  currentArea: 'farm',
  isBossFight: false,
  boss: null,
  victoryActive: false,
  victoryFrame: 0,
  msgQueue: [],
  msgEl: document.getElementById('msg-box'),
  lastTime: 0,
  animId: null,
  farmObjects: [],
  interactTarget: null,

  // Rune counts
  initRunes(){
    ALL_RUNES.forEach(r=>{ this.runes[r]=0; });
  },

  start(){
    this.initRunes();
    this.player=new Player();
    this.day=1;
    this.chickens=[];
    this.eggs=[];
    this.enemies=[];
    this.projectiles=[];
    this.runePickups=[];
    this.isBossFight=false;
    this.boss=null;
    this.victoryActive=false;
    this.areaRuneFed={air:0,earth:0,water:0,fire:0};
    this.unlockedAreas={farm:true,gym:false,beach:false,mountain:false,volcano:false};
    this.currentArea='farm';

    // Spawn starting chickens
    for(let i=0;i<15;i++) this.chickens.push(new Chicken(rnd(-200,200),rnd(-200,200),'hen'));
    for(let i=0;i<15;i++) this.chickens.push(new Chicken(rnd(-200,200),rnd(-200,200),'rooster'));

    this.buildFarm();
    this.spawnInitialPickups();
    this.spawnEnemiesForDay();

    document.getElementById('start-screen').classList.add('hidden');
    this.running=true;
    this.msg("The chickens gather around you... 🐔","#ffe080");
    setTimeout(()=>this.msg('"Farmer Jim is going to EAT US! Find the runes and save us!"',"#ffcc44"),2000);
    this.loop(0);
  },

  buildFarm(){
    this.farmObjects=[];
    // Barn
    this.farmObjects.push({type:'barn',x:150,y:-80});
    // Fence posts
    for(let i=-5;i<=5;i++){
      this.farmObjects.push({type:'fence',x:i*80,y:300});
      this.farmObjects.push({type:'fence',x:i*80,y:-320});
      this.farmObjects.push({type:'fence',x:320,y:i*80});
      this.farmObjects.push({type:'fence',x:-320,y:i*80});
    }
    // Trees around farm
    for(let i=0;i<30;i++){
      const angle=rnd(0,TWO_PI), r=rnd(350,600);
      this.farmObjects.push({type:'tree',x:Math.cos(angle)*r,y:Math.sin(angle)*r});
    }
    // Hay bales
    for(let i=0;i<8;i++){
      this.farmObjects.push({type:'hay',x:rnd(-280,280),y:rnd(-280,280)});
    }
    // Area landmarks
    this.farmObjects.push({type:'gym_sign',  x:AREAS.gym.x,      y:AREAS.gym.y});
    this.farmObjects.push({type:'beach_sign', x:AREAS.beach.x,   y:AREAS.beach.y});
    this.farmObjects.push({type:'mtn_sign',   x:AREAS.mountain.x,y:AREAS.mountain.y});
    this.farmObjects.push({type:'volcano_sign',x:AREAS.volcano.x,y:AREAS.volcano.y});
  },

  spawnInitialPickups(){
    // Scatter rune pickups around the farm
    const zones=[
      {type:'air',  cx:-200, cy:-150, count:6},
      {type:'earth',cx:200,  cy:150,  count:6},
      {type:'water',cx:150,  cy:-200, count:6},
      {type:'fire', cx:-150, cy:200,  count:6},
    ];
    for(const z of zones){
      for(let i=0;i<z.count;i++){
        this.runePickups.push(new RunePickup(z.cx+rnd(-120,120),z.cy+rnd(-120,120),z.type));
      }
    }
  },

  spawnEnemiesForDay(){
    const day=this.day;
    const scale=1+day*0.04;
    const count=Math.floor(3+day*0.4);
    const types=['cyborg_cow','psychic_sheep','heavy_horse','monster_mutt'];
    for(let i=0;i<count;i++){
      const eType=types[i%types.length];
      const angle=rnd(0,TWO_PI), r=rnd(400,700);
      const e=new Enemy(Math.cos(angle)*r,Math.sin(angle)*r,eType,null);
      e.maxHp=Math.round(e.maxHp*scale);
      e.hp=e.maxHp;
      e.dmg=Math.round(e.dmg*scale);
      this.enemies.push(e);
    }
    // Spawn area enemies if unlocked
    for(const [areaKey,unlocked] of Object.entries(this.unlockedAreas)){
      if(!unlocked||areaKey==='farm') continue;
      const area=AREAS[areaKey];
      for(let i=0;i<3;i++){
        const angle=rnd(0,TWO_PI),r=rnd(100,AREA_RADIUS*0.8);
        const e=new Enemy(area.x+Math.cos(angle)*r,area.y+Math.sin(angle)*r,null,areaKey);
        e.maxHp=Math.round(e.maxHp*scale);
        e.hp=e.maxHp;
        this.enemies.push(e);
        // Spawn rune pickup in area
        this.runePickups.push(new RunePickup(area.x+rnd(-200,200),area.y+rnd(-200,200),AREA_RUNE[areaKey]));
      }
    }
  },

  sleep(){
    if(!this.running||this.isBossFight) return;
    this.day++;
    this.msg(`Day ${this.day} begins. The chickens lay their eggs!`,'#ffd700');

    // Hens lay eggs
    for(const c of this.chickens){
      if(c.dead||c.gender!=='hen') continue;
      this.eggs.push(new Egg(c.x+rnd(-20,20),c.y+rnd(-20,20)));
    }

    // Clean dead enemies, add new ones
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.spawnEnemiesForDay();

    // Refill some rune pickups
    const types=RUNE_TYPES;
    for(let i=0;i<4;i++){
      const t=types[rndI(0,3)];
      this.runePickups.push(new RunePickup(rnd(-400,400),rnd(-400,400),t));
    }

    if(this.day>=100 && !this.isBossFight){
      this.triggerBoss();
    }

    this.updateHUD();
  },

  triggerBoss(){
    this.isBossFight=true;
    document.getElementById('boss-screen').classList.remove('hidden');
  },

  startBoss(){
    document.getElementById('boss-screen').classList.add('hidden');
    this.boss=new Boss();
    this.enemies=[];
    this.msg('DAY 100 — FARMER JIM APPROACHES!','#ff0000');
  },

  playerAttack(){
    if(!this.running) return;
    if(this.player.attackCooldown>0) return;
    this.player.attackCooldown=20;

    // Direction toward mouse
    const sx=this.player.x-this.camera.x+canvas.width/2;
    const sy=this.player.y-this.camera.y+canvas.height/2;
    const [nx,ny]=norm(mouseX-sx,mouseY-sy);
    this.player.angle=Math.atan2(mouseY-sy,mouseX-sx);

    // Melee arc
    for(const e of this.enemies){
      const d=dist(this.player,e);
      if(d<this.player.atkRange+e.size){
        const killed=e.takeDamage(this.player.dmg);
        if(killed) this.onEnemyKilled(e);
      }
    }
    if(this.boss&&!this.boss.dead){
      const d=dist(this.player,this.boss);
      if(d<this.player.atkRange+this.boss.size){
        this.boss.takeDamage(this.player.dmg);
        if(this.boss.hp<=0) this.triggerVictory();
      }
    }

    // Ranged slash projectile
    this.projectiles.push(new Projectile(this.player.x,this.player.y,nx,ny,7,this.player.dmg,'#88ccff','player'));
  },

  onEnemyKilled(e){
    // Drop rune
    const runeType=e.runeType||'air';
    this.runePickups.push(new RunePickup(e.x,e.y,runeType));
    this.msg(`${e.label} defeated! Dropped a ${runeType} rune.`,'#88ff88');
  },

  interact(){
    if(!this.running) return;
    const p=this.player;
    // Check egg click range
    for(const egg of this.eggs){
      if(egg.dead) continue;
      if(dist(p,egg)<40){
        egg.dead=true;
        const gender=Math.random()<0.5?'hen':'rooster';
        const c=new Chicken(egg.x,egg.y,gender);
        this.chickens.push(c);
        this.msg(`A ${gender} hatched!`,'#ffe080');
        return;
      }
    }
    // Check rune pickup
    for(const rp of this.runePickups){
      if(rp.dead) continue;
      if(dist(p,rp)<40){
        rp.dead=true;
        this.runes[rp.type]++;
        this.msg(`Picked up ${rp.type} rune! (${this.runes[rp.type]} total)`,'#ffd700');
        this.updateHUD();
        return;
      }
    }
    // Check nearby chicken for feeding
    for(const c of this.chickens){
      if(c.dead) continue;
      if(dist(p,c)<60){
        this.openFeedPanel(c);
        return;
      }
    }
  },

  openFeedPanel(chicken){
    const panel=document.getElementById('feed-panel');
    const title=document.getElementById('feed-title');
    const desc=document.getElementById('feed-desc');
    const opts=document.getElementById('feed-options');
    title.textContent=`Feed a Rune to ${chicken.label}`;
    desc.textContent=chicken.transform?`Already transformed into a ${CHICKEN_TRANSFORM[chicken.transform].label}. Feed Buff Runes to strengthen!`:'Choose a rune to transform this chicken:';
    opts.innerHTML='';

    const addBtn=(label,type,count,action)=>{
      if(count<=0) return;
      const btn=document.createElement('button');
      btn.textContent=`${label} (${count} available)`;
      btn.onclick=()=>{ action(); this.closeFeedPanel(); this.updateHUD(); };
      opts.appendChild(btn);
    };

    if(!chicken.transform){
      RUNE_TYPES.forEach(r=>{
        addBtn(`${r.charAt(0).toUpperCase()+r.slice(1)} Rune → ${CHICKEN_TRANSFORM[r].label}`,r,this.runes[r],()=>{
          if(chicken.feedRune(r)){
            this.runes[r]--;
            this.areaRuneFed[r]++;
            this.msg(`${chicken.label} transformed into a ${CHICKEN_TRANSFORM[r].label}!`,'#ffd700');
            this.checkAreaUnlocks();
          }
        });
      });
    } else {
      // Buff runes
      addBtn(`💪 Buff Rune → BUFF UP!`,'buff',this.runes.buff,()=>{
        this.runes.buff--;
        chicken.applyBuff();
        this.msg(`${chicken.label} got BUFFER! (Level ${chicken.buffLevel})`,'#FFD700');
      });
    }

    if(opts.children.length===0){
      const p=document.createElement('p');
      p.textContent='No applicable runes to feed.';
      p.style.color='#aaa';
      opts.appendChild(p);
    }
    panel.classList.remove('hidden');
  },

  closeFeedPanel(){
    document.getElementById('feed-panel').classList.add('hidden');
  },

  checkAreaUnlocks(){
    for(const [rType,count] of Object.entries(this.areaRuneFed)){
      const areaKey=AREA_UNLOCK[rType];
      if(count>=10&&!this.unlockedAreas[areaKey]){
        this.unlockedAreas[areaKey]=true;
        const areaName=AREAS[areaKey].label;
        this.msg(`🔓 NEW AREA UNLOCKED: ${areaName}!`,'#00ff88');
        // Spawn some rune pickups there
        const area=AREAS[areaKey];
        for(let i=0;i<8;i++){
          this.runePickups.push(new RunePickup(area.x+rnd(-200,200),area.y+rnd(-200,200),AREA_RUNE[areaKey]));
        }
      }
    }
  },

  toggleChickenPanel(){
    const panel=document.getElementById('chicken-panel');
    if(panel.classList.contains('hidden')){
      this.renderChickenPanel();
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  },

  closeChickenPanel(){
    document.getElementById('chicken-panel').classList.add('hidden');
  },

  renderChickenPanel(){
    const list=document.getElementById('chicken-list');
    list.innerHTML='';
    const alive=this.chickens.filter(c=>!c.dead);
    alive.forEach(c=>{
      const div=document.createElement('div');
      div.className='chk-entry'+(c.following?' following':'')+(c.transform?' '+c.transform+'-t':'');
      div.innerHTML=`<b>${c.label}</b> ${c.transform?'★':''} HP:${Math.ceil(c.hp)}/${c.maxHp} ${c.buffLevel>0?'💪x'+c.buffLevel:''}`;
      const btn=document.createElement('button');
      btn.style='float:right;background:rgba(255,255,255,0.1);border:none;color:#fff;padding:2px 6px;border-radius:4px;cursor:pointer;font-size:11px;';
      btn.textContent=c.following?'Dismiss':'Follow';
      btn.onclick=()=>{
        c.following=!c.following;
        this.renderChickenPanel();
      };
      div.appendChild(btn);
      list.appendChild(div);
    });
    if(alive.length===0) list.innerHTML='<p style="color:#aaa">All chickens have fallen...</p>';
  },

  toggleMinimap(){
    const mp=document.getElementById('minimap-panel');
    mp.classList.toggle('hidden');
    if(!mp.classList.contains('hidden')) this.drawMinimap();
  },

  drawMinimap(){
    const mc=document.getElementById('minimapCanvas');
    const mctx=mc.getContext('2d');
    const scale=mc.width/FARM_SIZE;
    const cx=mc.width/2, cy=mc.height/2;
    mctx.fillStyle='#1a3320';
    mctx.fillRect(0,0,mc.width,mc.height);

    // Areas
    for(const [key,area] of Object.entries(AREAS)){
      if(!this.unlockedAreas[key]&&key!=='farm') continue;
      const ax=cx+area.x*scale, ay=cy+area.y*scale;
      mctx.beginPath();
      mctx.arc(ax,ay,AREA_RADIUS*scale,0,TWO_PI);
      mctx.fillStyle=area.color+'88';
      mctx.fill();
      mctx.fillStyle='#fff';
      mctx.font='8px sans-serif';
      mctx.textAlign='center';
      mctx.fillText(area.label,ax,ay);
    }

    // Player
    const px=cx+this.player.x*scale, py=cy+this.player.y*scale;
    mctx.beginPath();
    mctx.arc(px,py,3,0,TWO_PI);
    mctx.fillStyle='#4488ff';
    mctx.fill();
  },

  save(){
    const data={
      day:this.day,
      runes:this.runes,
      playerHp:this.player.hp,
      unlockedAreas:this.unlockedAreas,
      areaRuneFed:this.areaRuneFed,
      chickens:this.chickens.map(c=>({
        x:c.x,y:c.y,gender:c.gender,transform:c.transform,
        buffLevel:c.buffLevel,following:c.following,hp:c.hp
      })),
    };
    localStorage.setItem('buffchickens_save',JSON.stringify(data));
    this.msg('Game saved! 💾','#88ff88');
  },

  load(){
    const raw=localStorage.getItem('buffchickens_save');
    if(!raw){ this.msg('No save found.','#ff8888'); return; }
    const data=JSON.parse(raw);
    if(!this.running){
      this.start();
    }
    this.day=data.day;
    this.runes=data.runes;
    this.player.hp=data.playerHp;
    this.unlockedAreas=data.unlockedAreas;
    this.areaRuneFed=data.areaRuneFed;
    this.chickens=data.chickens.map(cd=>{
      const c=new Chicken(cd.x,cd.y,cd.gender);
      c.transform=cd.transform;
      c.buffLevel=cd.buffLevel;
      c.following=cd.following;
      c.hp=cd.hp;
      if(cd.transform) c.label=CHICKEN_TRANSFORM[cd.transform].label;
      return c;
    });
    this.updateHUD();
    this.msg('Game loaded! 💾','#88ff88');
  },

  msg(text,color='#fff'){
    const el=document.createElement('div');
    el.className='msg';
    el.style.color=color;
    el.textContent=text;
    this.msgEl.appendChild(el);
    setTimeout(()=>el.remove(),3200);
  },

  updateHUD(){
    const alive=this.chickens.filter(c=>!c.dead);
    const eggs=this.eggs.filter(e=>!e.dead);
    document.getElementById('day-label').textContent=`Day ${this.day} / 100`;
    document.getElementById('day-bar-fill').style.width=`${this.day}%`;
    document.getElementById('hp-bar-fill').style.width=`${(this.player.hp/this.player.maxHp)*100}%`;
    document.getElementById('hp-text').textContent=`${Math.ceil(this.player.hp)}/${this.player.maxHp}`;
    for(const r of ALL_RUNES){
      const el=document.getElementById(`r-${r}`);
      if(el) el.textContent=this.runes[r]||0;
    }
    document.getElementById('chk-count').textContent=alive.length;
    document.getElementById('egg-count').textContent=eggs.length;
    document.getElementById('area-name').textContent=AREAS[this.currentArea]?.label||'The Farm';
  },

  detectArea(){
    let closest='farm', closestD=Infinity;
    for(const [key,area] of Object.entries(AREAS)){
      if(!this.unlockedAreas[key]) continue;
      const d=dist(this.player,{x:area.x,y:area.y});
      if(d<AREA_RADIUS && d<closestD){ closest=key; closestD=d; }
    }
    if(closest!==this.currentArea){
      this.currentArea=closest;
      this.msg(`Entered: ${AREAS[closest].label}`,'#aaffaa');
      this.updateHUD();
    }
  },

  triggerVictory(){
    this.running=false;
    document.getElementById('victory-screen').classList.remove('hidden');
    this.victoryActive=true;
    this.victoryFrame=0;
    this.animateVictory();
  },

  animateVictory(){
    const vc=document.getElementById('victory-canvas');
    const vctx=vc.getContext('2d');
    const frame=this.victoryFrame++;
    vctx.clearRect(0,0,vc.width,vc.height);

    // Background
    vctx.fillStyle='#1a2e00';
    vctx.fillRect(0,0,vc.width,vc.height);

    // Buff Chicken walking across
    const walkX=(frame*2)%(vc.width+200)-100;
    const walkY=vc.height/2+20;
    this.drawBuffChicken(vctx,walkX,walkY,frame);

    if(this.victoryActive) requestAnimationFrame(()=>this.animateVictory());
  },

  drawBuffChicken(vctx,x,y,frame){
    const s=40;
    const flexPhase=Math.floor(frame/30)%2;
    vctx.save();
    vctx.translate(x,y);

    // Body
    vctx.beginPath();
    vctx.ellipse(0,0,s*1.2,s*1.3,0,0,TWO_PI);
    vctx.fillStyle='#ffd700';
    vctx.fill();
    vctx.strokeStyle='#cc9900';
    vctx.lineWidth=2;
    vctx.stroke();

    // Huge muscles
    vctx.fillStyle='#ffaa00';
    if(flexPhase===0){
      vctx.beginPath(); vctx.ellipse(-s*1.3,-s*0.3,s*0.7,s*0.5,Math.PI*0.3,0,TWO_PI); vctx.fill();
      vctx.beginPath(); vctx.ellipse(s*1.3,-s*0.3,s*0.7,s*0.5,-Math.PI*0.3,0,TWO_PI); vctx.fill();
    } else {
      // Flexing! Arms up
      vctx.beginPath(); vctx.ellipse(-s*1.1,-s*1.0,s*0.7,s*0.5,Math.PI*0.7,0,TWO_PI); vctx.fill();
      vctx.beginPath(); vctx.ellipse(s*1.1,-s*1.0,s*0.7,s*0.5,-Math.PI*0.7,0,TWO_PI); vctx.fill();
      // Stars when flexing
      vctx.fillStyle='#fff';
      for(let i=0;i<5;i++){
        const a=(i/5)*TWO_PI;
        vctx.beginPath();
        vctx.arc(Math.cos(a)*s*1.8,Math.sin(a)*s*1.8-40,4,0,TWO_PI);
        vctx.fill();
      }
    }

    // Head
    vctx.beginPath();
    vctx.arc(s*0.6,-s*0.5,s*0.65,0,TWO_PI);
    vctx.fillStyle='#ffd700';
    vctx.fill();
    // Comb
    vctx.fillStyle='#e00';
    for(let i=0;i<3;i++){
      vctx.beginPath();
      vctx.arc(s*0.4+i*12,-s*1.05,7,Math.PI,TWO_PI);
      vctx.fill();
    }
    // Eye
    vctx.fillStyle='#000';
    vctx.beginPath(); vctx.arc(s*0.95,-s*0.5,4,0,TWO_PI); vctx.fill();
    // Sunglasses
    vctx.fillStyle='rgba(0,0,0,0.7)';
    vctx.fillRect(s*0.7,-s*0.65,s*0.7,s*0.25);
    vctx.strokeStyle='#222';
    vctx.lineWidth=2;
    vctx.strokeRect(s*0.7,-s*0.65,s*0.7,s*0.25);

    // Legs (walking animation)
    const legSwing=Math.sin(frame/8)*15;
    vctx.fillStyle='#ffaa00';
    vctx.beginPath();
    vctx.moveTo(-s*0.3,s*1.1);
    vctx.lineTo(-s*0.3+legSwing,s*1.7);
    vctx.lineTo(-s*0.1+legSwing,s*1.7);
    vctx.lineTo(-s*0.1,s*1.1);
    vctx.fill();
    vctx.beginPath();
    vctx.moveTo(s*0.1,s*1.1);
    vctx.lineTo(s*0.1-legSwing,s*1.7);
    vctx.lineTo(s*0.3-legSwing,s*1.7);
    vctx.lineTo(s*0.3,s*1.1);
    vctx.fill();

    vctx.restore();
  },

  // ---- Main Loop ----
  loop(ts){
    if(!this.running) return;
    this.animId=requestAnimationFrame(t=>this.loop(t));
    const dt=Math.min(ts-this.lastTime,50);
    this.lastTime=ts;

    this.update();
    this.render();
  },

  update(){
    const p=this.player;

    // Player movement
    let dx=0,dy=0;
    if(keys['w']||keys['arrowup'])    dy=-1;
    if(keys['s']||keys['arrowdown'])  dy=1;
    if(keys['a']||keys['arrowleft'])  dx=-1;
    if(keys['d']||keys['arrowright']) dx=1;
    if(dx||dy){
      const [nx,ny]=norm(dx,dy);
      p.x+=nx*p.speed;
      p.y+=ny*p.speed;
      const sx=p.x-this.camera.x+canvas.width/2;
      const sy=p.y-this.camera.y+canvas.height/2;
      if(dx||dy) p.angle=Math.atan2(ny,nx);
    }
    if(p.invincible>0) p.invincible--;
    if(p.attackCooldown>0) p.attackCooldown--;

    // Camera follows player (smooth)
    this.camera.x=lerp(this.camera.x,p.x,0.1);
    this.camera.y=lerp(this.camera.y,p.y,0.1);

    // Player points toward mouse even when idle
    const sx=p.x-this.camera.x+canvas.width/2;
    const sy=p.y-this.camera.y+canvas.height/2;
    if(!dx&&!dy) p.angle=Math.atan2(mouseY-sy,mouseX-sx);

    // Update chickens
    for(const c of this.chickens){
      if(!c.dead) c.update(p,this.enemies,this.projectiles);
    }

    // Update eggs — auto-collect if player steps on them
    for(const egg of this.eggs){
      if(egg.dead) continue;
      if(dist(p,egg)<20){
        egg.dead=true;
        const gender=Math.random()<0.5?'hen':'rooster';
        const nc=new Chicken(egg.x,egg.y,gender);
        this.chickens.push(nc);
        this.msg(`Egg hatched into a ${gender}!`,'#ffe080');
        this.updateHUD();
      }
    }

    // Rune auto-pickup (walk over)
    for(const rp of this.runePickups){
      if(rp.dead) continue;
      if(dist(p,rp)<20){
        rp.dead=true;
        this.runes[rp.type]++;
        this.msg(`Picked up ${rp.type} rune!`,'#ffd700');
        this.updateHUD();
      }
    }

    // Update enemies
    const activeEnemies=this.isBossFight?[]:(this.enemies.filter(e=>!e.dead));
    for(const e of activeEnemies) e.update(p,this.projectiles);
    if(this.boss&&!this.boss.dead) this.boss.update(p,this.projectiles);

    // Update projectiles
    for(const proj of this.projectiles){
      proj.update();
      if(proj.dead) continue;
      if(proj.owner==='enemy'||proj.owner==='chicken'){
        if(proj.owner==='enemy'&&dist(proj,p)<p.size+proj.size){
          proj.dead=true;
          p.takeDamage(proj.dmg);
        }
      }
      if(proj.owner==='player'||proj.owner==='chicken'){
        // Hit enemies
        for(const e of activeEnemies){
          if(e.dead) continue;
          if(dist(proj,e)<e.size+proj.size){
            proj.dead=true;
            const killed=e.takeDamage(proj.dmg);
            if(killed) this.onEnemyKilled(e);
            break;
          }
        }
        if(this.boss&&!this.boss.dead&&dist(proj,this.boss)<this.boss.size+proj.size){
          proj.dead=true;
          this.boss.takeDamage(proj.dmg);
          if(this.boss.hp<=0) this.triggerVictory();
        }
      }
    }
    // Prune dead
    this.projectiles=this.projectiles.filter(pr=>!pr.dead);
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.eggs=this.eggs.filter(e=>!e.dead);
    this.runePickups=this.runePickups.filter(r=>!r.dead);
    this.chickens=this.chickens.filter(c=>!c.dead);

    // Game over?
    if(p.dead){
      this.running=false;
      document.getElementById('go-text').textContent=`You survived ${this.day} days... Farmer Jim wins.`;
      document.getElementById('gameover-screen').classList.remove('hidden');
    }

    this.detectArea();
    if(Math.random()<0.02) this.updateHUD();
  },

  render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    const cx=this.camera.x, cy=this.camera.y;
    const toScreen=(wx,wy)=>[wx-cx+canvas.width/2, wy-cy+canvas.height/2];

    // Sky/ground color based on day/area
    let skyColor='#1a3a1a';
    if(this.isBossFight) skyColor='#3a0a00';
    else if(this.currentArea==='beach') skyColor='#1a3a4a';
    else if(this.currentArea==='volcano') skyColor='#3a1a0a';
    else if(this.currentArea==='mountain') skyColor='#2a2a3a';
    else if(this.currentArea==='gym') skyColor='#2a1a3a';
    ctx.fillStyle=skyColor;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Ground grid (farm)
    this.drawGround(cx,cy);

    // Farm objects
    for(const obj of this.farmObjects){
      const [sx,sy]=toScreen(obj.x,obj.y);
      if(sx<-100||sx>canvas.width+100||sy<-100||sy>canvas.height+100) continue;
      this.drawFarmObject(ctx,obj.type,sx,sy);
    }

    // Rune pickups
    for(const rp of this.runePickups){
      const [sx,sy]=toScreen(rp.x,rp.y);
      if(Math.abs(sx-canvas.width/2)<canvas.width/2+50 && Math.abs(sy-canvas.height/2)<canvas.height/2+50){
        rp.draw(sx,sy);
      }
    }

    // Eggs
    for(const egg of this.eggs){
      const [sx,sy]=toScreen(egg.x,egg.y);
      egg.draw(sx,sy);
    }

    // Chickens
    for(const c of this.chickens){
      const [sx,sy]=toScreen(c.x,c.y);
      if(Math.abs(sx-canvas.width/2)<canvas.width/2+100 && Math.abs(sy-canvas.height/2)<canvas.height/2+100){
        c.draw(sx,sy);
      }
    }

    // Enemies
    for(const e of this.enemies){
      const [sx,sy]=toScreen(e.x,e.y);
      if(Math.abs(sx-canvas.width/2)<canvas.width/2+100 && Math.abs(sy-canvas.height/2)<canvas.height/2+100){
        e.draw(sx,sy);
      }
    }

    // Boss
    if(this.boss&&!this.boss.dead){
      const [sx,sy]=toScreen(this.boss.x,this.boss.y);
      this.boss.draw(sx,sy);
    }

    // Projectiles
    for(const proj of this.projectiles){
      const [sx,sy]=toScreen(proj.x,proj.y);
      proj.draw(sx,sy);
    }

    // Player
    const [psx,psy]=toScreen(this.player.x,this.player.y);
    this.player.draw(psx,psy);

    // Attack range indicator (faint)
    if(mouseDown){
      ctx.beginPath();
      ctx.arc(psx,psy,this.player.atkRange,0,TWO_PI);
      ctx.strokeStyle='rgba(136,204,255,0.15)';
      ctx.lineWidth=1;
      ctx.stroke();
    }

    // Area markers (when near edge of visible farm)
    this.drawAreaMarkers(toScreen);

    // Boss intro sky
    if(this.isBossFight&&this.boss){
      // Red vignette
      const grad=ctx.createRadialGradient(canvas.width/2,canvas.height/2,100,canvas.width/2,canvas.height/2,canvas.width*0.7);
      grad.addColorStop(0,'transparent');
      grad.addColorStop(1,'rgba(100,0,0,0.35)');
      ctx.fillStyle=grad;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    // Minimap update
    if(!document.getElementById('minimap-panel').classList.contains('hidden')){
      this.drawMinimap();
    }
  },

  drawGround(cx,cy){
    const tileSize=80;
    const startX=Math.floor((cx-canvas.width/2)/tileSize)*tileSize;
    const startY=Math.floor((cy-canvas.height/2)/tileSize)*tileSize;

    for(let wx=startX;wx<cx+canvas.width/2+tileSize;wx+=tileSize){
      for(let wy=startY;wy<cy+canvas.height/2+tileSize;wy+=tileSize){
        const sx=wx-cx+canvas.width/2;
        const sy=wy-cy+canvas.height/2;

        // Color based on proximity to areas
        let col='#2a4a1a';
        for(const [key,area] of Object.entries(AREAS)){
          if(key==='farm') continue;
          const d=Math.sqrt((wx-area.x)**2+(wy-area.y)**2);
          if(d<AREA_RADIUS){
            const t=1-d/AREA_RADIUS;
            if(key==='beach') col=`rgba(180,160,80,${t*0.8})`;
            else if(key==='volcano') col=`rgba(120,40,10,${t*0.8})`;
            else if(key==='mountain') col=`rgba(80,80,80,${t*0.8})`;
            else if(key==='gym') col=`rgba(80,50,20,${t*0.8})`;
          }
        }

        ctx.fillStyle='#2a4a1a';
        ctx.fillRect(sx,sy,tileSize+1,tileSize+1);
        if(col!=='#2a4a1a'){
          ctx.fillStyle=col;
          ctx.fillRect(sx,sy,tileSize+1,tileSize+1);
        }

        // Grass tufts
        if((Math.abs(wx)+Math.abs(wy))%160===0){
          ctx.fillStyle='#1a3a10';
          ctx.fillRect(sx+10,sy+10,3,8);
          ctx.fillRect(sx+14,sy+8,3,10);
          ctx.fillRect(sx+18,sy+12,3,6);
        }
      }
    }
  },

  drawFarmObject(ctx,type,sx,sy){
    switch(type){
      case 'barn':
        // Barn structure
        ctx.fillStyle='#8B2500';
        ctx.fillRect(sx-40,sy-30,80,50);
        ctx.fillStyle='#cc3300';
        ctx.beginPath();
        ctx.moveTo(sx-50,sy-30);
        ctx.lineTo(sx,sy-70);
        ctx.lineTo(sx+50,sy-30);
        ctx.fill();
        ctx.fillStyle='#4a1a00';
        ctx.fillRect(sx-15,sy,30,20);
        ctx.fillStyle='#ffcc00';
        ctx.font='14px serif';
        ctx.textAlign='center';
        ctx.fillText('🐔',sx,sy-40);
        break;
      case 'fence':
        ctx.fillStyle='#8B6914';
        ctx.fillRect(sx-4,sy-15,8,25);
        ctx.fillRect(sx-12,sy-8,24,5);
        break;
      case 'tree':
        ctx.beginPath();
        ctx.arc(sx,sy,18,0,TWO_PI);
        ctx.fillStyle='#1a5a10';
        ctx.fill();
        ctx.fillStyle='#2a7a20';
        ctx.beginPath();
        ctx.arc(sx-5,sy-8,12,0,TWO_PI);
        ctx.fill();
        ctx.fillStyle='#5a3010';
        ctx.fillRect(sx-4,sy+10,8,14);
        break;
      case 'hay':
        ctx.fillStyle='#c8a020';
        ctx.beginPath();
        ctx.ellipse(sx,sy,20,14,0,0,TWO_PI);
        ctx.fill();
        ctx.strokeStyle='#8B6914';
        ctx.lineWidth=2;
        ctx.stroke();
        break;
      case 'gym_sign':
      case 'beach_sign':
      case 'mtn_sign':
      case 'volcano_sign': {
        const label={gym_sign:'🏋️ GYM',beach_sign:'🏖️ BEACH',mtn_sign:'⛰️ MOUNTAIN',volcano_sign:'🌋 VOLCANO'}[type];
        const areaKey={gym_sign:'gym',beach_sign:'beach',mtn_sign:'mountain',volcano_sign:'volcano'}[type];
        const locked=!this.unlockedAreas[areaKey];
        ctx.fillStyle=locked?'rgba(80,40,40,0.9)':'rgba(40,80,40,0.9)';
        ctx.fillRect(sx-50,sy-24,100,28);
        ctx.strokeStyle=locked?'#880000':'#00aa00';
        ctx.lineWidth=2;
        ctx.strokeRect(sx-50,sy-24,100,28);
        ctx.fillStyle='#fff';
        ctx.font='bold 13px sans-serif';
        ctx.textAlign='center';
        ctx.fillText((locked?'🔒 ':'')+label,sx,sy-4);
        // Post
        ctx.fillStyle='#5a3010';
        ctx.fillRect(sx-3,sy+4,6,30);
        break;
      }
    }
  },

  drawAreaMarkers(toScreen){
    for(const [key,area] of Object.entries(AREAS)){
      if(key==='farm'||!this.unlockedAreas[key]) continue;
      const [sx,sy]=toScreen(area.x,area.y);
      // Only draw if off-screen (show arrow)
      if(sx>=0&&sx<=canvas.width&&sy>=0&&sy<=canvas.height) continue;
      const angle=Math.atan2(area.y-this.player.y,area.x-this.player.x);
      const arrowX=canvas.width/2+Math.cos(angle)*Math.min(canvas.width/2-40,Math.abs(area.x-this.player.x));
      const arrowY=canvas.height/2+Math.sin(angle)*Math.min(canvas.height/2-40,Math.abs(area.y-this.player.y));
      const clampedX=Math.max(30,Math.min(canvas.width-30,canvas.width/2+Math.cos(angle)*300));
      const clampedY=Math.max(30,Math.min(canvas.height-30,canvas.height/2+Math.sin(angle)*220));
      ctx.save();
      ctx.translate(clampedX,clampedY);
      ctx.rotate(angle);
      ctx.fillStyle='rgba(0,255,100,0.8)';
      ctx.beginPath();
      ctx.moveTo(12,0); ctx.lineTo(-8,-7); ctx.lineTo(-8,7);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle='rgba(0,255,100,0.8)';
      ctx.font='10px sans-serif';
      ctx.textAlign='center';
      ctx.fillText(area.label,clampedX,clampedY+18);
    }
  },
};

// Expose to HTML onclick
window.Game = G;

// Auto-start loop (but don't start the game, wait for button)
// Just ensure canvas is sized correctly
canvas.width=window.innerWidth;
canvas.height=window.innerHeight;
