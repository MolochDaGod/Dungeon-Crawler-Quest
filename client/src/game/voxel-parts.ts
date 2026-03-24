/**
 * voxel-parts.ts  —  Part-based voxel rig system
 *
 * T-POSE reference (matches MagicaVoxel biped style):
 *   rotX=0 → arms extend HORIZONTAL (out to sides)
 *   rotX>0 → swing FORWARD (elbow toward front of character)
 *   rotX<0 → swing BACKWARD or UP (from T-pose)
 *
 * Left-side arm parts use mirror=true → rendered with ctx.scale(-1,1)
 * so the same model extends LEFT instead of right.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PartId =
  | 'torso' | 'head'
  | 'leftUpperArm'  | 'leftForearm'
  | 'rightUpperArm' | 'rightForearm'
  | 'leftThigh'     | 'leftShin'
  | 'rightThigh'    | 'rightShin'
  | 'weapon';

export const ALL_PARTS: PartId[] = [
  'torso','head',
  'leftUpperArm','leftForearm',
  'rightUpperArm','rightForearm',
  'leftThigh','leftShin',
  'rightThigh','rightShin',
  'weapon',
];

export interface PartTransform {
  rotX:  number;   // degrees. 0 = T-pose. +ve = forward swing from T.
  rotY:  number;
  scale: number;
}

export type HeroRigPose = Record<PartId, PartTransform>;

export interface MixamoBoneFrame {
  LeftArm?:number; LeftForeArm?:number;
  RightArm?:number; RightForeArm?:number;
  LeftUpLeg?:number; LeftLeg?:number;
  RightUpLeg?:number; RightLeg?:number;
  Spine?:number; Head?:number;
}

// ─── VM helpers ───────────────────────────────────────────────────────────────

type VM = (string|null)[][][];

function emptyVM(w:number,d:number,h:number):VM {
  return Array.from({length:h},()=>Array.from({length:d},()=>Array(w).fill(null) as (string|null)[]));
}
function sv(m:VM,z:number,y:number,x:number,c:string){
  if(z>=0&&z<m.length&&y>=0&&y<(m[0]?.length??0)&&x>=0&&x<(m[0]?.[0]?.length??0)) m[z][y][x]=c;
}
function fill(m:VM,z0:number,z1:number,y0:number,y1:number,x0:number,x1:number,c:string){
  for(let z=z0;z<=z1;z++) for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) sv(m,z,y,x,c);
}
function shade(hex:string,f:number):string{
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  const cl=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
  return '#'+[r,g,b].map(v=>cl(v*f).toString(16).padStart(2,'0')).join('');
}
function blend(a:string,b:string,t:number):string{
  const ra=parseInt(a.slice(1,3),16),ga=parseInt(a.slice(3,5),16),ba=parseInt(a.slice(5,7),16);
  const rb=parseInt(b.slice(1,3),16),gb=parseInt(b.slice(3,5),16),bb=parseInt(b.slice(5,7),16);
  const cl=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
  return '#'+[cl(ra+(rb-ra)*t),cl(ga+(gb-ga)*t),cl(ba+(bb-ba)*t)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

// ─── Colors ───────────────────────────────────────────────────────────────────

export interface RigColors {
  skin:string; armorPrimary:string; armorSecondary:string;
  hair:string; eye:string; weapon:string; boot:string;
}
const RSKIN:Record<string,string>={Human:'#c4956a',Barbarian:'#a57850',Dwarf:'#d4a574',Elf:'#e8d5b8',Orc:'#5a8a3a',Undead:'#7a8a7a'};
const RHAIR:Record<string,string>={Human:'#3a2a1a',Barbarian:'#5a3a1a',Dwarf:'#a0522d',Elf:'#e8d090',Orc:'#1a1a1a',Undead:'#444444'};
const REYE:Record<string,string>={Human:'#2244aa',Barbarian:'#993300',Dwarf:'#4a6a44',Elf:'#22d3ee',Orc:'#ffaa00',Undead:'#ff4444'};
const CARM:Record<string,{p:string;s:string;w:string}>={
  Warrior:{p:'#8b8b8b',s:'#c0c0c0',w:'#d4d4d4'},
  Worg:   {p:'#6b4423',s:'#8b6914',w:'#a0522d'},
  Mage:   {p:'#4a3080',s:'#6b46c1',w:'#9333ea'},
  Ranger: {p:'#2d5016',s:'#4a7c23',w:'#854d0e'},
};
export function getRigColors(race:string,heroClass:string):RigColors{
  const a=CARM[heroClass]||CARM.Warrior;
  return{skin:RSKIN[race]||'#c4956a',armorPrimary:a.p,armorSecondary:a.s,hair:RHAIR[race]||'#3a2a1a',eye:REYE[race]||'#2244aa',weapon:a.w,boot:shade(a.p,0.60)};
}

// ─── Part builders ────────────────────────────────────────────────────────────

function buildHead(c:RigColors,race:string):VM{
  const m=emptyVM(6,4,7); const sk=c.skin;
  fill(m,1,5,1,3,0,5,sk);
  fill(m,5,6,1,3,1,4,c.hair);
  sv(m,5,1,0,c.hair); sv(m,5,1,5,c.hair);
  sv(m,4,1,1,c.eye); sv(m,4,1,4,c.eye);
  sv(m,4,1,2,shade(c.eye,1.4)); sv(m,4,1,3,shade(c.eye,1.4));
  sv(m,3,1,2,shade(sk,0.84)); sv(m,3,1,3,shade(sk,0.84));
  sv(m,2,1,2,shade(sk,0.76)); sv(m,2,1,3,shade(sk,0.76));
  fill(m,0,1,1,3,1,4,shade(sk,0.9));
  if(race==='Elf'){sv(m,5,0,0,sk);sv(m,5,0,5,sk);sv(m,4,0,0,sk);sv(m,4,0,5,sk);}
  if(race==='Orc'){fill(m,0,1,1,3,0,5,shade(sk,0.88));sv(m,0,1,2,'#fffde8');sv(m,0,1,3,'#fffde8');}
  if(race==='Undead'){sv(m,4,1,1,'#ff4444');sv(m,4,1,4,'#ff4444');sv(m,3,1,2,'#222');sv(m,3,1,3,'#222');}
  if(race==='Dwarf'){fill(m,0,2,1,2,1,4,shade(c.hair,1.1));sv(m,0,2,0,c.hair);sv(m,0,2,5,c.hair);}
  return m;
}

function buildTorso(c:RigColors,heroClass:string):VM{
  const m=emptyVM(8,4,9); const p=c.armorPrimary,s=c.armorSecondary;
  fill(m,0,1,1,3,1,6,shade(p,0.8));   // hips
  fill(m,2,3,1,3,1,6,p);              // abdomen
  fill(m,2,2,1,3,1,6,shade(s,0.88));  // belt
  fill(m,4,5,1,3,1,6,shade(s,0.92));  // waist
  fill(m,6,8,1,3,0,7,p);              // chest
  fill(m,7,8,1,2,2,5,shade(s,1.1));   // chest plate
  fill(m,8,8,1,3,0,7,shade(s,1.18));  // shoulder ridge
  if(heroClass==='Warrior'){sv(m,8,1,0,'#666');sv(m,8,3,0,'#555');sv(m,8,1,7,'#666');sv(m,8,3,7,'#555');fill(m,7,8,1,2,3,4,shade(s,1.3));}
  if(heroClass==='Mage')   {fill(m,3,5,1,3,2,5,shade(s,1.2));fill(m,6,8,1,2,2,5,blend(p,'#9333ea',0.38));}
  if(heroClass==='Ranger') {fill(m,8,8,1,2,1,6,shade(p,0.78));sv(m,8,1,0,'#5a3a1a');sv(m,8,1,7,'#5a3a1a');}
  if(heroClass==='Worg')   {fill(m,7,8,1,3,0,7,blend(p,'#4a2a12',0.3));}
  return m;
}

// HORIZONTAL UPPER ARM — W=8(length) D=3 H=3
// x=0 = shoulder (pivot), x=7 = elbow
// Left arm: rendered with ctx.scale(-1,1)
function buildUpperArm(c:RigColors,heroClass:string):VM{
  const m=emptyVM(8,3,3); const s=c.armorSecondary;
  fill(m,0,2,0,2,0,0,shade(s,1.18));   // shoulder cap
  fill(m,0,2,0,2,1,6,s);               // arm body
  fill(m,0,2,0,2,7,7,blend(s,c.skin,0.42)); // elbow end
  if(heroClass==='Warrior'){fill(m,0,2,0,2,2,3,shade(s,0.78));}
  if(heroClass==='Mage')   {fill(m,0,2,0,2,4,5,blend(s,'#9333ea',0.42));}
  return m;
}

// HORIZONTAL FOREARM — W=7(length) D=2 H=2
// x=0 = elbow (pivot), x=6 = hand
function buildForearm(c:RigColors):VM{
  const m=emptyVM(7,2,2); const s=c.armorSecondary,sk=c.skin;
  fill(m,0,1,0,1,0,0,shade(s,0.88));
  fill(m,0,1,0,1,1,4,s);
  fill(m,0,1,0,1,5,5,blend(s,sk,0.45));
  fill(m,0,1,0,1,6,6,sk);
  return m;
}

// THIGH — W=3 D=3 H=7 — hangs DOWN, pivot at TOP (z=6)
function buildThigh(c:RigColors):VM{
  const m=emptyVM(3,3,7); const p=c.armorPrimary;
  fill(m,5,6,0,2,0,2,shade(p,0.88));
  fill(m,2,4,0,2,0,2,p);
  fill(m,0,1,0,2,0,1,shade(p,0.95));
  return m;
}

// SHIN+BOOT — W=3 D=3 H=8 — pivot at TOP (z=7)
function buildShin(c:RigColors):VM{
  const m=emptyVM(3,3,8); const p=c.armorPrimary,b=c.boot;
  fill(m,6,7,0,2,0,1,shade(p,0.85));   // knee cap
  fill(m,3,5,0,2,0,1,p);               // shin
  fill(m,2,2,0,2,0,2,shade(b,1.15));   // ankle
  fill(m,0,1,0,2,0,2,b);               // boot
  sv(m,1,0,2,shade(b,1.2)); sv(m,0,0,2,shade(b,1.1));
  return m;
}

// ─── All Weapon Types ─────────────────────────────────────────────────────────

export type WeaponType =
  'sword'|'shield_sword'|'axe'|'greatsword'|'war_hammer'|'spear'|'dagger'|'dual_daggers'|
  'staff'|'wand'|'tome'|
  'bow'|'crossbow'|'gun'|
  'claws';

function buildWeapon(c:RigColors,type:WeaponType):VM{
  const wc=c.weapon;
  switch(type){
    case 'sword':{
      const m=emptyVM(2,2,13);
      fill(m,0,1,0,1,0,1,shade(wc,0.65)); sv(m,2,0,0,'#888'); sv(m,2,1,0,'#888');
      for(let z=3;z<=11;z++) sv(m,z,0,0,wc); sv(m,12,0,0,shade(wc,1.35)); return m;}
    case 'shield_sword':{
      const m=emptyVM(6,2,12);
      fill(m,0,1,0,1,0,1,shade(wc,0.65));
      for(let z=2;z<=10;z++) sv(m,z,0,0,wc); sv(m,11,0,0,shade(wc,1.35));
      fill(m,3,9,0,1,3,5,shade(c.armorPrimary,0.9));
      fill(m,4,8,0,1,4,4,shade(c.armorSecondary,1.2)); return m;}
    case 'axe':{
      const m=emptyVM(4,2,12);
      for(let z=1;z<=8;z++) sv(m,z,0,1,'#6b4423');
      fill(m,6,10,0,1,0,3,wc); fill(m,7,9,0,1,2,3,shade(wc,1.2)); return m;}
    case 'greatsword':{
      const m=emptyVM(2,2,16);
      fill(m,0,2,0,1,0,1,shade(wc,0.6)); sv(m,3,0,0,'#888'); sv(m,3,1,1,'#888');
      for(let z=4;z<=14;z++) sv(m,z,0,0,wc); sv(m,15,0,0,shade(wc,1.4)); return m;}
    case 'war_hammer':{
      const m=emptyVM(4,4,12);
      for(let z=1;z<=7;z++) sv(m,z,1,1,'#6b4423');
      fill(m,7,10,0,3,0,3,wc); fill(m,8,9,0,3,0,3,shade(wc,0.8)); return m;}
    case 'spear':{
      const m=emptyVM(2,2,16);
      for(let z=1;z<=11;z++) sv(m,z,0,0,'#6b4423');
      for(let z=12;z<=14;z++) sv(m,z,0,0,wc); sv(m,15,0,0,shade(wc,1.4)); return m;}
    case 'dagger':{
      const m=emptyVM(2,2,8);
      fill(m,0,1,0,1,0,1,shade(wc,0.65)); sv(m,2,0,0,'#888');
      for(let z=3;z<=7;z++) sv(m,z,0,0,wc); return m;}
    case 'dual_daggers':{
      const m=emptyVM(4,2,8);
      for(let z=3;z<=7;z++){sv(m,z,0,0,wc);sv(m,z,0,3,wc);}
      sv(m,2,0,0,'#888'); sv(m,2,0,3,'#888');
      fill(m,0,1,0,1,0,1,shade(wc,0.65)); fill(m,0,1,0,1,2,3,shade(wc,0.65)); return m;}
    case 'staff':{
      const m=emptyVM(2,2,14);
      for(let z=1;z<=10;z++) sv(m,z,0,0,'#553322');
      fill(m,11,12,0,1,0,1,wc); sv(m,13,0,0,shade(wc,1.6)); return m;}
    case 'wand':{
      const m=emptyVM(2,2,10);
      for(let z=1;z<=7;z++) sv(m,z,0,0,'#6b4423');
      fill(m,8,9,0,1,0,1,wc); sv(m,9,0,0,shade(wc,1.9)); return m;}
    case 'tome':{
      const m=emptyVM(4,3,5);
      fill(m,0,4,0,2,0,3,shade(wc,0.8)); fill(m,1,3,0,1,1,2,shade(wc,1.2));
      sv(m,2,0,0,'#ffd700'); sv(m,2,0,1,'#ffd700'); return m;}
    case 'bow':{
      const m=emptyVM(2,2,13);
      for(let z=1;z<=11;z++) sv(m,z,0,0,'#6b4423');
      sv(m,0,0,0,'#555'); sv(m,12,0,0,'#555');
      sv(m,6,1,0,'#aaa'); sv(m,5,1,0,'#999'); sv(m,7,1,0,'#999'); return m;}
    case 'crossbow':{
      const m=emptyVM(5,3,8);
      for(let z=2;z<=6;z++) sv(m,z,1,2,'#6b4423');
      fill(m,4,4,0,2,0,4,shade(c.armorPrimary,0.88));
      fill(m,5,5,1,1,0,4,'#888'); return m;}
    case 'gun':{
      const m=emptyVM(4,2,8);
      fill(m,1,3,0,1,0,1,shade(wc,0.7));
      for(let z=4;z<=7;z++) sv(m,z,0,1,wc);
      sv(m,3,0,1,'#888'); fill(m,2,3,0,1,2,3,'#6b4423'); return m;}
    case 'claws':
    default:{
      const m=emptyVM(3,2,10);
      fill(m,2,8,0,0,0,0,wc); sv(m,9,0,0,shade(wc,0.7)); sv(m,8,1,0,wc);
      fill(m,2,8,0,0,2,2,shade(wc,0.85)); sv(m,9,0,2,shade(wc,0.6)); return m;}
  }
}

const CLASS_WEAPON:Record<string,WeaponType>={Warrior:'shield_sword',Mage:'staff',Ranger:'bow',Worg:'claws'};

// ─── Rig Part / Rig Definition ────────────────────────────────────────────────

export interface RigPart {
  id: PartId;
  model: VM;
  attachX: number;   // screen offset rightward from root (cubeSize=1 units, Y=upward)
  attachY: number;   // screen offset upward from root
  pivotZ: number;    // Z-level in model that is the joint pivot
  pivotVX: number;
  pivotVY: number;
  mirror?: boolean;  // if true, ctx.scale(-1,1) for left-side parts
}

export type HeroRig = Record<PartId, RigPart>;

/**
 * Build the full hero rig.
 *
 * Coordinate calibration (cubeSize=1, ctx.scale(2.2) externally):
 *   Y=0  → feet / ground
 *   Y=8  → knee
 *   Y=14 → hip/waist
 *   Y=21 → shoulder
 *   Y=24 → neck/head base
 */
