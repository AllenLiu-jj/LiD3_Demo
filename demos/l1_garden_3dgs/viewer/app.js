import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const cameraData = await fetch('./cameras.json').then(r => r.json());
const scene = new THREE.Scene();
scene.background = new THREE.Color('#172018');
const camera = new THREE.PerspectiveCamera(cameraData.views[0].fov, innerWidth / innerHeight, .02, 2000);
camera.up.fromArray(cameraData.up);
const renderer = new THREE.WebGLRenderer({antialias:false, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
$('viewport').appendChild(renderer.domElement);
const spark = new SparkRenderer({renderer, maxStdDev:Math.sqrt(8), sortRadial:false});
scene.add(spark);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.fromArray(cameraData.target);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.minDistance = cameraData.radius * .45;
controls.maxDistance = cameraData.radius * 1.25;
controls.autoRotateSpeed = .55;
controls.minPolarAngle = Math.PI * .22;
controls.maxPolarAngle = Math.PI * .46;
let mesh, loadedCheckpoint, latestStatus, busy = false, highQuality = true;
function reset(){
  camera.position.fromArray(cameraData.views[Number(query.get('view') || 0)].position);
  controls.target.fromArray(cameraData.target);
  camera.up.fromArray(cameraData.up);
  camera.lookAt(controls.target);
  controls.update();
}
reset();

function showError(error){
  console.error(error);
  window.demoError = String(error);
  $('error').textContent = '三维场景加载遇到问题：' + error.message + '。请刷新页面重试。';
  $('error').hidden = false;
  $('loading').hidden = true;
}
async function loadModel(checkpoint){
  if(busy || !checkpoint) return;
  busy = true;
  $('loading').hidden = false;
  $('loading-title').textContent = '正在加载三维场景';
  $('loading-detail').textContent = '读取 Gaussian 模型，首次打开请稍候。';
  $('refresh').disabled = true;
  try {
    const next = new SplatMesh({
      url:'../outputs/garden_gaussian/' + checkpoint,
      onProgress:ev=>{
        if(ev.lengthComputable){$('progress').value=ev.loaded/ev.total;$('loading-detail').textContent='模型读取 '+Math.round(ev.loaded/ev.total*100)+'%';}
      }
    });
    scene.add(next);
    await next.initialized;
    if(mesh){scene.remove(mesh);mesh.dispose();}
    mesh=next;loadedCheckpoint=checkpoint;
    window.demoReady=true;
    window.demoCheckpoint=checkpoint;
    window.demoSplats=next.numSplats;
    $('loading').hidden=true;
    $('refresh').hidden=true;
  } catch(error){showError(error);} finally{busy=false;$('refresh').disabled=false;}
}

async function updateStatus(){
  try{
    const r=await fetch('../outputs/garden_gaussian/status.json?t='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('等待训练状态');
    latestStatus=await r.json();
    const done=latestStatus.state==='complete';
    $('status').textContent=done?'3D Gaussian · 训练完成':'GPU 训练中 · '+latestStatus.step.toLocaleString()+' / '+latestStatus.target_steps.toLocaleString();
    if(latestStatus.state==='failed') $('status').textContent='训练已中断 · 当前可查看已保存模型';
    const requested=query.get('checkpoint');
    const file=requested || latestStatus.demo_checkpoint || latestStatus.checkpoint;
    if(!loadedCheckpoint && file) await loadModel(file);
    else if(file && file!==loadedCheckpoint && !requested) $('refresh').hidden=false;
    if(!file){$('loading-title').textContent='GPU 正在生成第一版模型';$('loading-detail').textContent='模型保存后会自动打开三维场景。';}
  }catch(e){console.warn(e);}
}
$('tour').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('tour').textContent=controls.autoRotate?'暂停环绕':'开始环绕';};
$('reset').onclick=reset;
$('photo').onclick=()=>{$('reference-image').src=cameraData.views[0].image;$('reference').hidden=!$('reference').hidden;};
$('close-reference').onclick=()=>{$('reference').hidden=true;};
$('refresh').onclick=()=>loadModel(latestStatus.demo_checkpoint || latestStatus.checkpoint);
$('quality').onclick=()=>{highQuality=!highQuality;renderer.setPixelRatio(highQuality?Math.min(devicePixelRatio,1.5):.75);renderer.setSize(innerWidth,innerHeight);$('quality').textContent='画质：'+(highQuality?'高清':'流畅');};
$('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showError(new Error('显卡渲染连接已中断'));});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.demo={camera,controls,scene,renderer,reset,cameraData,setView(i){camera.position.fromArray(cameraData.views[i].position);controls.update();},snapshot(){return renderer.domElement.toDataURL('image/png');}};
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
await updateStatus();
setInterval(updateStatus,15000);
