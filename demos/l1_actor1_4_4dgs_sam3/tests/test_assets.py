import json
import pytest
from actor_demo.assets import load_assets,sha256


def bundle(tmp_path):
    data=tmp_path/'dataset.json';data.write_text(json.dumps({'root':'/old/server/path','frameIds':[0,1]}))
    names=['point_cloud.ply','deformation.pth','deformation_table.pth','deformation_accum.pth']
    for name in names:(tmp_path/name).write_bytes(name.encode())
    model=tmp_path/'model.json'
    model.write_text(json.dumps(dict(smokeOnly=False,stage='fine',iteration=20,config={'fineIterations':20},
        datasetSha256=sha256(data),files={name:sha256(tmp_path/name) for name in names})))
    return model,data


def test_portable_metadata_retains_original_hash_without_using_old_root(tmp_path):
    model,data=bundle(tmp_path)
    _,dataset,_=load_assets(model,data)
    assert dataset['root']=='/old/server/path'
    data.write_text('{}')
    with pytest.raises(ValueError,match='identity'):load_assets(model,data)


def test_mutated_weights_and_missing_deformation_are_rejected(tmp_path):
    model,data=bundle(tmp_path)
    (tmp_path/'deformation.pth').write_bytes(b'changed')
    with pytest.raises(ValueError,match='hash'):load_assets(model,data)
    model,data=bundle(tmp_path);metadata=json.loads(model.read_text());metadata['files'].pop('deformation.pth')
    model.write_text(json.dumps(metadata))
    with pytest.raises(ValueError,match='complete'):load_assets(model,data)
