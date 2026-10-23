import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const $ = id => document.getElementById(id);
const vertexShader = `
precision highp float;
precision highp int;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D parameters;
uniform int textureWidth;
uniform int texelsPerGaussian;
uniform int shDegree;
uniform vec3 cameraPos;
uniform vec2 viewport;
uniform float sceneTime;
in vec3 position;
in float splatIndex;
out vec2 gaussianPosition;
out float gaussExtend;
out vec4 gaussianColor;
vec4 param(int i, int slot) {
  int pixel = i * texelsPerGaussian + slot;
  return texelFetch(parameters, ivec2(pixel % textureWidth, pixel / textureWidth), 0);
}
// Real spherical harmonics, degree 3, identical basis to gsplat's renderer.
vec3 evalSH(vec3 d, int i) {
  vec3 c = 0.28209479177387814 * param(i, 8).rgb;
  if (shDegree >= 1) {
    c += (-0.4886025119029199 * d.y) * param(i, 9).rgb;
    c += ( 0.4886025119029199 * d.z) * param(i, 10).rgb;
    c += (-0.4886025119029199 * d.x) * param(i, 11).rgb;
  }
  if (shDegree >= 2) {
    c += ( 1.0925484305920792 * d.x * d.y) * param(i, 12).rgb;
    c += (-1.0925484305920792 * d.y * d.z) * param(i, 13).rgb;
    c += ( 0.31539156525252005 * (2.0 * d.z * d.z - d.x * d.x - d.y * d.y)) * param(i, 14).rgb;
    c += (-1.0925484305920792 * d.x * d.z) * param(i, 15).rgb;
    c += ( 0.5462742152960396 * (d.x * d.x - d.y * d.y)) * param(i, 16).rgb;
  }
  if (shDegree >= 3) {
    c += (-0.5900435899266435 * d.y * (3.0 * d.x * d.x - d.y * d.y)) * param(i, 17).rgb;
    c += ( 2.890611442640554 * d.x * d.y * d.z) * param(i, 18).rgb;
    c += (-0.4570457994644658 * d.y * (4.0 * d.z * d.z - d.x * d.x - d.y * d.y)) * param(i, 19).rgb;
    c += ( 0.3731763325901154 * d.z * (2.0 * d.z * d.z - 3.0 * d.x * d.x - 3.0 * d.y * d.y)) * param(i, 20).rgb;
    c += (-0.4570457994644658 * d.x * (4.0 * d.z * d.z - d.x * d.x - d.y * d.y)) * param(i, 21).rgb;
    c += ( 1.445305721320277 * d.z * (d.x * d.x - d.y * d.y)) * param(i, 22).rgb;
    c += (-0.5900435899266435 * d.x * (d.x * d.x - 3.0 * d.y * d.y)) * param(i, 23).rgb;
  }
  // gsplat only clamps the lower bound before compositing
  return clamp(c + 0.5, 0.0, 1.0);
}
void main() {
  int i = int(splatIndex + 0.5);
  vec4 base = param(i, 0);
  vec3 mean = base.xyz + param(i, 1).xyz * sceneTime
            + 0.5 * param(i, 2).xyz * sceneTime * sceneTime;
  vec3 scales = exp(clamp(param(i, 3).xyz + param(i, 4).xyz * sceneTime, vec3(-8.0), vec3(2.0)));
  vec4 q = param(i, 5) + param(i, 6) * sceneTime;
  q /= max(length(q), 1e-12);
  float w=q.x, x=q.y, y=q.z, z=q.w;
  mat3 rotation = mat3(
    1.0-2.0*(y*y+z*z), 2.0*(x*y+w*z), 2.0*(x*z-w*y),
    2.0*(x*y-w*z), 1.0-2.0*(x*x+z*z), 2.0*(y*z+w*x),
    2.0*(x*z+w*y), 2.0*(y*z-w*x), 1.0-2.0*(x*x+y*y)
  );
  vec4 cameraMean = modelViewMatrix * vec4(mean, 1.0);
  float depth = -cameraMean.z;
  gaussianColor = vec4(shDegree > 0 ? evalSH(normalize(mean - cameraPos), i) : param(i, 7).rgb, base.w);
  if (depth <= 0.01 || depth >= 1000.0 || base.w < 0.003921569) {
    gaussianColor.a = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  mat3 basis = mat3(modelViewMatrix) * rotation;
  basis[0] *= scales.x;
  basis[1] *= scales.y;
  basis[2] *= scales.z;
  mat3 covariance = basis * transpose(basis);
  float fx = projectionMatrix[0][0] * viewport.x * 0.5;
  float fy = projectionMatrix[1][1] * viewport.y * 0.5;
  // Perspective Jacobian, including the off-axis depth contribution.
  vec2 limit = 1.3 * viewport / (2.0 * vec2(fx, fy));
  vec2 slope = clamp(cameraMean.xy / depth, -limit, limit);
  vec3 jx = vec3(fx / depth, 0.0, fx * slope.x / depth);
  vec3 jy = vec3(0.0, fy / depth, fy * slope.y / depth);
  // gsplat dilates the 2D covariance by 0.3 px^2 and compensates the opacity
  // with sqrt(det_orig / det_blur) so the total energy is preserved.
  float a0 = dot(jx, covariance*jx);
  float b = dot(jx, covariance*jy);
  float c0 = dot(jy, covariance*jy);
  float a = a0 + 0.3;
  float c = c0 + 0.3;
  float detOrig = max(a0 * c0 - b * b, 0.0);
  float detBlur = max(a * c - b * b, 1e-12);
  float compensation = sqrt(clamp(detOrig / detBlur, 0.0, 1.0));
  float peak = gaussianColor.a * compensation;
  // far too transparent to matter, exactly like gsplat's ALPHA_THRESHOLD test
  if (peak < 0.0039215686) {
    gaussianColor.a = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  // opacity-aware extent (Mip-Splatting eq. in gsplat's projection kernel)
  float extend = min(3.33, sqrt(max(2.0 * log(peak / 0.0039215686), 0.0)));
  gaussianColor.a = peak;
  gaussianPosition = position.xy * extend;
  gaussExtend = extend;
  float mid = 0.5 * (a+c);
  float delta = sqrt(max(0.0, 0.25*(a-c)*(a-c) + b*b));
  float major = sqrt(max(0.01, mid+delta));
  float minor = sqrt(max(0.01, mid-delta));
  float angle = abs(b) < 1e-8 && abs(a-c) < 1e-8 ? 0.0 : 0.5 * atan(2.0*b, a-c);
  vec2 direction = vec2(cos(angle), sin(angle));
  vec2 offset = direction * major * gaussianPosition.x
              + vec2(-direction.y, direction.x) * minor * gaussianPosition.y;
  vec4 clip = projectionMatrix * cameraMean;
  clip.xy += 2.0 * offset / viewport * clip.w;
  gl_Position = clip;
}`;

