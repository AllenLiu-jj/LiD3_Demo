import numpy as np
import pytest


def test_wide_path_uses_each_available_time_once_and_keeps_a_rigid_camera():
    from actor_demo.camera import wide_camera_path
    records=wide_camera_path(list(range(200)),[[-1,-1,0],[1,1,2]],[0,0,1])
    assert [r['sourceFrame'] for r in records]==list(range(200))
    assert records[0]['yawDegrees']==pytest.approx(-32.5)
    assert records[-1]['yawDegrees']==pytest.approx(32.5)
    assert records[100]['radius']<records[0]['radius']
    target=np.array([0,0,1])
    for record in records:
        pose=np.array(record['cameraToWorld']).reshape(4,4)
        assert np.allclose(pose[:3,:3].T@pose[:3,:3],np.eye(3))
        assert np.linalg.det(pose[:3,:3])==pytest.approx(1)
        forward=target-pose[:3,3];forward/=np.linalg.norm(forward)
        assert np.allclose(pose[:3,2],forward)


def test_wide_path_rejects_repeated_times_or_unverified_world_axis():
    from actor_demo.camera import wide_camera_path
    with pytest.raises(ValueError):wide_camera_path([0,0],[[-1,-1,0],[1,1,2]],[0,0,1])
    with pytest.raises(ValueError):wide_camera_path([0,1],[[-1,-1,0],[1,1,2]],[0,1,0])
