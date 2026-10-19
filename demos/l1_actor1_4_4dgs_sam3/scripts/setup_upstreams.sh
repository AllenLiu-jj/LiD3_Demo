#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p vendor
if [[ ! -d vendor/4dgs/.git ]]; then
  git clone --no-checkout https://github.com/hustvl/4DGaussians.git vendor/4dgs
fi
git -C vendor/4dgs checkout --detach 843d5ac636c37e4b611242287754f3d4ed150144
git -C vendor/4dgs submodule update --init --recursive
test "$(git -C vendor/4dgs/submodules/simple-knn rev-parse HEAD)" = 44f764299fa305faf6ec5ebd99939e0508331503
test "$(git -C vendor/4dgs/submodules/depth-diff-gaussian-rasterization rev-parse HEAD)" = e49506654e8e11ed8a62d22bcb693e943fdecacf
if [[ ! -d vendor/sam3/.git ]]; then
  git clone --no-checkout https://github.com/facebookresearch/sam3.git vendor/sam3
fi
git -C vendor/sam3 checkout --detach 7f473cfd983d5eb43040ff608f66bff0d7bdcb53
# Compatibility only: no model equations or checkpoint values change.
python - <<'PY'
from pathlib import Path
root=Path('vendor/4dgs')
for name,line in [('scene/gaussian_model.py','import open3d as o3d'),('scene/deformation.py','from tkinter import W')]:
    p=root/name;p.write_text(p.read_text().replace(line,'# Unused optional import removed for headless inference'))
p=root/'submodules/simple-knn/simple_knn.cu';text=p.read_text()
if '#include <cfloat>' not in text:p.write_text('#include <cfloat>\n'+text)
PY
export MAX_JOBS="${MAX_JOBS:-6}"
python -m pip install --no-build-isolation --no-deps ./vendor/4dgs/submodules/simple-knn
python -m pip install --no-build-isolation --no-deps ./vendor/4dgs/submodules/depth-diff-gaussian-rasterization