export function buildHeroRig(race:string,heroClass:string,weaponOverride?:WeaponType):HeroRig{
  const c=getRigColors(race,heroClass);
  const wt:WeaponType=weaponOverride||(CLASS_WEAPON[heroClass]||'sword');
  const mk=(id:PartId,model:VM,ax:number,ay:number,pZ:number,pVX:number,pVY:number,mirror?:boolean):RigPart=>
    ({id,model,attachX:ax,attachY:ay,pivotZ:pZ,pivotVX:pVX,pivotVY:pVY,mirror});
  return {
    torso:        mk('torso',        buildTorso(c,heroClass),        0,  0,  0,4,2),
    head:         mk('head',         buildHead(c,race),               0, 24,  0,3,2),
    rightUpperArm:mk('rightUpperArm',buildUpperArm(c,heroClass),      5, 21,  1,0,1),
    rightForearm: mk('rightForearm', buildForearm(c),                13, 18,  1,0,1),
    leftUpperArm: mk('leftUpperArm', buildUpperArm(c,heroClass),     -5, 21,  1,0,1,true),
    leftForearm:  mk('leftForearm',  buildForearm(c),               -13, 18,  1,0,1,true),
    rightThigh:   mk('rightThigh',   buildThigh(c),                   2, 14,  6,1,1),
    rightShin:    mk('rightShin',    buildShin(c),                    2,  8,  7,0,1),
    leftThigh:    mk('leftThigh',    buildThigh(c),                  -2, 14,  6,1,1),
    leftShin:     mk('leftShin',     buildShin(c),                   -2,  8,  7,0,1),
    weapon:       mk('weapon',       buildWeapon(c,wt),              20, 15,  0,0,0),
  };
}

