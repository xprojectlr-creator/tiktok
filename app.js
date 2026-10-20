(function () {
  'use strict';

  const pickLabel = document.getElementById('pickLabel');
  const fileInput = document.getElementById('fileInput');
  const fileNameEl = document.getElementById('fileName');
  const fileSizeEl = document.getElementById('fileSize');
  const prosesBtn = document.getElementById('prosesBtn');
  const simpanBtn = document.getElementById('simpanBtn');
  const hasilWrap = document.getElementById('hasilWrap');
  const hasilInfo = document.getElementById('hasilInfo');
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
    window.__hasilBlob = null;
    window.__hasilNama = null;
    if (hasilWrap) hasilWrap.style.display = 'none';
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
    if (hasilWrap) hasilWrap.style.display = 'none';
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
      const namaHasil = namaDasar(fileDipilih.name) + '-patched.mp4';

      // simpan untuk dipakai tombol
      window.__hasilBlob = blobHasil;
      window.__hasilNama = namaHasil;

      if (hasilWrap && hasilInfo) {
        hasilInfo.textContent = namaHasil + ' (' + mb(blobHasil.size) + ')';
        hasilWrap.style.display = 'block';
      } else {
        log('ERROR: elemen #hasilWrap tidak ditemukan di HTML');
      }
    } catch (e) {
      log('Proses gagal: ' + (e && e.message ? e.message : e));
    } finally {
      prosesBtn.disabled = false;
    }
  });

  // Listener dipasang sekali saat script dimuat (script ada di akhir <body>, DOM sudah siap).
  if (simpanBtn) simpanBtn.addEventListener('click', async function () {
    if (!window.__hasilBlob) {
      log('Belum ada hasil. Proses video dulu.');
      return;
    }
    simpanBtn.disabled = true;
    try {
      await simpanFile(window.__hasilBlob, window.__hasilNama);
    } finally {
      simpanBtn.disabled = false;
    }
  });

  async function simpanFile(blob, namaFile) {
    log('Menyiapkan file ' + namaFile + ' (' +
        (blob.size / 1048576).toFixed(2) + ' MB)…');

    // === LANGKAH 1: Download langsung via anchor (PRIORITAS UTAMA) ===
    // Di Chrome Android modern, ini langsung menyimpan ke folder Downloads.
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = namaFile;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      log('Perintah unduh dikirim. Cek folder "Downloads" di perangkat Anda.');
      log('Jika file tidak muncul dalam 5 detik, gunakan tombol manual di bawah.');

      // Jangan revoke terlalu cepat — beri waktu browser menyelesaikan unduhan
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      // Tampilkan tombol manual sebagai jaring pengaman
      tampilkanTombolManual(blob, namaFile);
      return;
    } catch (e) {
      log('Unduh langsung gagal: ' + e.message + ' — mencoba cara lain…');
    }

    // === LANGKAH 2: Buka di tab baru (long-press → Simpan video) ===
    try {
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) {
        log('Video dibuka di tab baru. Tekan lama pada video, lalu pilih');
        log('"Download video" / "Simpan video" untuk menyimpan ke perangkat.');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
      }
    } catch (e) {
      log('Buka tab baru gagal: ' + e.message);
    }

    // === LANGKAH 3: Share sheet (fallback terakhir) ===
    let f = null;
    try { f = new File([blob], namaFile, { type: 'video/mp4' }); } catch {}
    if (f && typeof navigator.share === 'function'
          && typeof navigator.canShare === 'function'
          && navigator.canShare({ files: [f] })) {
      try {
        log('Membuka share sheet. Pilih "Drive" lalu "Simpan offline",');
        log('atau app Files jika tersedia.');
        await navigator.share({ files: [f], title: namaFile });
        log('Selesai dibagikan.');
        return;
      } catch (e) {
        if (e.name === 'AbortError') { log('Dibatalkan.'); return; }
        log('Share gagal: ' + e.message);
      }
    }

    log('Semua cara otomatis gagal. Gunakan tombol manual di bawah.');
    tampilkanTombolManual(blob, namaFile);
  }

  function tampilkanTombolManual(blob, namaFile) {
    // Hapus tombol manual lama jika ada
    const lama = document.getElementById('manualWrap');
    if (lama) lama.remove();

    const url = URL.createObjectURL(blob);
    const wrap = document.createElement('div');
    wrap.id = 'manualWrap';
    wrap.style.cssText = 'margin-top:16px;padding:12px;background:#fff3cd;' +
      'border:1px solid #ffe08a;border-radius:8px;';

    const p = document.createElement('p');
    p.style.cssText = 'margin:0 0 8px;font-size:14px;';
    p.textContent = 'Jika file belum tersimpan, gunakan tombol di bawah:';

    const a1 = document.createElement('a');
    a1.href = url;
    a1.download = namaFile;
    a1.textContent = '⬇️ Unduh ' + namaFile;
    a1.style.cssText = 'display:block;min-height:44px;line-height:44px;' +
      'text-align:center;background:#0d6efd;color:#fff;border-radius:8px;' +
      'text-decoration:none;font-weight:bold;margin-bottom:8px;';

    const a2 = document.createElement('a');
    a2.href = url;
    a2.target = '_blank';
    a2.rel = 'noopener';
    a2.textContent = '🔗 Buka di tab baru (tekan lama → Simpan video)';
    a2.style.cssText = 'display:block;min-height:44px;line-height:44px;' +
      'text-align:center;background:#6c757d;color:#fff;border-radius:8px;' +
      'text-decoration:none;font-size:13px;';

    wrap.appendChild(p);
    wrap.appendChild(a1);
    wrap.appendChild(a2);

    const logEl = document.getElementById('log');
    if (logEl && logEl.parentNode) {
      logEl.parentNode.insertBefore(wrap, logEl.nextSibling);
    } else {
      document.body.appendChild(wrap);
    }

    // Revoke jauh lebih lambat agar link manual tetap hidup untuk di-tap
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
  }

  window.simpanFile = simpanFile;
})();
