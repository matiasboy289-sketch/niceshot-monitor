
import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const canvas=document.querySelector('#ns-liquid-world'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
try{
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.1,100);camera.position.z=16;
const env=new T.Scene();env.background=new T.Color(0x191b20);
for(const [x,y,z,w,h,c] of [[-5,4,4,4,10,0xffffff],[5,1,2,2,9,0xc6d9ff],[0,6,-3,9,2,0xffffff],[0,-5,2,8,2,0x999999],[-3,0,-6,3,8,0xffffff]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:c,side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);env.add(m)}
const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(env).texture;
const sculpture=new T.Group();scene.add(sculpture);
const mat=new T.MeshPhysicalMaterial({color:0xc8cbd0,metalness:1,roughness:.19,clearcoat:1,clearcoatRoughness:.12});
const U=innerWidth<700?80:144,V=innerWidth<700?20:32,positions=new Float32Array((U+1)*(V+1)*3),indices=[];
for(let i=0;i<U;i++)for(let j=0;j<V;j++){const a=i*(V+1)+j,b=a+V+1;indices.push(a,b,a+1,b,b+1,a+1)}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geo.setIndex(indices);const mesh=new T.Mesh(geo,mat);mesh.frustumCulled=false;sculpture.add(mesh);
function surface(t){for(let i=0;i<=U;i++){const u=i/U*Math.PI*2;const R=1.8+.48*Math.cos(3*u+t*.5);const x=R*Math.cos(2*u),y=R*Math.sin(2*u),z=.8*Math.sin(3*u+t*.5);const a=new T.Vector3(Math.cos(2*u),Math.sin(2*u),0);for(let j=0;j<=V;j++){const v=j/V*Math.PI*2,tw=v+u*3+t*.35;const radius=.53+.16*Math.sin(3*u+t*.8)+.09*Math.cos(5*u-t);const radial=radius*Math.cos(v)*(1+.22*Math.cos(tw*2));const k=(i*(V+1)+j)*3;positions[k]=x+a.x*radial;positions[k+1]=y+a.y*radial;positions[k+2]=z+radius*Math.sin(v)*(1+.22*Math.sin(tw*2));}}geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();const n=geo.attributes.normal;for(let i=0;i<=U;i++){const a=i*(V+1),b=a+V;const v=new T.Vector3().fromBufferAttribute(n,a).add(new T.Vector3().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z)}for(let j=0;j<=V;j++){const a=j,b=U*(V+1)+j;const v=new T.Vector3().fromBufferAttribute(n,a).add(new T.Vector3().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z)}n.needsUpdate=true;}
let mx=0,my=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}resize();addEventListener('resize',resize);
const clock=new T.Clock();function frame(){if(document.hidden){if(!reduced)requestAnimationFrame(frame);return;}const t=reduced?0:clock.getElapsedTime(),mobile=innerWidth<700;sculpture.position.x=mobile?0:camera.aspect*1.65;sculpture.position.y=mobile?.8:.05;sculpture.scale.setScalar(mobile?.8:1.15);sculpture.rotation.set(.35+Math.sin(t*.28)*.24,t*.21,.35+Math.sin(t*.19)*.2);surface(t);camera.position.x+=(mx*.65-camera.position.x)*.045;camera.position.y+=(-my*.45-camera.position.y)*.045;camera.lookAt(0,0,0);renderer.render(scene,camera);if(!reduced)requestAnimationFrame(frame)}frame();if(reduced)addEventListener('resize',frame);
}catch(e){canvas.style.display='none';console.warn('3D unavailable',e)}