// ─── Poses ────────────────────────────────────────────────────────────────────

export function defaultRigPose():HeroRigPose{
  const d={rotX:0,rotY:0,scale:1};
  return Object.fromEntries(ALL_PARTS.map(id=>[id,{...d}])) as HeroRigPose;
}

export function idleRigPose():HeroRigPose{
  const p=defaultRigPose();
  p.leftUpperArm.rotX=-12; p.rightUpperArm.rotX=-12;
  p.leftForearm.rotX=8;    p.rightForearm.rotX=8;
  p.leftThigh.rotX=-4;     p.rightThigh.rotX=4;
  return p;
}

export function walkRigPose(t:number):HeroRigPose{
  const p=defaultRigPose();
  const sw=Math.sin(t*Math.PI*2)*28,as=-sw*0.55;
  p.leftThigh.rotX=sw;    p.rightThigh.rotX=-sw;
  p.leftShin.rotX=Math.max(0,sw)*0.45;    p.rightShin.rotX=Math.max(0,-sw)*0.45;
  p.leftUpperArm.rotX=-12+as;             p.rightUpperArm.rotX=-12-as;
  p.leftForearm.rotX=8+Math.max(0,as)*0.3; p.rightForearm.rotX=8+Math.max(0,-as)*0.3;
  p.torso.rotY=Math.sin(t*Math.PI*2)*3;
  return p;
}

