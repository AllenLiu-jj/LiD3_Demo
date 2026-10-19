"""Thin adapter for pinned HUST 4D-GS; no 4K4D or web-service dependency."""
import io
import sys
import types
from pathlib import Path
from types import SimpleNamespace
import numpy as np
from PIL import Image
from .assets import load_assets
from .raster import projected_masks
from .relations import annotation_packet


def make_camera(state, time, torch):
    width, height = state['width'], state['height']
    K = np.array(state['K']).reshape(3, 3)
    w2c = np.linalg.inv(np.array(state['cameraToWorld']).reshape(4, 4))
    near, far = .01, 100.
    projection = np.array([[2*K[0,0]/width,0,(2*K[0,2]+1)/width-1,0],
        [0,2*K[1,1]/height,(2*K[1,2]+1)/height-1,0],
        [0,0,far/(far-near),-far*near/(far-near)],[0,0,1,0]], dtype=np.float32)
    return SimpleNamespace(FoVx=2*np.arctan(width/(2*K[0,0])), FoVy=2*np.arctan(height/(2*K[1,1])),
        image_width=width, image_height=height, time=time,
        world_view_transform=torch.tensor(w2c.T,dtype=torch.float32,device='cuda'),
        full_proj_transform=torch.tensor((projection@w2c).T,dtype=torch.float32,device='cuda'),
        camera_center=torch.tensor(np.linalg.inv(w2c)[:3,3],dtype=torch.float32,device='cuda'))


class Renderer:
    def __init__(self, model_path, dataset_path, upstream, labels_path=None):
        metadata, self.data, self.semantic = load_assets(model_path, dataset_path, labels_path)
        import torch
        self.torch = torch
        torch.set_num_threads(4)
        upstream = Path(upstream).resolve()
        sys.path.insert(0, str(upstream))
        package = types.ModuleType('scene'); package.__path__ = [str(upstream/'scene')]
        sys.modules['scene'] = package
        from scene.gaussian_model import GaussianModel
        from gaussian_renderer import render
        self.render_fn = render
        self.model = GaussianModel(3, SimpleNamespace(**metadata['hidden']))
        folder = Path(model_path).parent
        self.model.load_ply(str(folder/'point_cloud.ply')); self.model.load_model(str(folder))
        self.model._deformation.eval()
        self.pipe = SimpleNamespace(convert_SHs_python=False,compute_cov3D_python=False,debug=False)
        self.background = torch.zeros(3,device='cuda')
        self.labels = None
        if self.semantic:
            labels = np.load(Path(labels_path).parent/'labels.npy',allow_pickle=False)
            if self.semantic['pointCount']!=len(self.model.get_xyz) or labels.dtype != np.uint8 or labels.shape != (len(self.model.get_xyz),) or labels.max(initial=0)>len(self.semantic['entities']):
                raise ValueError('semantic labels type/count mismatch')
            self.labels = torch.from_numpy(labels).to('cuda')

    def render(self, state, frame_id):
        ids = self.data['frameIds']
        if frame_id not in ids: raise ValueError('unavailable source frame')
        time = (frame_id-ids[0])/(ids[-1]-ids[0]) if len(ids)>1 else 0.
        camera = make_camera(state,time,self.torch)
        with self.torch.no_grad():
            image = self.render_fn(camera,self.model,self.pipe,self.background,stage='fine')['render']
            rgb = (image.clamp(0,1).permute(1,2,0)*255).to(self.torch.uint8).cpu().numpy()
        stream = io.BytesIO()
        Image.fromarray(rgb).save(stream,format='JPEG',quality=95,subsampling=0)
        jpeg = stream.getvalue()
        base = None
        if self.labels is not None:
            masks = projected_masks(self,camera,self.labels,len(self.semantic['entities']))
            base = annotation_packet(self.semantic['entities'],masks)
        return Image.open(io.BytesIO(jpeg)).convert('RGB'), jpeg, base

    def close(self):
        del self.model
        self.torch.cuda.empty_cache()
