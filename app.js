(function () {
  'use strict';

  const pickLabel = document.getElementById('pickLabel');
  const fileInput = document.getElementById('fileInput');
  const fileNameEl = document.getElementById('fileName');
  const fileSizeEl = document.getElementById('fileSize');
  const prosesBtn = document.getElementById('prosesBtn');
  const simpanBtn = document.getElementById('simpanBtn');
  const manualLinks = document.getElementById('manualLinks');
  const manualDownload = document.getElementById('manualDownload');
  const openTab = document.getElementById('openTab');
  const logEl = document.getElementById('log');

  let fileDipilih = null;
  let blobHasil = null;
  let manualUrl = null;

  function log(msg) {
    const t = new Date().toLocaleTimeString();
    logEl.value += '[' + t + '] ' + msg + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }

  function mb(bytes) {
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function namaDasar(nama) {
    return nama.replace(/\.[^.]+$/, '') || 'video';
  }

  // Cari fungsi patch yang diekspos mp4-patch.js tanpa mengubah file tersebut.
  function cariPatcher() {
    const w = window;
    const kandidat = [
      w.patchMp4, w.patchMP4, w.mp4Patch, w.inflateMp4, w.inflate,
      w.MP4Patch && w.MP4Patch.patch, w.Mp4Patch && w.Mp4Patch.patch,
      w.mp4Patch && w.mp4Patch.patch, w.MP4Patch && w.MP4Patch.inflate,
      w.Mp4Patch && w.Mp4Patch.inflate
    ];
    for (const fn of kandidat) {
      if (typeof fn === 'function') return fn;
    }
    return null;
  }

  function sembunyikanManual() {
    manualLinks.style.display = 'none';
    if (manualUrl) { URL.revokeObjectURL(manualUrl); manualUrl = null; }
  }

  function pilihFile(file) {
    if (!file) return;
    fileDipilih = file;
    blobHasil = null;
    simpanBtn.style.display = 'none';
    sembunyikanManual();
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = 'Ukuran asli: ' + mb(file.size);
    prosesBtn.style.display = '';
    prosesBtn.disabled = false;
    log('File dipilih: ' + file.name + ' (' + mb(file.size) + ')');
  }

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) pilihFile(fileInput.files[0]);
  });

  // Drag-drop desktop
  pickLabel.addEventListener('dragover', function (e) {
    e.preventDefault();
    pickLabel.style.background = '#eee';
  });
  pickLabel.addEventListener('dragleave', function () {
    pickLabel.style.background = '';
  });
  pickLabel.addEventListener('drop', function (e) {
    e.preventDefault();
    pickLabel.style.background = '';
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) pilihFile(f);
  });

  prosesBtn.addEventListener('click', async function () {
    if (!fileDipilih) return;
    prosesBtn.disabled = true;
    simpanBtn.style.display = 'none';
    sembunyikanManual();
    try {
      log('Membaca file…');
      const buf = await fileDipilih.arrayBuffer();
      const patch = cariPatcher();
      let out;
      if (patch) {
        log('Menjalankan patch…');
        out = await patch(buf, log);
      } else {
        log('Fungsi patch dari mp4-patch.js tidak ditemukan — file disalin apa adanya.');
        out = buf;
      }
      blobHasil = out instanceof Blob ? out : new Blob([out], { type: 'video/mp4' });
      log('Selesai. Ukuran hasil: ' + mb(blobHasil.size));
      simpanBtn.style.display = '';
    } catch (e) {
      log('Proses gagal: ' + (e && e.message ? e.message : e));
    } finally {
      prosesBtn.disabled = false;
    }
  });

  simpanBtn.addEventListener('click', async function () {
    if (!blobHasil || !fileDipilih) return;
    simpanBtn.disabled = true;
    try {
      await simpanFile(blobHasil, namaDasar(fileDipilih.name) + '-patched.mp4');
    } finally {
      simpanBtn.disabled = false;
    }
  });

  async function simpanFile(blob, namaFile) {
    // LANGKAH 0 — siapkan File object sekali
    let f;
    try { f = new File([blob], namaFile, { type: 'video/mp4' }); }
    catch (e) { f = null; }

    // LANGKAH 1 — Web Share
    let bisaShare = false;
    try {
      bisaShare = !!(f &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [f] }));
    } catch (e) { bisaShare = false; }
    if (bisaShare) {
      try {
        log('Membuka dialog simpan…');
        await navigator.share({ files: [f], title: namaFile });
        log('Berhasil dibagikan/disimpan.');
        return true;
      } catch (e) {
        if (e && e.name === 'AbortError') { log('Dibatalkan oleh pengguna.'); return false; }
        log('Share gagal: ' + (e && e.message) + ' — coba cara lain…');
      }
    }

    // LANGKAH 2 — File System Access (desktop Chrome/Edge)
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: namaFile,
          types: [{ description: 'Video MP4', accept: { 'video/mp4': ['.mp4'] } }]
        });
        const w = await handle.createWritable();
        await w.write(blob); await w.close();
        log('Tersimpan via File System Access.');
        return true;
      } catch (e) {
        if (e && e.name === 'AbortError') { log('Dibatalkan.'); return false; }
        log('File System Access gagal: ' + (e && e.message) + ' — fallback…');
      }
    }

    // LANGKAH 3 — Anchor download klasik
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = namaFile;
      document.body.appendChild(a); a.click(); a.remove();
      log('Perintah unduh dikirim ke browser.');
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      return true;
    } catch (e) {
      log('Anchor download gagal: ' + (e && e.message) + ' — fallback terakhir…');
    }

    // LANGKAH 4 — Tombol manual
    try {
      sembunyikanManual();
      manualUrl = URL.createObjectURL(blob);
      manualDownload.href = manualUrl;
      manualDownload.setAttribute('download', namaFile);
      openTab.href = manualUrl;
      manualLinks.style.display = 'flex';
    } catch (e) {
      log('Tidak dapat membuat tautan manual: ' + (e && e.message));
    }
    log('Unduh otomatis tidak tersedia. Gunakan tombol manual di bawah.');
    return false;
  }

  window.simpanFile = simpanFile;
})();
