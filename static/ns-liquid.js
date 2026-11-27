import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const canvas=document.querySelector('#ns-liquid-world');
if(canvas)try{
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.1,100);camera.position.z=12;
const env=new T.Scene();env.background=new T.Color(0x232827);
for(const [x,y,z,w,h,c] of [[-5,3,4,3,8,0xffffff],[5,2,2,2,8,0xcaffae],[0,5,-3,8,2,0xffffff],[0,-4,3,6,2,0x889988]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:c,side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);env.add(m)}
const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(env).texture;
scene.add(new T.HemisphereLight(0xffffff,0x193300,2));
const light=new T.PointLight(0xaaff33,35,12);light.position.set(2,1,3);scene.add(light);
const bottle=new T.Group();scene.add(bottle);
const metal=new T.MeshStandardMaterial({color:0x414944,metalness:.9,roughness:.25});
const glass=new T.MeshPhysicalMaterial({color:0xb5d4b2,metalness:.05,roughness:.08,transparent:true,opacity:.23,side:T.DoubleSide,clearcoat:1,depthWrite:false});
const bile=new T.MeshPhysicalMaterial({color:0x8cb914,emissive:0x477700,emissiveIntensity:.65,roughness:.22,metalness:.08,clearcoat:1});
function lathe(points,mat){const m=new T.Mesh(new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),64),mat);bottle.add(m);return m}
lathe([[0,-1.6],[.68,-1.6],[.82,-1.47],[.85,-1.2],[.85,1.03],[.77,1.24],[.42,1.43],[.37,1.65],[.37,1.78]],glass).renderOrder=4;
lathe([[0,-1.48],[.68,-1.48],[.74,-1.32],[.75,.76],[0,.76]],bile);
function cyl(rt,rb,h,y,mat=metal){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,64),mat);m.position.y=y;bottle.add(m);return m}
cyl(.48,.48,.38,1.76);cyl(.51,.51,.08,1.96);cyl(.82,.82,.12,-1.48);
for(let i=0;i<24;i++){const a=i*Math.PI/12;const m=new T.Mesh(new T.BoxGeometry(.055,.28,.07),metal);m.position.set(Math.cos(a)*.48,1.77,Math.sin(a)*.48);m.rotation.y=-a;bottle.add(m)}
const ring=new T.Mesh(new T.TorusGeometry(.22,.045,12,40),metal);ring.position.set(.42,1.99,0);bottle.add(ring);
const label=document.createElement('canvas');label.width=1024;label.height=512;const ctx=label.getContext('2d');ctx.fillStyle='#d9d6a9';ctx.fillRect(0,0,1024,512);ctx.fillStyle='#20271a';ctx.fillRect(0,0,1024,65);ctx.fillRect(0,450,1024,62);ctx.textAlign='center';ctx.font='bold 54px Arial';ctx.fillText('CEDA / BIOHAZARD',512,140);ctx.font='bold 135px Arial';ctx.fillText('BOOMER',512,290);ctx.font='bold 100px Arial';ctx.fillText('BILE',512,395);const tex=new T.CanvasTexture(label);tex.colorSpace=T.SRGBColorSpace;const band=new T.Mesh(new T.CylinderGeometry(.858,.858,.9,64,1,true),new T.MeshStandardMaterial({map:tex,roughness:.8,side:T.DoubleSide}));band.position.y=-.36;bottle.add(band);
const bubbles=[];const bubbleMat=new T.MeshPhysicalMaterial({color:0xd8ff70,transparent:true,opacity:.6,roughness:.1,depthWrite:false});for(let i=0;i<35;i++){const a=i*2.399,r=.65*Math.sqrt((i%17)/17);const m=new T.Mesh(new T.SphereGeometry(.025+(i%5)*.012,12,8),bubbleMat);m.position.set(Math.cos(a)*r,0,Math.sin(a)*r);bottle.add(m);bubbles.push(m)}
const surface=new T.Mesh(new T.CircleGeometry(.748,64),bile);surface.rotation.x=-Math.PI/2;surface.position.y=.77;bottle.add(surface);
let mx=0,my=0,visible=true,raf=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});
function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(reduced)draw(0)}
function draw(t){const mobile=innerWidth<700;bottle.position.set(mobile?0:camera.aspect*1.55,Math.sin(t*.9)*.16,0);bottle.scale.setScalar(mobile?.83:1.12);bottle.rotation.set(.13+my*.35,t*.35+mx*.7,-.25+Math.sin(t*.5)*.1);bubbles.forEach((m,i)=>{m.position.y=-1.3+((t*(.22+i%4*.045)+i*.17)%2.02)});surface.rotation.x=-Math.PI/2+Math.sin(t*1.2)*.015;renderer.render(scene,camera)}
function loop(ms){raf=0;if(!visible||document.hidden)return;draw(ms/1000);if(!reduced)raf=requestAnimationFrame(loop)}
function wake(){if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(loop)}
new IntersectionObserver(([e])=>{visible=e.isIntersecting;wake()}).observe(canvas);document.addEventListener('visibilitychange',wake);addEventListener('resize',resize);resize();wake();
}catch(e){console.warn('NICE SV 3D fallback',e);canvas.style.display='none'}