export function attackRigPose(t:number):HeroRigPose{
  const p=defaultRigPose();
  const wind=Math.min(1,t*3.5),swing=t>=0.28?Math.sin((t-0.28)/0.72*Math.PI):0;
  p.rightUpperArm.rotX=-30*wind+70*swing;
  p.rightForearm.rotX=-15*wind+40*swing;
  p.leftUpperArm.rotX=-12+20*wind-10*swing;
  p.leftForearm.rotX=8;
  p.torso.rotX=-10*wind+12*swing;
  p.head.rotX=5*swing;
  p.rightThigh.rotX=10*wind; p.leftThigh.rotX=-10*wind;
  return p;
}

export function comboRigPose(t:number):HeroRigPose{
  const p=defaultRigPose();
  const spin=Math.sin(t*Math.PI*2.5)*50,slam=Math.max(0,Math.sin(t*Math.PI*1.5-0.5))*70;
  p.rightUpperArm.rotX=-20+slam+spin*0.45; p.rightForearm.rotX=10+slam*0.55;
  p.leftUpperArm.rotX=-12+spin*0.3; p.torso.rotX=-12+slam*0.3; p.torso.rotY=spin*0.4;
  p.leftThigh.rotX=spin*0.28; p.rightThigh.rotX=-spin*0.28;
  return p;
}

