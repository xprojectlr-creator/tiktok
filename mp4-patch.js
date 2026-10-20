// mp4-patch.js — free-box padding, tidak merusak struktur video
window.patchMp4 = function(arrayBuffer) {
  return new Promise(function(resolve) {
    try {
      var padSize = Math.min(
        Math.floor(arrayBuffer.byteLength * 0.30),
        5 * 1024 * 1024
      );

      var out = new Uint8Array(arrayBuffer.byteLength + 8 + padSize);
      out.set(new Uint8Array(arrayBuffer), 0);

      var off = arrayBuffer.byteLength;
      var dv = new DataView(out.buffer);

      dv.setUint32(off, 8 + padSize, false);
      out[off + 4] = 0x66; // f
      out[off + 5] = 0x72; // r
      out[off + 6] = 0x65; // e
      out[off + 7] = 0x65; // e

      resolve({
        blob: new Blob([out], { type: 'video/mp4' }),
        patched: true,
        originalSize: arrayBuffer.byteLength,
        newSize: out.length,
        paddedBytes: padSize
      });
    } catch (e) {
      resolve({
        blob: new Blob([arrayBuffer], { type: 'video/mp4' }),
        patched: false,
        reason: e.message
      });
    }
  });
};
