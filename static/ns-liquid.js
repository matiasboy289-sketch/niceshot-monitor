import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const canvas=document.querySelector('#ns-liquid-world');
if(canvas)try{
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.1,100);camera.position.z=12;
const env=new T.Scene();env.background=new T.Color(0x111215);
for(const [x,y,z,w,h,c] of [[-5,3,4,3,8,0xffffff],[5,2,2,2,8,0xcbdcff],[0,5,-3,8,2,0xffffff],[0,-4,3,6,2,0x888888],[-4,0,-4,1,7,0xffffff]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:c,side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);env.add(m)}
const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(env).texture;
const group=new T.Group();scene.add(group);
const chrome=new T.MeshPhysicalMaterial({color:0xcbd0d7,metalness:1,roughness:.17,clearcoat:1});
const dark=new T.MeshStandardMaterial({color:0x292c32,metalness:.95,roughness:.26});
const red=new T.MeshPhysicalMaterial({color:0xc32629,roughness:.76,clearcoat:.15}),black=new T.MeshStandardMaterial({color:0x181818,roughness:.85}),white=new T.MeshStandardMaterial({color:0xe9e5d8,roughness:.7});
function box(w,h,d,x,y,z,mat){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);group.add(m);return m}
const sh=new T.Shape(),w=1.48,h=1.12,r=.24;sh.moveTo(-w+r,-h);sh.lineTo(w-r,-h);sh.quadraticCurveTo(w,-h,w,-h+r);sh.lineTo(w,h-r);sh.quadraticCurveTo(w,h,w-r,h);sh.lineTo(-w+r,h);sh.quadraticCurveTo(-w,h,-w,h-r);sh.lineTo(-w,-h+r);sh.quadraticCurveTo(-w,-h,-w+r,-h);
const bag=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.65,bevelEnabled:true,bevelSize:.15,bevelThickness:.15,bevelSegments:5}),red);bag.position.z=-.32;group.add(bag);
const fabric=new T.MeshStandardMaterial({color:0xb52c30,roughness:.92});for(const x of [-1.1,1.1])box(.12,2.18,.91,x,0,0,fabric);
box(.82,.24,.2,0,1.48,0,fabric);for(const x of [-.32,.32])box(.2,.4,.2,x,1.3,0,fabric);
box(.95,.28,.055,0,.18,.51,white);box(.28,.95,.055,0,.18,.51,white);
const label=document.createElement('canvas');label.width=512;label.height=128;const ctx=label.getContext('2d');ctx.fillStyle='#d9d6cb';ctx.fillRect(0,0,512,128);ctx.fillStyle='#292929';ctx.font='bold 54px Arial';ctx.textAlign='center';ctx.fillText('FIRST AID',256,58);ctx.font='bold 24px Arial';ctx.fillText('EMERGENCY MEDICAL KIT',256,99);const tex=new T.CanvasTexture(label);tex.colorSpace=T.SRGBColorSpace;const patch=new T.Mesh(new T.PlaneGeometry(1.5,.375),new T.MeshStandardMaterial({map:tex,roughness:.8}));patch.position.set(0,-.66,.51);group.add(patch);
const seam=new T.MeshStandardMaterial({color:0xd9b6a1,roughness:.9});for(let i=0;i<30;i++)box(.035,.025,.025,-1.25+i*.085,1.04,.48,seam);
const orbit=new T.Group();group.add(orbit);const halo=new T.MeshBasicMaterial({color:0xf3e8dc,transparent:true,opacity:.35});for(let i=0;i<2;i++){const m=new T.Mesh(new T.TorusGeometry(2.65+i*.18,.018,8,120,Math.PI*1.65),halo);m.rotation.set(.65+i*.7,.5+i*.5,i*2);orbit.add(m)}
const shards=[];for(let i=0;i<22;i++){const m=new T.Mesh(new T.IcosahedronGeometry(.055+(i%4)*.035,0),chrome);group.add(m);shards.push(m)}
let mx=0,my=0,visible=true,raf=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});
function draw(t){const mobile=innerWidth<700;group.position.set(mobile?0:camera.aspect*1.45,Math.sin(t*.8)*.13,0);group.scale.setScalar(mobile?.67:Math.min(1.15,camera.aspect*.68));group.rotation.set(.13+my*.25,Math.sin(t*.65)*.42+mx*.65,-.12+Math.sin(t*.45)*.08);orbit.rotation.z=t*.13;shards.forEach((m,i)=>{const a=i*2.399+t*(.1+(i%3)*.03),r=2.45+(i%5)*.16;m.position.set(Math.cos(a)*r,Math.sin(a)*r,Math.sin(a*2+i)*.75);m.rotation.set(t*.4+i,t*.3+i,0)});renderer.render(scene,camera)}
function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(reduced)draw(0)}
function loop(ms){raf=0;if(!visible||document.hidden)return;draw(ms/1000);if(!reduced)raf=requestAnimationFrame(loop)}
function wake(){if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(loop)}
new IntersectionObserver(([e])=>{visible=e.isIntersecting;wake()}).observe(canvas);document.addEventListener('visibilitychange',wake);addEventListener('resize',resize);resize();wake();
}catch(e){console.warn('NICE SV 3D fallback',e);canvas.style.display='none'}