const fragmentShader = `
precision highp float;
in vec2 gaussianPosition;
in float gaussExtend;
in vec4 gaussianColor;
out vec4 fragColor;
void main() {
  float squaredRadius = dot(gaussianPosition, gaussianPosition);
  if (squaredRadius > gaussExtend * gaussExtend) discard;
  float alpha = min(0.999, gaussianColor.a * exp(-0.5 * squaredRadius));
  if (alpha < 1.0/255.0) discard;
  fragColor = vec4(gaussianColor.rgb, alpha);
}`;

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const meta = await fetchJSON('./assets/model.json');
  const lastSampleSeconds = meta.last_sample_seconds ?? (meta.frames-1)/meta.fps;
  const response = await fetch(`./assets/${meta.buffer}`);
  if (!response.ok) throw new Error('高斯参数读取失败');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== meta.bytes) throw new Error('模型文件大小与元数据不一致');
  const data = new Float32Array(buffer);
  // Portable build: render locally in WebGL, no Python/CUDA backend needed.
  const REMOTE = false;
  const serverMeta = REMOTE ? await (await fetch('/meta')).json() : null;
  const sceneCentre = serverMeta ? new THREE.Vector3(serverMeta.centre[0], serverMeta.centre[1], serverMeta.centre[2]) : null;
  const canvas = $('canvas');
  const renderer = new THREE.WebGLRenderer({canvas, alpha:false, antialias:false, preserveDrawingBuffer:true});
  if (renderer) {
    renderer.setClearColor(0xffffff, 1);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = true;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 4/3, 0.01, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 0.05;
  controls.maxDistance = 180;
  controls.screenSpacePanning = true;
  controls.panSpeed = 0.85;
  const textureWidth = 1024;
  const texelsPerGaussian = meta.texels_per_gaussian ?? 8;
  const shDegree = meta.sh_degree ?? 0;
  const textureHeight = Math.ceil(meta.count * texelsPerGaussian / textureWidth);
  const pixels = new Float32Array(textureWidth * textureHeight * 4);
  pixels.set(data);
  const texture = new THREE.DataTexture(pixels, textureWidth, textureHeight, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0], 3));
  geometry.setIndex([0,1,2, 0,2,3]);
  const indices = new Float32Array(meta.count);
  for (let i=0; i<meta.count; i++) indices[i]=i;
  const order = new THREE.InstancedBufferAttribute(indices, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('splatIndex', order);
  geometry.instanceCount = meta.count;
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader, fragmentShader,
    uniforms: {parameters:{value:texture}, textureWidth:{value:textureWidth}, texelsPerGaussian:{value:texelsPerGaussian},
      shDegree:{value:shDegree}, cameraPos:{value:new THREE.Vector3()}, viewport:{value:new THREE.Vector2()}, sceneTime:{value:0}},
    transparent:true, depthTest:false, depthWrite:false,
    blending:THREE.NormalBlending, side:THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // ---- optional server-side (gsplat) rendering -------------------------------
  const remoteImage = REMOTE ? new Image() : null;
  let remotePending = false, remoteTimer = 0, remoteDataURL = '';
  if (remoteImage) {
    remoteImage.alt = '';
    remoteImage.style.cssText = 'position:absolute;display:block;pointer-events:none;image-rendering:auto';
    canvas.parentElement.appendChild(remoteImage);
    // keep the canvas visible (hidden elements receive no pointer events, which
    // would silently disable OrbitControls); the overlay is pointer-events:none
    canvas.style.opacity = '0';
  }
  function requestRemoteFrame(immediate) {
    if (remotePending) return;
    const now = performance.now();
    if (!immediate && now - remoteTimer < 45) return;
    remotePending = true;
    remoteTimer = now;
    const width = Math.max(320, Math.round(canvas.clientWidth || canvas.width));
    const height = Math.max(240, Math.round(canvas.clientHeight || canvas.height));
    const fmt = immediate ? '&fmt=png' : '';
    // three.js only refreshes matrixWorldInverse inside render(); drive it ourselves
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const m = Array.from(camera.matrixWorldInverse.elements).map(v => v.toFixed(5)).join(',');
    const url = `/frame_m?w=${width}&h=${height}&t=${normalizedTime.toFixed(5)}&fov=${camera.fov.toFixed(3)}&m=${m}${fmt}`;
    fetch(url).then(r => r.blob()).then(blob => {
      const obj = URL.createObjectURL(blob);
      const previous = remoteImage.src;
      remoteImage.src = obj;
      const reader = new FileReader();
      reader.onload = () => { remoteDataURL = String(reader.result); };
      reader.readAsDataURL(blob);
      if (previous && previous.indexOf('blob:') === 0) setTimeout(() => URL.revokeObjectURL(previous), 1000);
      if (!ready) {
        ready = true; $('loading').hidden = true; $('play').disabled = false;
        $('status').textContent = '模型已就绪 · gsplat 远程渲染';
        $('render-stat').textContent = `${(serverMeta ? serverMeta.gaussians : meta.count).toLocaleString()} Gaussians · GPU`;
      }
    }).catch(() => {}).finally(() => { remotePending = false; });
  }

  let normalizedTime=0, playing=false, selectedCamera=0, freeView=false;
  let ready=false, sortDirty=true, sorting=false, sortId=0, lastSortedId=0;
  let lastSort=0, sortedTime=0, shaderFailed=false;
  const worker = new Worker('./sort-worker.js');
  worker.postMessage({type:'init',stride:texelsPerGaussian*4, count:meta.count, buffer:buffer.slice(0)});
  worker.onmessage = ({data:result}) => {
    if (result.type !== 'sorted') return;
    order.array.set(result.indices);
    order.needsUpdate=true;
    lastSortedId=result.request;
    sorting=false;
  };
  worker.onerror = event => showError(new Error(`高斯深度排序失败：${event.message}`));
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    shaderFailed=true;
    showError(new Error(`高斯着色器编译失败\n${gl.getProgramInfoLog(program)}\n${gl.getShaderInfoLog(vertex)}\n${gl.getShaderInfoLog(fragment)}`));
  };
  const cameraMenu=$('camera-select');
  for (let i=0; i<meta.cameras.length; i++) {
    const c=meta.cameras[i];
    const opt=document.createElement('option');
    opt.value=String(i); opt.textContent=c.camera_id;
    cameraMenu.appendChild(opt);
  }
  function viewLabel() {
    $('view-label').textContent=freeView?'自由视角':`原始视角 · ${meta.cameras[selectedCamera].camera_id}`;
  }
  function setCamera(index) {
    selectedCamera=index;
    const c=meta.cameras[index];
    const matrix=new THREE.Matrix4().set(...c.blender_c2w.flat());
    const scale=new THREE.Vector3();
    matrix.decompose(camera.position,camera.quaternion,scale);
    camera.up.setFromMatrixColumn(matrix,1).normalize();
    const direction=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    const orbitDepth = sceneCentre
      ? Math.max(1.0, sceneCentre.clone().sub(camera.position).dot(direction))
      : 14;
    controls.target.copy(camera.position).addScaledVector(direction, orbitDepth);
    camera.aspect=c.image_width/c.image_height;
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(c.image_height/(2*c.intrinsics.fy)));
    camera.updateProjectionMatrix();
    controls.update();
    freeView=false; viewLabel(); cameraMenu.value=String(index);
    $('fov').value=String(camera.fov); $('fov-value').value=`${camera.fov.toFixed(1)}°`;
    resize(); sortDirty=true;
    if(demo)captureDemoBase();
  }
  function resize() {
    const holder=$('viewport');
    const aspect=camera.aspect;
    let width=holder.clientWidth, height=width/aspect;
    if (height>holder.clientHeight) {height=holder.clientHeight;width=height*aspect;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)*Number($('quality').value));
    renderer.setSize(Math.max(1,Math.floor(width)),Math.max(1,Math.floor(height)),false);
    canvas.style.width=`${Math.floor(width)}px`;canvas.style.height=`${Math.floor(height)}px`;
    if (remoteImage) {
      const holder = $('viewport');
      holder.style.position = 'relative';
      remoteImage.style.width = `${Math.floor(width)}px`;
      remoteImage.style.height = `${Math.floor(height)}px`;
      remoteImage.style.left = `${canvas.offsetLeft}px`;
      remoteImage.style.top = `${canvas.offsetTop}px`;
    }
    renderer.getDrawingBufferSize(material.uniforms.viewport.value);
    sortDirty=true;
  }
  function setTime(time) {
    normalizedTime=THREE.MathUtils.clamp(Number(time),0,1);
    material.uniforms.sceneTime.value=normalizedTime;
    $('timeline').value=String(normalizedTime);
    const seconds=normalizedTime*lastSampleSeconds;
    $('time-current').textContent=seconds.toFixed(3);
    $('frame-info').textContent=`t = ${seconds.toFixed(3)} s · ${Math.min(60,Math.floor(normalizedTime*59)+1)} / 60`;
    sortDirty=true;
  }
  function setPlaying(value) {
    playing=Boolean(value);$('play').textContent=playing?'Ⅱ':'▶';
    $('play').setAttribute('aria-label',playing?'暂停':'播放');
  }
  function stepFrame(delta) {setPlaying(false);setTime(normalizedTime+delta/59);}
  // --- 4D 演示：自动播放的同时让镜头做小范围摆动 ---
  const DEMO={yawDeg:2.2,pitchDeg:0.9,yawPeriod:7.2,pitchPeriod:4.6,lag:0.55};
  let demo=false,demoPhase=0,sceneRadius=1;
  {
    let cx=0,cy=0,cz=0;
    for(let i=0;i<meta.count;i++){const o=i*32;cx+=data[o];cy+=data[o+1];cz+=data[o+2];}
    cx/=meta.count;cy/=meta.count;cz/=meta.count;
    let sum=0;
    for(let i=0;i<meta.count;i++){
      const o=i*32,dx=data[o]-cx,dy=data[o+1]-cy,dz=data[o+2]-cz;
      sum+=dx*dx+dy*dy+dz*dz;
    }
    sceneRadius=Math.max(0.05,Math.sqrt(sum/meta.count));
  }
  const demoBase={position:new THREE.Vector3(),quaternion:new THREE.Quaternion()};
  const demoRight=new THREE.Vector3(),demoUp=new THREE.Vector3();
  function captureDemoBase(){demoBase.position.copy(camera.position);demoBase.quaternion.copy(camera.quaternion);}
  function restoreDemoBase(){
    camera.position.copy(demoBase.position);camera.quaternion.copy(demoBase.quaternion);camera.updateMatrixWorld();
  }
  // 摆幅按场景半径换算，换到别的场景也不用改数值
  // 纯旋转：只转头，不移动。位置恒定，所以不会露出没被相机拍到的区域。
  const demoYawQ=new THREE.Quaternion();
  function applyDemo(){
    const omega=2*Math.PI/DEMO.yawPeriod;
    const yaw=THREE.MathUtils.degToRad(DEMO.yawDeg)*Math.sin(demoPhase*omega-DEMO.lag);
    const pitch=THREE.MathUtils.degToRad(DEMO.pitchDeg)*Math.cos(demoPhase*2*Math.PI/DEMO.pitchPeriod);
    camera.position.copy(demoBase.position);
    demoYawQ.setFromAxisAngle(UPV,yaw);          // 绕世界竖直轴转头
    camera.quaternion.copy(demoYawQ).multiply(demoBase.quaternion);
    camera.rotateX(pitch);                        // 再绕自身横轴微俯仰
    camera.updateMatrixWorld();
    syncTarget();
  }
  function setDemo(value){
    const next=Boolean(value);
    if(next===demo)return;
    demo=next;
    const button=$('demo');
    button.setAttribute('aria-pressed',String(demo));
    button.textContent=demo?'■ 停止 4D 演示':'▶ 4D 演示 · 镜头微动';
    if(demo){
      if(normalizedTime>=1)setTime(0);
      if(!playing)setPlaying(true);
      captureDemoBase();demoPhase=0;
    }else{
      restoreDemoBase();controls.update();setPlaying(false);
    }
    sortDirty=true;
  }
  $('demo').onclick=()=>setDemo(!demo);
  controls.addEventListener('change',()=>{sortDirty=true;});
  controls.addEventListener('start',()=>{freeView=true;viewLabel();});
  cameraMenu.addEventListener('change',()=>setCamera(Number(cameraMenu.value)));
  $('timeline').addEventListener('input',()=>{setPlaying(false);setTime($('timeline').value);});
  $('play').onclick=()=>{if(normalizedTime>=1&&!playing)setTime(0);setPlaying(!playing);};
  $('prev').onclick=()=>stepFrame(-1);$('next').onclick=()=>stepFrame(1);
  $('reset').onclick=()=>setCamera(selectedCamera);
  $('fov').addEventListener('input',()=>{
    camera.fov=Number($('fov').value);camera.updateProjectionMatrix();
    $('fov-value').value=`${camera.fov.toFixed(1)}°`;freeView=true;viewLabel();sortDirty=true;
  });
  $('quality').onchange=resize;
  $('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
  $('screenshot').onclick=()=>{
    const link=document.createElement('a');
    link.download=`cut_roasted_beef_${normalizedTime.toFixed(3)}.png`;
    if(REMOTE){
      if(!remoteDataURL)return;
      link.href=remoteDataURL;link.click();return;
    }
    renderer.render(scene,camera);
    link.href=canvas.toDataURL('image/png');link.click();
  };
  const keys=new Set();
  const forward=new THREE.Vector3(), right=new THREE.Vector3(), up=new THREE.Vector3(), motion=new THREE.Vector3();
  // camera translation is disabled on purpose: only the rotation is allowed
  function translate() {
    /* intentionally a no-op: the camera stays where the preset put it */
  }
  const keyMotion={};
  window.addEventListener('keydown',event=>{
    if(event.target.matches('input,select,button')||event.ctrlKey||event.metaKey||event.altKey)return;
    const key=event.key.toLowerCase();
    if(key in keyMotion||key==='shift'){keys.add(key);event.preventDefault();}
    if(event.code==='Space'){event.preventDefault();if(!event.repeat)setPlaying(!playing);}
    if(event.code==='ArrowLeft'){event.preventDefault();stepFrame(-1);}
    if(event.code==='ArrowRight'){event.preventDefault();stepFrame(1);}
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  canvas.addEventListener('pointerdown',()=>canvas.focus());
  // (move-pad removed: the camera position is fixed)
  new ResizeObserver(resize).observe($('viewport'));
  window.addEventListener('resize',resize);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();showError(new Error('显卡渲染连接已断开，请刷新页面。'));});
  const shownCount = serverMeta ? serverMeta.gaussians : meta.count;
  const shownStep = serverMeta ? serverMeta.step : meta.step;
  $('count').textContent=shownCount.toLocaleString();$('step').textContent=shownStep.toLocaleString();
  $('render-stat').textContent=`${shownCount.toLocaleString()} Gaussians · GPU`;
  $('time-total').textContent=`/ ${lastSampleSeconds.toFixed(3)} s`;
  $('time-last-tick').textContent=`${lastSampleSeconds.toFixed(3)} s`;
  // ---- look-around camera (dragging turns the camera in place) --------------
  // The scene's world uses -Y as "up" (OpenCV), so all angle maths happens in a
  // y-up copy of the frame and gets converted back on the way out.
  const UPV = new THREE.Vector3(0,-1,0);
  const toYUp = v => new THREE.Vector3(v.x,-v.y,v.z);
  const fromYUp = v => new THREE.Vector3(v.x,-v.y,v.z);
  const arc = {min:-Math.PI, max:Math.PI};
  const fwd = new THREE.Vector3();

  function currentYawPitch(){
    camera.getWorldDirection(fwd);
    const u = toYUp(fwd).normalize();
    return {yaw: Math.atan2(u.x,u.z), pitch: Math.asin(THREE.MathUtils.clamp(u.y,-1,1))};
  }
  function applyYawPitch(yaw,pitch){
    const cp = Math.cos(pitch);
    const dirY = new THREE.Vector3(Math.sin(yaw)*cp, Math.sin(pitch), Math.cos(yaw)*cp);
    const dir = fromYUp(dirY).normalize();
    camera.up.copy(UPV);
    camera.lookAt(camera.position.clone().add(dir));
    camera.updateMatrixWorld();
    syncTarget();
  }
  function syncTarget(){
    camera.getWorldDirection(fwd);
    const depth = sceneCentre ? Math.max(0.5, sceneCentre.clone().sub(camera.position).dot(fwd)) : 14;
    controls.target.copy(camera.position).addScaledVector(fwd, depth);
  }

  // measure the arc the real cameras look at, so the view cannot be turned to the
  // unobserved back side of the scene
  {
    const yaws=[];
    for(let i=0;i<meta.cameras.length;i++){
      setCamera(i);
      const yp = currentYawPitch();
      yaws.push(yp.yaw);
    }
    const base=yaws[0];
    const un=yaws.map(a=>{let d=a-base;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return base+d;});
    const margin=Math.PI*4/180;
    arc.min=Math.min(...un)-margin;
    arc.max=Math.max(...un)+margin;
  }

  // dragging = turn the camera; right button (or shift) = slide it sideways
  controls.enabled=false;
  let dragMode=null,lastX=0,lastY=0;
  canvas.addEventListener('pointerdown',e=>{
    dragMode='look';                 // camera position is locked: drag only turns
    lastX=e.clientX;lastY=e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.focus();
  });
  canvas.addEventListener('pointermove',e=>{
    if(!dragMode)return;
    const dx=e.clientX-lastX, dy=e.clientY-lastY;
    lastX=e.clientX;lastY=e.clientY;
    if(dragMode==='look'){
      const yp=currentYawPitch();
      let yaw=yp.yaw-dx*0.0045;
      const pitch=THREE.MathUtils.clamp(yp.pitch-dy*0.0045,-1.35,1.35);
      if(arc.max-arc.min<Math.PI*1.6){
        // clamp inside the calibrated arc (handle the ±π wrap)
        let rel=yaw-arc.min, span=arc.max-arc.min;
        rel=((rel%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
        yaw = (rel>span)? arc.max : arc.min+rel;
      }
      applyYawPitch(yaw,pitch);
      if(demo)captureDemoBase();     // drag re-anchors the demo's neutral orientation
    }
    freeView=true;viewLabel();sortDirty=true;
  });
  const endDrag=e=>{dragMode=null;try{canvas.releasePointerCapture(e.pointerId);}catch(err){}};
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{e.preventDefault();},{passive:false});  // position is fixed

  setCamera(0);setTime(0);
  let previous=performance.now(), fpsStart=previous, fpsFrames=0, firstFrameAt=0;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-previous)/1000,0.1);previous=now;
    if(playing){let next=normalizedTime+dt*Number($('speed').value)/lastSampleSeconds;
      if(next>=1){if($('loop').checked)next%=1;else{next=1;setPlaying(false);}}setTime(next);}
    for(const key of keys){if(key in keyMotion)translate(keyMotion[key],dt*(keys.has('shift')?10:2));}
    if(demo)restoreDemoBase();
    controls.update();camera.updateMatrixWorld();
    material.uniforms.cameraPos.value.copy(camera.position);
    if(demo){
      if(playing)demoPhase+=dt*Number($('speed').value);
      applyDemo();
      if(playing)sortDirty=true;
    }
    if(!REMOTE&&sortDirty&&!sorting&&(now-lastSort>40||!ready)){
      sorting=true;sortDirty=false;lastSort=now;sortedTime=normalizedTime;
      worker.postMessage({type:'sort',view:Array.from(camera.matrixWorldInverse.elements),time:normalizedTime,request:++sortId});
    }
    if(REMOTE){
      requestRemoteFrame(now - remoteTimer > 400);
    }else{renderer.render(scene,camera);}
    if(!ready&&lastSortedId>0&&!shaderFailed){
      if(!firstFrameAt)firstFrameAt=now;
      if(now-firstFrameAt>120){ready=true;$('loading').hidden=true;$('play').disabled=false;$('status').textContent='模型已就绪 · 本地实时渲染';}
    }
    fpsFrames++;
    if(now-fpsStart>700){$('fps').textContent=`${Math.round(fpsFrames*1000/(now-fpsStart))} FPS`;fpsFrames=0;fpsStart=now;}
  });
  // Small inspection API for validation and repeatable screenshots.
  window.viewer={meta,camera,controls,renderer,mesh,data,setTime,setCamera,setPlaying,
    get ready(){return ready;},get time(){return normalizedTime;},get sorting(){return sorting||sortDirty;},
    get sortedTime(){return sortedTime;},get sortId(){return lastSortedId;},
    get remote(){return REMOTE;},
    capture(){if(REMOTE)return remoteDataURL||'';renderer.render(scene,camera);return canvas.toDataURL('image/png');},
    setDemo,get demo(){return demo;},get demoPhase(){return demoPhase;},get sceneRadius(){return sceneRadius;},
  };
}

function showError(error) {
  console.error(error);
  window.viewerError=String(error);
  $('loading').hidden=true;$('error').hidden=false;
  $('error').textContent=`场景加载失败：${error.message}`;
  $('status').textContent='加载失败';
}
main().catch(showError);