export function lungeRigPose(t:number):HeroRigPose{
  const p=defaultRigPose(),ext=Math.sin(Math.min(1,t*5)*Math.PI)*0.9+0.1;
  p.torso.rotX=-20*ext; p.head.rotX=-8*ext;
  p.rightUpperArm.rotX=-60*ext; p.rightForearm.rotX=-25*ext;
  p.leftUpperArm.rotX=25*ext;   p.leftForearm.rotX=15*ext;
  p.leftThigh.rotX=-35*ext; p.leftShin.rotX=18*ext;
  p.rightThigh.rotX=22*ext; p.rightShin.rotX=-8*ext;
  return p;
}

export function dodgeRigPose(t:number):HeroRigPose{
  const p=defaultRigPose(),lean=Math.sin(Math.min(1,t*6)*Math.PI)*38;
  p.torso.rotX=-lean*0.45; p.head.rotX=lean*0.28;
  p.leftUpperArm.rotX=-12+lean*0.7; p.rightUpperArm.rotX=-12+lean*0.7;
  p.leftForearm.rotX=18; p.rightForearm.rotX=18;
  p.leftThigh.rotX=-lean*0.38; p.rightThigh.rotX=lean*0.55;
  p.leftShin.rotX=Math.max(0,lean)*0.38; p.rightShin.rotX=Math.max(0,lean)*0.28;
  return p;
}

