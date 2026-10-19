"""Copy only inference assets from our server workspace or extracted delivery."""
import argparse
import shutil
from pathlib import Path
from actor_demo.assets import load_assets


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--output',type=Path,default=Path('assets'))
    a=p.parse_args();source=a.source.resolve();out=a.output.resolve()
    if out.exists() and any(out.iterdir()):raise ValueError('use a new empty asset directory')
    server=(source/'trained-v2-200').is_dir()
    model=source/('trained-v2-200/fine-020000' if server else 'model-200')
    labels=source/('trained-v2-200/semantic-v1' if server else 'semantics-200')
    dataset=source/('data-200/dataset.json' if server else 'dataset-200.json')
    load_assets(model/'model.json',dataset,labels/'manifest.json')
    mapping={dataset:'dataset.json',**{model/name:'model/'+name for name in
        ('model.json','point_cloud.ply','deformation.pth','deformation_table.pth','deformation_accum.pth')},
        labels/'manifest.json':'semantics/manifest.json',labels/'labels.npy':'semantics/labels.npy'}
    for src,destination in mapping.items():
        target=out/destination;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,target)
    load_assets(out/'model/model.json',out/'dataset.json',out/'semantics/manifest.json')
    print('ASSETS_VERIFIED',out)


if __name__=='__main__':main()
