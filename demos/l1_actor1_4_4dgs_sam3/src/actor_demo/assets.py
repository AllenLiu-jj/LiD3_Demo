"""Validate complete model assets before importing GPU libraries."""
import hashlib
import json
from pathlib import Path


def sha256(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def load_assets(model_path, dataset_path, labels_path=None):
    model_path, dataset_path = Path(model_path).resolve(), Path(dataset_path).resolve()
    model = json.loads(model_path.read_text())
    if model.get('smokeOnly', True) or model.get('stage') != 'fine':
        raise ValueError('a completed formal fine-stage model is required')
    if model['iteration'] != model['config']['fineIterations']:
        raise ValueError('incomplete fine stage')
    required = {'point_cloud.ply', 'deformation.pth', 'deformation_table.pth', 'deformation_accum.pth'}
    if not required.issubset(model['files']):
        raise ValueError('complete Gaussian and deformation assets are required')
    for name, expected in model['files'].items():
        path = (model_path.parent / name).resolve()
        if not path.is_relative_to(model_path.parent) or sha256(path) != expected:
            raise ValueError('model asset hash/path mismatch')
    if sha256(dataset_path) != model['datasetSha256']:
        raise ValueError('dataset/model identity mismatch')
    data = json.loads(dataset_path.read_text())
    semantic = None
    if labels_path:
        labels_path = Path(labels_path)
        semantic = json.loads(labels_path.read_text())
        if semantic['checkpointHash'] != sha256(model_path):
            raise ValueError('semantic/model identity mismatch')
        if sha256(labels_path.parent / 'labels.npy') != semantic['labelsSha256']:
            raise ValueError('semantic labels hash mismatch')
    return model, data, semantic