export function blockRigPose():HeroRigPose{
  const p=defaultRigPose();
  p.torso.rotX=-6; p.head.rotX=4;
  p.leftUpperArm.rotX=-50; p.leftForearm.rotX=-35;
  p.rightUpperArm.rotX=6; p.rightForearm.rotX=12;
  p.leftThigh.rotX=-8; p.rightThigh.rotX=8;
  p.leftShin.rotX=6; p.rightShin.rotX=4;
  return p;
}

export function castRigPose(t:number):HeroRigPose{
  const p=defaultRigPose(),ch=Math.min(1,t*2.8),pulse=Math.sin(t*8)*0.12+0.88;
  p.leftUpperArm.rotX=-12-58*ch; p.leftForearm.rotX=8-30*ch;
  p.rightUpperArm.rotX=-12-52*ch; p.rightForearm.rotX=8-26*ch;
  p.leftUpperArm.scale=0.92+pulse*0.1; p.rightUpperArm.scale=0.92+pulse*0.1;
  p.head.rotX=-12*ch; p.torso.rotX=-6*ch;
  return p;
}

export function deathRigPose(t:number):HeroRigPose{
  const p=defaultRigPose(),fall=Math.min(1,t*2.2),ease=1-Math.pow(1-fall,3);
  p.torso.rotX=ease*65; p.head.rotX=-ease*18;
  p.leftUpperArm.rotX=-12+ease*35; p.rightUpperArm.rotX=-12+ease*28;
  p.leftForearm.rotX=8+ease*18; p.rightForearm.rotX=8-ease*14;
  p.leftThigh.rotX=ease*18; p.rightThigh.rotX=ease*14;
  p.leftShin.rotX=-ease*10; p.rightShin.rotX=-ease*8;
  return p;
}

