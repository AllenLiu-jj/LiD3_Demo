let params, count, stride;
self.onmessage = ({data}) => {
  if (data.type === 'init') {
    params = new Float32Array(data.buffer);
    count = data.count;
    stride = data.stride;              // floats per Gaussian (texels * 4)
    return;
  }
  if (data.type !== 'sort' || !params) return;
  const {view, time, request} = data;
  const depth = new Float32Array(count);
  const indices = new Uint32Array(count);
  const halfSquare = 0.5 * time * time;
  for (let i = 0; i < count; i++) {
    const off = i * stride;
    const x = params[off] + params[off+4] * time + params[off+8] * halfSquare;
    const y = params[off+1] + params[off+5] * time + params[off+9] * halfSquare;
    const z = params[off+2] + params[off+6] * time + params[off+10] * halfSquare;
    depth[i] = view[2]*x + view[6]*y + view[10]*z + view[14];
    indices[i] = i;
  }
  // view-space z is negative in front, more negative = farther:
  // draw the farthest first so blending is back-to-front
  indices.sort((a,b) => depth[a]-depth[b]);
  self.postMessage({type:'sorted', request, indices}, [indices.buffer]);
};
