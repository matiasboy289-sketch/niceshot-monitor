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
function shape(points){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s}
function letter(points,x){const geo=new T.ExtrudeGeometry(shape(points),{depth:.36,bevelEnabled:true,bevelThickness:.09,bevelSize:.075,bevelSegments:4,steps:1});const m=new T.Mesh(geo,[chrome,dark]);m.position.set(x,-1.05,-.18);group.add(m)}
letter([[0,0],[0,2.1],[.43,2.1],[1.3,.78],[1.3,2.1],[1.72,2.1],[1.72,0],[1.29,0],[.42,1.32],[.42,0]],-1.9);
letter([[0,2.1],[1.65,2.1],[1.65,1.68],[.45,1.68],[.45,1.28],[1.65,1.28],[1.65,0],[0,0],[0,.42],[1.2,.42],[1.2,.86],[0,.86]],.16);
const orbit=new T.Group();group.add(orbit);for(let i=0;i<2;i++){const m=new T.Mesh(new T.TorusGeometry(2.65+i*.18,.018,8,120,Math.PI*1.65),chrome);m.rotation.set(.65+i*.7,.5+i*.5,i*2);orbit.add(m)}
const shards=[];for(let i=0;i<22;i++){const m=new T.Mesh(new T.IcosahedronGeometry(.055+(i%4)*.035,0),i%3?chrome:dark);group.add(m);shards.push(m)}
let mx=0,my=0,visible=true,raf=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});
function draw(t){const mobile=innerWidth<700;group.position.set(mobile?0:camera.aspect*1.45,Math.sin(t*.8)*.13,0);group.scale.setScalar(mobile?.67:Math.min(1.15,camera.aspect*.68));group.rotation.set(.13+my*.25,Math.sin(t*.65)*.42+mx*.65,-.12+Math.sin(t*.45)*.08);orbit.rotation.z=t*.13;shards.forEach((m,i)=>{const a=i*2.399+t*(.1+(i%3)*.03),r=2.45+(i%5)*.16;m.position.set(Math.cos(a)*r,Math.sin(a)*r,Math.sin(a*2+i)*.75);m.rotation.set(t*.4+i,t*.3+i,0)});renderer.render(scene,camera)}
function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(reduced)draw(0)}
function loop(ms){raf=0;if(!visible||document.hidden)return;draw(ms/1000);if(!reduced)raf=requestAnimationFrame(loop)}
function wake(){if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(loop)}
new IntersectionObserver(([e])=>{visible=e.isIntersecting;wake()}).observe(canvas);document.addEventListener('visibilitychange',wake);addEventListener('resize',resize);resize();wake();
}catch(e){console.warn('NICE SV 3D fallback',e);canvas.style.display='none'}