export function lerpRigPose(a:HeroRigPose,b:HeroRigPose,t:number):HeroRigPose{
  const lr=(x:number,y:number)=>x+(y-x)*t;
  return Object.fromEntries(ALL_PARTS.map(id=>[id,{rotX:lr(a[id].rotX,b[id].rotX),rotY:lr(a[id].rotY,b[id].rotY),scale:lr(a[id].scale,b[id].scale)}])) as HeroRigPose;
}

export function getRigPoseForState(animState:string,t:number):HeroRigPose{
  const cy=(period:number)=>(t%period)/period;
  switch(animState){
    case 'idle':{
      const p=idleRigPose(),br=Math.sin(t*1.4)*3.5;
      p.torso.rotX+=br*0.25; p.head.rotX-=br*0.18;
      p.leftUpperArm.rotX+=br*0.4; p.rightUpperArm.rotX+=br*0.4; return p;}
    case 'walk':           return walkRigPose(cy(0.72));
    case 'attack':         return attackRigPose(cy(0.58));
    case 'combo_finisher': return comboRigPose(cy(0.78));
    case 'ability':        return castRigPose(Math.min(t,1.5));
    case 'dodge':          return dodgeRigPose(cy(0.42));
    case 'block':          return blockRigPose();
    case 'death':          return deathRigPose(Math.min(t,1.2));
    case 'lunge_slash':    return lungeRigPose(cy(0.48));
    case 'dash_attack':    return lerpRigPose(lungeRigPose(0.6),attackRigPose(cy(0.42)),0.5);
    default:               return idleRigPose();
  }
}

export function mixamoToRigPose(frame:MixamoBoneFrame):HeroRigPose{
  const pose=defaultRigPose();
  if(frame.LeftArm!==undefined)      pose.leftUpperArm.rotX=frame.LeftArm;
  if(frame.LeftForeArm!==undefined)  pose.leftForearm.rotX=frame.LeftForeArm;
  if(frame.RightArm!==undefined)     pose.rightUpperArm.rotX=-frame.RightArm;
  if(frame.RightForeArm!==undefined) pose.rightForearm.rotX=-frame.RightForeArm;
  if(frame.LeftUpLeg!==undefined)    pose.leftThigh.rotX=frame.LeftUpLeg;
  if(frame.LeftLeg!==undefined)      pose.leftShin.rotX=frame.LeftLeg;
  if(frame.RightUpLeg!==undefined)   pose.rightThigh.rotX=-frame.RightUpLeg;
  if(frame.RightLeg!==undefined)     pose.rightShin.rotX=-frame.RightLeg;
  if(frame.Spine!==undefined)        pose.torso.rotX=frame.Spine;
  if(frame.Head!==undefined)         pose.head.rotX=frame.Head;
  return pose;
}

// ─── Render Helpers ───────────────────────────────────────────────────────────

export function getPartRenderOffset(part:RigPart,cubeSize:number):[number,number]{
  const cs=cubeSize;
  const px=(part.pivotVX-part.pivotVY)*cs;
  const py=(part.pivotVX+part.pivotVY)*cs*0.5-part.pivotZ*cs;
  return [-px,-py];
}

export function getRigPartRenderOrder(dir:number):PartId[]{
  if(dir===0||dir===1)
    return ['rightThigh','rightShin','rightUpperArm','rightForearm','torso','weapon','leftThigh','leftShin','head','leftUpperArm','leftForearm'];
  return ['leftThigh','leftShin','leftUpperArm','leftForearm','torso','weapon','rightThigh','rightShin','head','rightUpperArm','rightForearm'];
}
