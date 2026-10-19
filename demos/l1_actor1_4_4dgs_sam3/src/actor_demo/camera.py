"""Actor-centered camera move matching the verified wide-view reference."""
import math
import numpy as np


def wide_camera_path(frame_ids,bounds,world_up):
    if len(frame_ids)<2 or len(set(frame_ids))!=len(frame_ids):raise ValueError('distinct source times required')
    up=np.asarray(world_up,dtype=float)
    if not np.allclose(up,[0,0,1]):raise ValueError('this reference path requires verified Z-up coordinates')
    target=np.mean(np.asarray(bounds,dtype=float),axis=0);records=[]
    for index,frame in enumerate(frame_ids):
        u=index/(len(frame_ids)-1);s=u*u*(3-2*u)
        yaw=math.radians(-32.5+65*s);radius=5.35*(1-.16*math.sin(math.pi*s))
        position=target+np.array([radius*math.sin(yaw),-radius*math.cos(yaw),.06+.20*math.sin(math.pi*s)])
        forward=target-position;forward/=np.linalg.norm(forward)
        right=np.cross(forward,up);right/=np.linalg.norm(right);down=np.cross(forward,right)
        pose=np.eye(4);pose[:3,:3]=np.stack([right,down,forward],axis=1);pose[:3,3]=position
        records.append(dict(outputFrame=index,sourceFrame=frame,yawDegrees=math.degrees(yaw),radius=radius,
            cameraToWorld=pose.ravel().tolist()))
    return records
