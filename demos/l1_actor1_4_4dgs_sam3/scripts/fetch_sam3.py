"""Download the fixed public ModelScope artifact and verify before publishing it."""
import argparse
from pathlib import Path
from urllib.request import urlretrieve
from actor_demo.assets import sha256

REVISION='f8ee5d16d5c30d0e87b1d22cbd358ce97761df56'
EXPECTED='9999e2341ceef5e136daa386eecb55cb414446a00ac2b55eb2dfd2f7c3cf8c9e'
URL=f'https://modelscope.cn/models/facebook/sam3/resolve/{REVISION}/sam3.pt'


def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=Path('assets/sam3.pt'));a=p.parse_args()
    target=a.output
    if target.exists():
        if sha256(target)!=EXPECTED:raise ValueError('existing SAM3 file does not match the pinned artifact')
    else:
        target.parent.mkdir(parents=True,exist_ok=True);partial=target.with_suffix('.pt.part')
        urlretrieve(URL,partial)
        if sha256(partial)!=EXPECTED:raise ValueError('download hash mismatch; partial file retained')
        partial.replace(target)
    print('SAM3_VERIFIED',target,EXPECTED)


if __name__=='__main__':main()
