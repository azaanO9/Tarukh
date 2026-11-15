import type * as T from 'three';

/** Upload a CPU track rectangle without copyTextureToTexture's synchronous GPU queries.
 * The renderer owns the binding; Three resets unpack flags for its other texture uploads.
 * Row/skip state is restored to the WebGL defaults before returning.
 */
export function uploadTrackRectangle(
  renderer:T.WebGLRenderer, texture:T.DataTexture, data:Uint8Array,
  sourceWidth:number, sx:number, sy:number, width:number, height:number, dx:number, dy:number,
) {
  renderer.initTexture(texture);
  const gl=renderer.getContext() as WebGL2RenderingContext;
  // Three 0.180 exposes the initialized texture through its renderer property store.
  const {__webglTexture:handle}=renderer.properties.get(texture) as {__webglTexture:WebGLTexture};
  renderer.state.bindTexture(gl.TEXTURE_2D,handle);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH,sourceWidth);
  gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT,0);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,sx);
  gl.pixelStorei(gl.UNPACK_SKIP_ROWS,sy);
  gl.pixelStorei(gl.UNPACK_SKIP_IMAGES,0);
  try {
    gl.texSubImage2D(gl.TEXTURE_2D,0,dx,dy,width,height,gl.RGBA,gl.UNSIGNED_BYTE,data);
  } finally {
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH,0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS,0);
    renderer.state.unbindTexture();
  }
}
