"""Use the trained deformation and opacity for occlusion-consistent label views."""
import math
import numpy as np


def deformation(runtime,camera):
    torch=runtime.torch;model=runtime.model
    time=torch.full((len(model.get_xyz),1),camera.time,device='cuda')
    with torch.no_grad():
        xyz,scale,rotation,opacity,_=model._deformation(model.get_xyz,model._scaling,model._rotation,
            model._opacity,model.get_features,time)
    return xyz,model.scaling_activation(scale),model.rotation_activation(rotation),model.opacity_activation(opacity)


def raster(runtime,camera,geometry,colors):
    from diff_gaussian_rasterization import GaussianRasterizationSettings,GaussianRasterizer
    torch=runtime.torch
    settings=GaussianRasterizationSettings(image_height=camera.image_height,image_width=camera.image_width,
        tanfovx=math.tan(camera.FoVx*.5),tanfovy=math.tan(camera.FoVy*.5),bg=runtime.background,
        scale_modifier=1.,viewmatrix=camera.world_view_transform,projmatrix=camera.full_proj_transform,
        sh_degree=0,campos=camera.camera_center,prefiltered=False,debug=False)
    xyz,scale,rotation,opacity=geometry
    with torch.no_grad():
        image,_,depth=GaussianRasterizer(raster_settings=settings)(means3D=xyz,means2D=torch.zeros_like(xyz),
            shs=None,colors_precomp=colors.contiguous(),opacities=opacity,scales=scale,rotations=rotation,cov3D_precomp=None)
    return image,depth


def projected_masks(runtime,camera,labels,count):
    torch=runtime.torch;geometry=deformation(runtime,camera);layers=[]
    for start in range(1,count+1,3):
        colors=torch.stack([(labels==i).float() for i in range(start,start+3)],1)
        image,_=raster(runtime,camera,geometry,colors)
        layers.extend(image.detach().cpu().numpy())
    scores=np.stack(layers[:count]);winner=scores.argmax(0);maximum=scores.max(0)
    return np.stack([(winner==i)&(maximum>.3) for i in range(count)])
