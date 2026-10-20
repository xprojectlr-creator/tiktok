// app.js — TikTok Preserver (versi final)
// Memanggil window.patchMp4 dari mp4-patch.js, lalu menyediakan unduhan.
(function () {
  'use strict';

  // ---------- Log helper ----------
  function makeLog() {
    var el = document.getElementById('log');
    if (!el) {
      el = document.createElement('textarea');
      el.id = 'log';
      el.readOnly = true;
      el.style.cssText = 'width:100%;min-height:100px;font-family:monospace;' +
        'font-size:12px;padding:8px;box-sizing:border-box;margin-top:12px;' +
        'border:1px solid #ccc;border-radius:6px;';
      document.body.appendChild(el);
    }
    return el;
  }

  function log(msg) {
    var el = makeLog();
    var t = new Date();
    var hh = String(t.getHours()).padStart(2, '0');
    var mm = String(t.getMinutes()).padStart(2, '0');
    var ss = String(t.getSeconds()).padStart(2, '0');
    el.value += '[' + hh + '.' + mm + '.' + ss + '] ' + msg + '\n';
    el.scrollTop = el.scrollHeight;
    console.log('[TikTokPreserver]', msg);
  }

  // ---------- Bootstrap UI ----------
  function setup() {
    var body = document.body;

    // Input file
    var fileInput = document.getElementById('fileInput');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'fileInput';
      fileInput.accept = 'video/*';
      fileInput.style.display = 'none';
      body.appendChild(fileInput);
    } else {
      fileInput.setAttribute('accept', 'video/*');
      fileInput.style.display = 'none';
    }

    // Label / tap zone
    var pickLabel = document.getElementById('pickLabel');
    if (!pickLabel) {
      pickLabel = document.createElement('label');
      pickLabel.id = 'pickLabel';
      pickLabel.htmlFor = 'fileInput';
      pickLabel.textContent = 'Tap untuk pilih video, atau drag ke sini';
      pickLabel.style.cssText = 'display:flex;align-items:center;justify-content:center;' +
        'min-height:120px;cursor:pointer;border:2px dashed #888;border-radius:8px;' +
        'padding:16px;text-align:center;margin:16px 0;font-size:15px;box-sizing:border-box;';
      fileInput.parentNode.insertBefore(pickLabel, fileInput);
    } else {
      pickLabel.htmlFor = 'fileInput';
      pickLabel.style.cursor = 'pointer';
    }

    // Nama file
    var fileNameEl = document.getElementById('fileName');
    if (!fileNameEl) {
      fileNameEl = document.createElement('p');
      fileNameEl.id = 'fileName';
      fileNameEl.style.cssText = 'font-size:14px;margin:8px 0;';
      pickLabel.parentNode.insertBefore(fileNameEl, pickLabel.nextSibling);
    }

    // Tombol proses
    var prosesBtn = document.getElementById('prosesBtn');
    if (!prosesBtn) {
      prosesBtn = document.createElement('button');
      prosesBtn.id = 'prosesBtn';
      prosesBtn.textContent = 'Proses Sekarang';
      prosesBtn.style.cssText = 'min-height:48px;padding:12px 20px;font-size:16px;' +
        'background:#0d6efd;color:#fff;border:0;border-radius:8px;cursor:pointer;' +
        'width:100%;margin-top:8px;';
      fileNameEl.parentNode.insertBefore(prosesBtn, fileNameEl.nextSibling);
    }
    prosesBtn.disabled = true;
    prosesBtn.style.opacity = '0.5';

    // Log
    makeLog();

    // Area hasil
    var hasilWrap = document.getElementById('hasilWrap');
    if (!hasilWrap) {
      hasilWrap = document.createElement('div');
      hasilWrap.id = 'hasilWrap';
      hasilWrap.style.cssText = 'display:none;margin-top:16px;';

      var info = document.createElement('p');
      info.innerHTML = '<strong>Hasil:</strong> <span id="hasilInfo"></span>';

      var simpanBtn = document.createElement('button');
      simpanBtn.id = 'simpanBtn';
      simpanBtn.textContent = 'Simpan / Bagikan Video';
      simpanBtn.style.cssText = 'min-height:48px;padding:12px 20px;font-size:16px;' +
        'background:#fe2c55;color:#fff;border:0;border-radius:8px;cursor:pointer;' +
        'width:100%;margin-top:8px;';

      var hint = document.createElement('p');
      hint.style.cssText = 'font-size:12px;color:#666;margin-top:8px;';
      hint.textContent = 'Di Android, tombol ini akan langsung mengunduh atau membuka share sheet.';

      hasilWrap.appendChild(info);
      hasilWrap.appendChild(simpanBtn);
      hasilWrap.appendChild(hint);

      var logEl = document.getElementById('log');
      logEl.parentNode.insertBefore(hasilWrap, logEl.nextSibling);
    }

    // ---------- State ----------
    var currentFile = null;
    var hasilBlob = null;
    var hasilNama = null;

    // ---------- Helper set file ----------
    function setFile(f) {
      if (!f) return;
      currentFile = f;
      var mb = (f.size / 1048576).toFixed(2);
      fileNameEl.textContent = 'File dipilih: ' + f.name + ' (' + mb + ' MB)';
      log('File dipilih: ' + f.name + ' (' + mb + ' MB)');
      prosesBtn.disabled = false;
      prosesBtn.style.opacity = '1';
    }

    // ---------- Events input ----------
    fileInput.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) setFile(f);
    });

    pickLabel.addEventListener('dragover', function (e) {
      e.preventDefault();
      pickLabel.style.borderColor = '#0d6efd';
    });
    pickLabel.addEventListener('dragleave', function (e) {
      e.preventDefault();
      pickLabel.style.borderColor = '#888';
    });
    pickLabel.addEventListener('drop', function (e) {
      e.preventDefault();
      pickLabel.style.borderColor = '#888';
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) setFile(f);
    });

    // ---------- Proses ----------
    prosesBtn.addEventListener('click', async function () {
      if (!currentFile) {
        log('ERROR: belum ada file dipilih.');
        return;
      }

      prosesBtn.disabled = true;
      prosesBtn.textContent = 'Memproses…';
      hasilWrap.style.display = 'none';
      var lama = document.getElementById('manualWrap');
      if (lama) lama.remove();
      hasilBlob = null;

      try {
        log('Membaca file…');
        var arrayBuffer = await currentFile.arrayBuffer();

        if (typeof window.patchMp4 !== 'function') {
          log('ERROR: window.patchMp4 tidak ada. Pastikan mp4-patch.js di-load di index.html SEBELUM app.js.');
          return;
        }

        log('Memanggil patchMp4…');
        var hasil = await window.patchMp4(arrayBuffer);
        hasilBlob = hasil.blob;

        if (hasil.patched) {
          log('Patch berhasil. ' + hasil.originalSize + ' → ' + hasil.newSize +
              ' bytes (+' + hasil.paddedBytes + ' padding)');
        } else {
          log('PERINGATAN: patch gagal — ' + hasil.reason);
        }

        log('Selesai. Ukuran hasil: ' + (hasilBlob.size / 1048576).toFixed(2) + ' MB');

        var baseName = currentFile.name.replace(/\.[^.]+$/, '');
        hasilNama = baseName + '-patched.mp4';

        var infoEl = document.getElementById('hasilInfo');
        if (infoEl) {
          infoEl.textContent = hasilNama + ' (' + (hasilBlob.size / 1048576).toFixed(2) + ' MB)';
        }
        hasilWrap.style.display = 'block';

      } catch (e) {
        log('ERROR: ' + e.message);
      } finally {
        prosesBtn.disabled = false;
        prosesBtn.textContent = 'Proses Sekarang';
      }
    });

    // ---------- Simpan ----------
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'simpanBtn') {
        if (!hasilBlob) {
          log('Belum ada hasil. Proses video dulu.');
          return;
        }
        simpanFile(hasilBlob, hasilNama);
      }
    });

    async function simpanFile(blob, namaFile) {
      log('Menyiapkan file ' + namaFile + ' (' + (blob.size / 1048576).toFixed(2) + ' MB)…');

      // 1) Download langsung
      try {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = namaFile;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        log('Perintah unduh dikirim. Cek folder Downloads di perangkat.');
        log('Jika tidak muncul dalam 5 detik, gunakan tombol manual di bawah.');
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        tampilkanTombolManual(blob, namaFile);
        return;
      } catch (e) {
        log('Unduh langsung gagal: ' + e.message);
      }

      // 2) Share sheet
      var f = null;
      try { f = new File([blob], namaFile, { type: 'video/mp4' }); } catch (_) {}
      if (f && typeof navigator.share === 'function' &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [f] })) {
        try {
          log('Membuka share sheet…');
          await navigator.share({ files: [f], title: namaFile });
          log('Berhasil dibagikan/disimpan.');
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
      var lama = document.getElementById('manualWrap');
      if (lama) lama.remove();

      var url = URL.createObjectURL(blob);
      var wrap = document.createElement('div');
      wrap.id = 'manualWrap';
      wrap.style.cssText = 'margin-top:16px;padding:12px;background:#fff3cd;' +
        'border:1px solid #ffe08a;border-radius:8px;';

      var p = document.createElement('p');
      p.style.cssText = 'margin:0 0 8px;font-size:14px;';
      p.textContent = 'Jika file belum tersimpan, gunakan tombol di bawah:';

      var a1 = document.createElement('a');
      a1.href = url;
      a1.download = namaFile;
      a1.textContent = '⬇️ Unduh ' + namaFile;
      a1.style.cssText = 'display:block;min-height:44px;line-height:44px;' +
        'text-align:center;background:#0d6efd;color:#fff;border-radius:8px;' +
        'text-decoration:none;font-weight:bold;margin-bottom:8px;';

      var a2 = document.createElement('a');
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

      var logEl = document.getElementById('log');
      logEl.parentNode.insertBefore(wrap, logEl.nextSibling);

      setTimeout(function () { URL.revokeObjectURL(url); }, 10 * 60 * 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
