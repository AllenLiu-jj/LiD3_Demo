"""Server-only wide-view export: each N200 source time once, RGB and outlines."""
import argparse,gzip,hashlib,io,json,os,time
from pathlib import Path
import av
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from .camera import wide_camera_path
from .renderer import Renderer
from .segmenter import ReferenceSegmenter
from .predictions import predictions_to_annotations
from .drawing import draw_annotation
from .assets import sha256 as sha

def video_stream(path,fps):
    container=av.open(str(path),'w',options={'movflags':'+faststart'})
    stream=container.add_stream('libx264',rate=fps);stream.width=1280;stream.height=720;stream.pix_fmt='yuv420p'
    stream.options={'crf':'18','preset':'medium','threads':'2'}
    return container,stream


def encode(container,stream,image):
    for packet in stream.encode(av.VideoFrame.from_ndarray(np.asarray(image),format='rgb24')):container.mux(packet)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    for option in ('model','dataset','upstream','sam3-source','sam3-checkpoint','font','output'):
        p.add_argument('--'+option,type=Path,required=True)
    p.add_argument('--labels',type=Path,help='optional Gaussian identity-reference manifest')
    p.add_argument('--config',type=Path,default=Path(__file__).resolve().parents[2]/'configs/entities.json')
    p.add_argument('--fps',type=int,default=25)
    a=p.parse_args()
    if a.fps<1 or a.fps>120:raise ValueError('playback fps must be 1..120')
    out=a.output.resolve();out.mkdir(parents=True,exist_ok=True);started=time.monotonic()
    os.nice(8)
    expected='9999e2341ceef5e136daa386eecb55cb414446a00ac2b55eb2dfd2f7c3cf8c9e'
    if sha(a.sam3_checkpoint)!=expected:raise ValueError('SAM3 weight identity mismatch')
    weight_manifest=dict(sha256=expected)
    cfg=json.loads(a.config.read_text(encoding='utf-8-sig'))
    renderer=Renderer(a.model,a.dataset,a.upstream,a.labels);data=renderer.data;ids=data['frameIds']
    if ids!=list(range(200)):raise ValueError('this demo requires the complete trained N200 sequence')
    camera=next(c for c in data['cameras'] if c['cameraId']=='14')
    path=wide_camera_path(ids,data['bounds'],data['worldUp'])
    font=ImageFont.truetype(str(a.font),18)
    model=ReferenceSegmenter(a.sam3_source,a.sam3_checkpoint,cfg['confidenceThreshold'])
    targets={name:out/name for name in ('actor1_4-wide-200.mp4','actor1_4-wide-200-semantic.mp4')}
    outputs={name:video_stream(value.with_name(value.stem+'.partial.mp4'),a.fps) for name,value in targets.items()}
    records=[];counts={};relation_counts={};previews=[];selected={0,40,80,120,160,199}
    try:
        for record in path:
            index=record['outputFrame'];state=dict(K=camera['K'],cameraToWorld=record['cameraToWorld'],width=1280,height=720)
            image,jpeg,base=renderer.render(state,record['sourceFrame'])
            predictions=model.segment(image,cfg['prompts'])
            annotations=predictions_to_annotations(predictions,cfg['entities'],base)
            camera_hash=hashlib.sha256(json.dumps(state,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            for relation in annotations['relations']:relation['provenance']='sam3-current-view-mask-geometry'
            marked=draw_annotation(image.copy(),annotations,font)
            encode(*outputs['actor1_4-wide-200.mp4'],image);encode(*outputs['actor1_4-wide-200-semantic.mp4'],marked)
            for entity in annotations['entities']:counts[entity['id']]=counts.get(entity['id'],0)+1
            for edge in annotations['relations']:relation_counts[edge['predicate']]=relation_counts.get(edge['predicate'],0)+1
            records.append(record|dict(camera=state,cameraHash=camera_hash,imageSha256=hashlib.sha256(jpeg).hexdigest(),annotations=annotations))
            if index in selected:
                marked.save(out/f'preview-{index:03}.jpg',quality=94);image.save(out/f'clean-{index:03}.jpg',quality=94)
                previews.append((index,marked.resize((640,360))))
            if index%20==0:print('WIDE_FRAME',index,[e['id'] for e in annotations['entities']],round(time.monotonic()-started,1),flush=True)
        for container,stream in outputs.values():
            for packet in stream.encode():container.mux(packet)
            container.close()
    finally:renderer.close()
    videos={}
    for name,target in targets.items():
        temporary=target.with_name(target.stem+'.partial.mp4')
        with av.open(str(temporary)) as container:
            count=0
            for frame in container.decode(video=0):
                if (frame.width,frame.height)!=(1280,720):raise ValueError('wrong export dimensions')
                count+=1
        if count!=200:raise ValueError('incomplete video')
        temporary.replace(target);videos[name]=dict(frames=count,sha256=sha(target),bytes=target.stat().st_size)
    sheet=Image.new('RGB',(1280,3*392),(18,26,33));draw=ImageDraw.Draw(sheet)
    for i,(index,image) in enumerate(previews):
        x=(i%2)*640;y=(i//2)*392;sheet.paste(image,(x,y+28));draw.text((x+12,y+8),f'Frame {index} | yaw {path[index]["yawDegrees"]:.1f} deg',fill='white')
    sheet.save(out/'contact-sheet.jpg',quality=93)
    with gzip.open(out/'annotations.jsonl.gz','wt',encoding='utf-8') as stream:
        for record in records:stream.write(json.dumps(record,ensure_ascii=False)+'\n')
    report=dict(completed=True,checkpointHash=sha(a.model),sourceFrames=ids,outputFrames=200,
        playbackFps=a.fps,durationSec=200/a.fps,resolution=[1280,720],yawRangeDegrees=[-32.5,32.5],
        radiusRange=[min(r['radius'] for r in path),max(r['radius'] for r in path)],videos=videos,detectionFrames=counts,
        relationCounts=relation_counts,physicalContactEstablished=False,actionRecognition=False,entityFill=False,
        semanticSource='independent SAM3 on each actual wide-view render',sam3Sha256=weight_manifest['sha256'],
        reference='65 degree sweep with a 16 percent radial dolly',scriptSha256=sha(__file__),elapsedSec=time.monotonic()-started)
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    (out/'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>actor1_4 · 200 帧大幅移动视角</title><style>body{margin:32px auto;max-width:1280px;padding:0 20px;background:#101922;color:#f0f4f8;font:16px/1.7 system-ui}video{width:100%;border-radius:12px;background:#000}a{color:#9bddff}</style><h1>actor1_4 · 200 帧大幅移动视角</h1><p>约 65° 左右横移，配合推近拉远。200 个源状态各使用一次；200 帧、8 秒、1280×720、25FPS 播放，不代表已核实采集帧率。</p><h2>实体轮廓与关系标注版</h2><video controls preload="metadata" playsinline poster="preview-000.jpg" src="actor1_4-wide-200-semantic.mp4"></video><p>每张实际移动视角画面直接运行 SAM3，仅描边，不填充。持有／地面邻接为二维候选；遮挡或漏检不补造关系。原模型边缘模糊保留。</p><h2>纯画面版</h2><video controls preload="metadata" playsinline poster="clean-000.jpg" src="actor1_4-wide-200.mp4"></video><p><a href="actor1_4-wide-200-semantic.mp4" download>下载标注版</a> · <a href="actor1_4-wide-200.mp4" download>下载纯画面</a> · <a href="report.json">导出报告</a> · <a href="annotations.jsonl.gz">逐帧相机与标注</a></p></html>'''.replace('200 帧、8 秒、1280×720、25FPS 播放',f'200 帧、{200/a.fps:g} 秒、1280×720、{a.fps}FPS 播放'),encoding='utf-8')
    print('WIDE_EXPORT_COMPLETED',json.dumps(report,ensure_ascii=False),flush=True)


if __name__=='__main__':main()
