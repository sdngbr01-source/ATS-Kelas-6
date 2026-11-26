// ============================================================
// management-soal.js - REBUILD 2025 (MULTI-KELAS)
// Upload soal sekaligus ke beberapa kelas
// ============================================================

let soalCache = null;
let lastSoalFetch = 0;
const SOAL_CACHE_DURATION = 30000;

// ==================== HELPER ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== RENDER CHECKBOX KELAS (UPLOAD) ====================
async function renderUploadKelasCheckbox() {
    const container = document.getElementById('uploadKelasCheckboxList');
    if (!container) return;

    // Gunakan cache kelas jika tersedia
    let listKelas = [];
    if (typeof kelasCache !== 'undefined' && Array.isArray(kelasCache)) {
        listKelas = kelasCache;
    } else {
        try {
            const snap = await kelasRef
                .where('status', '==', 'aktif')
                .orderBy('tingkatan', 'asc')
                .orderBy('namaKelas', 'asc')
                .get();
            snap.forEach(doc => listKelas.push(doc.data()));
        } catch (err) {
            console.error('Gagal load kelas untuk checkbox:', err);
        }
    }

    if (listKelas.length === 0) {
        container.innerHTML = '<em>Tidak ada kelas aktif</em>';
        return;
    }

    container.innerHTML = listKelas.map(k => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 4px;cursor:pointer;border-bottom:1px solid #f1f5f9;">
            <input type="checkbox" class="upload-kelas-checkbox" value="${escapeHtml(k.namaKelas)}"
                   style="width:18px;height:18px;cursor:pointer;">
            <span>${escapeHtml(k.namaKelas)} — Kelas ${k.tingkatan} SD</span>
        </label>
    `).join('');
}

// ==================== LOAD SOAL ====================
async function loadSoal(forceRefresh = false) {
    const kelas = document.getElementById('filterKelasSoal')?.value;
    const mapel = document.getElementById('filterMapelSoal')?.value;
    const tbody = document.getElementById('soalTableBody');
    if (!tbody) return;

    const now = Date.now();
    const cacheKey = `soal_${kelas || 'all'}_${mapel || 'all'}`;

    if (!forceRefresh && soalCache && soalCache.key === cacheKey &&
        (now - lastSoalFetch) < SOAL_CACHE_DURATION) {
        renderSoalTable(soalCache.data, tbody);
        return;
    }

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading...</td></tr>';

    try {
        let query = questionsRef;
        if (kelas) query = query.where('kelas', '==', kelas);
        if (mapel) query = query.where('mataPelajaran', '==', mapel);

        const snapshot = await query.get();
        const soals = [];
        snapshot.forEach(doc => soals.push({ id: doc.id, ...doc.data() }));
        soals.sort((a, b) => (a.nomor || 0) - (b.nomor || 0));

        soalCache = { key: cacheKey, data: soals };
        lastSoalFetch = now;

        renderSoalTable(soals, tbody);
    } catch (error) {
        console.error('Error loading soal:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:red;">Error: ${error.message}</td></tr>`;
    }
}

// ==================== RENDER TABLE ====================
function renderSoalTable(soals, tbody) {
    if (!soals || soals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Tidak ada data soal</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    let no = 1;

    soals.forEach(soal => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = no++;
        row.insertCell(1).textContent = soal.kelas || '-';
        row.insertCell(2).textContent = soal.mataPelajaran || '-';
        row.insertCell(3).innerHTML = getTipeBadge(soal.tipe);

        let soalText = soal.soal || '-';
        if (soalText.length > 50) soalText = soalText.substring(0, 50) + '...';
        row.insertCell(4).innerHTML = `<div style="max-width:300px;white-space:normal;">${escapeHtml(soalText)}</div>`;

        let gambarHtml = '-';
        if (soal.gambar && soal.gambar !== '') {
            gambarHtml = `<a href="${soal.gambar}" target="_blank" style="color:#007bff;">🔍 Lihat</a>`;
        }
        row.insertCell(5).innerHTML = gambarHtml;

        row.insertCell(6).innerHTML = `
            <button onclick="deleteSoal('${soal.id}')"
                    style="background:#dc3545;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">
                🗑 Hapus
            </button>`;
    });
}

// ==================== BADGE ====================
function getTipeBadge(tipe) {
    const badges = {
        pg: '<span style="background:#007bff;color:white;padding:2px 8px;border-radius:12px;font-size:11px;">📝 Pilihan Ganda</span>',
        pgk: '<span style="background:#6f42c1;color:white;padding:2px 8px;border-radius:12px;font-size:11px;">☑️ PG Kompleks</span>',
        bs: '<span style="background:#20c997;color:white;padding:2px 8px;border-radius:12px;font-size:11px;">✓✗ Benar/Salah</span>'
    };
    return badges[tipe] || tipe || '-';
}

// ==================== DELETE ====================
async function deleteSoal(soalId) {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini?')) return;
    try {
        await questionsRef.doc(soalId).delete();
        showToast('✅ Soal berhasil dihapus', 'success');
        loadSoal(true);
    } catch (error) {
        console.error('Error deleting soal:', error);
        showToast('❌ Gagal menghapus soal', 'error');
    }
}
// ==================== DELETE SEMUA SOAL BERDASARKAN FILTER ====================
async function deleteSoalByFilter() {
    const kelas = document.getElementById('filterKelasSoal')?.value;
    const mapel = document.getElementById('filterMapelSoal')?.value;

    // Validasi: wajib pilih minimal kelas atau mapel
    if (!kelas && !mapel) {
        showToast('⚠️ Pilih minimal Kelas atau Mata Pelajaran terlebih dahulu!', 'error');
        return;
    }

    // Buat label konfirmasi yang jelas
    const labelKelas = kelas || 'SEMUA KELAS';
    const labelMapel = mapel || 'SEMUA MAPEL';

    // Konfirmasi pertama
    const pesan1 = `⚠️ PERINGATAN!\n\nAnda akan menghapus SELURUH soal dengan filter:\n• Kelas: ${labelKelas}\n• Mapel: ${labelMapel}\n\nApakah Anda yakin?`;
    if (!confirm(pesan1)) return;

    // Konfirmasi kedua (double confirm untuk keamanan)
    if (!confirm(`🔴 KONFIRMASI TERAKHIR\n\nTindakan ini TIDAK BISA DIBATALKAN.\n\nHapus semua soal ${labelMapel} untuk ${labelKelas}?`)) return;

    try {
        // Query sesuai filter
        let query = questionsRef;
        if (kelas) query = query.where('kelas', '==', kelas);
        if (mapel) query = query.where('mataPelajaran', '==', mapel);

        showToast('⏳ Memproses penghapusan...', 'info');

        const snapshot = await query.get();

        if (snapshot.empty) {
            showToast('ℹ️ Tidak ada soal yang cocok dengan filter', 'info');
            return;
        }

        const total = snapshot.size;

        // Firestore batch max 500 — pecah jika lebih
        const docs = [];
        snapshot.forEach(doc => docs.push(doc.ref));

        let deleted = 0;
        const BATCH_SIZE = 450; // aman di bawah limit 500

        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + BATCH_SIZE);
            chunk.forEach(ref => batch.delete(ref));
            await batch.commit();
            deleted += chunk.length;
        }

        // Reset cache supaya tabel refresh
        soalCache = null;
        lastSoalFetch = 0;

        showToast(`✅ Berhasil menghapus ${deleted} soal`, 'success');
        loadSoal(true);
    } catch (error) {
        console.error('Error deleting soal by filter:', error);
        showToast('❌ Gagal menghapus: ' + error.message, 'error');
    }
}

// expose
window.deleteSoalByFilter = deleteSoalByFilter;

// ==================== DOWNLOAD TEMPLATE ====================
function downloadTemplateSoal() {
    const templateData = [
        {
            Tipe: 'pg',
            Soal: 'Ibu kota Indonesia adalah...',
            Pilihan_A: 'Jakarta', Pilihan_B: 'Bandung',
            Pilihan_C: 'Surabaya', Pilihan_D: 'Medan', Pilihan_E: '',
            Kunci: 'A', Gambar: ''
        },
        {
            Tipe: 'pgk',
            Soal: 'Pilih semua bilangan prima (jawaban lebih dari 1)',
            Pilihan_A: '2', Pilihan_B: '3', Pilihan_C: '4',
            Pilihan_D: '5', Pilihan_E: '6',
            Kunci: 'A,B,D', Gambar: ''
        }
    ];

    const templateBS = [
        {
            Tipe: 'bs',
            Soal: 'Tentukan Benar atau Salah pernyataan berikut',
            Pernyataan_1: 'Matahari terbit dari timur', Kunci_1: 'B',
            Pernyataan_2: 'Bumi berbentuk datar', Kunci_2: 'S',
            Pernyataan_3: 'Air mendidih pada suhu 100°C', Kunci_3: 'B',
            Pernyataan_4: '', Kunci_4: '',
            Pernyataan_5: '', Kunci_5: '',
            Gambar: ''
        }
    ];

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(templateData);
    ws1['!cols'] = [{wch:8},{wch:50},{wch:20},{wch:20},{wch:20},{wch:20},{wch:20},{wch:15},{wch:30}];
    XLSX.utils.book_append_sheet(wb, ws1, 'PG & PGK');

    const ws2 = XLSX.utils.json_to_sheet(templateBS);
    ws2['!cols'] = [{wch:8},{wch:50},{wch:30},{wch:8},{wch:30},{wch:8},{wch:30},{wch:8},{wch:30},{wch:8},{wch:30},{wch:8},{wch:30}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Benar-Salah');

    XLSX.writeFile(wb, 'template_soal.xlsx');
    showToast('📥 Template soal berhasil diunduh', 'success');
}

// ==================== HANDLE UPLOAD (MULTI-KELAS) ====================
async function handleSoalUpload(inputElement) {
    let file = null;

    if (inputElement?.target) {
        file = inputElement.target.files[0];
        inputElement = inputElement.target;
    } else if (inputElement?.files) {
        file = inputElement.files[0];
    } else if (inputElement?.currentTarget) {
        file = inputElement.currentTarget.files[0];
        inputElement = inputElement.currentTarget;
    }

    if (!file) {
        showToast('Pilih file terlebih dahulu!', 'error');
        if (inputElement) inputElement.value = '';
        return;
    }

    // Ambil kelas terpilih dari checkbox
    const checkedBoxes = document.querySelectorAll('.upload-kelas-checkbox:checked');
    const selectedKelas = Array.from(checkedBoxes).map(cb => cb.value);
    const mapel = document.getElementById('uploadMapel')?.value;

    if (selectedKelas.length === 0) {
        showToast('Pilih minimal satu kelas!', 'error');
        if (inputElement) inputElement.value = '';
        return;
    }
    if (!mapel) {
        showToast('Pilih mata pelajaran dulu!', 'error');
        if (inputElement) inputElement.value = '';
        return;
    }

    const validExt = ['.xlsx', '.xls', '.csv'];
    if (!validExt.some(ext => file.name.toLowerCase().endsWith(ext))) {
        showToast('File harus Excel (.xlsx, .xls, .csv)', 'error');
        if (inputElement) inputElement.value = '';
        return;
    }

    showToast('📤 Memproses file...', 'info');

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Parse SEMUA sheet terlebih dahulu menjadi array soal
            const parsedSoals = [];

            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                for (const row of jsonData) {
                    if (!row.Tipe || !row.Soal) continue;

                    const tipe = String(row.Tipe).toLowerCase().trim();
                    let soalData = null;

                    if (tipe === 'pg') {
                        soalData = {
                            tipe,
                            soal: row.Soal,
                            gambar: row.Gambar || '',
                            pilihan: [
                                row.Pilihan_A || '', row.Pilihan_B || '',
                                row.Pilihan_C || '', row.Pilihan_D || ''
                            ],
                            kunci: (row.Kunci || '').toUpperCase().trim(),
                            gambarPilihan: {}
                        };
                        ['A','B','C','D'].forEach(ab => {
                            if (row[`Gambar_${ab}`]) soalData.gambarPilihan[ab] = row[`Gambar_${ab}`];
                        });
                    } else if (tipe === 'pgk') {
                        soalData = {
                            tipe,
                            soal: row.Soal,
                            gambar: row.Gambar || '',
                            pilihan: [
                                row.Pilihan_A || '', row.Pilihan_B || '',
                                row.Pilihan_C || '', row.Pilihan_D || '',
                                row.Pilihan_E || ''
                            ],
                            kunci: String(row.Kunci || '').split(',')
                                .map(k => k.toUpperCase().trim())
                                .filter(k => k !== ''),
                            gambarPilihan: {}
                        };
                        ['A','B','C','D','E'].forEach(ab => {
                            if (row[`Gambar_${ab}`]) soalData.gambarPilihan[ab] = row[`Gambar_${ab}`];
                        });
                    } else if (tipe === 'bs') {
                        const pernyataanBS = [];
                        let i = 1;
                        while (row[`Pernyataan_${i}`] && i <= 10) {
                            pernyataanBS.push({
                                text: row[`Pernyataan_${i}`],
                                kunci: (row[`Kunci_${i}`] || '').toUpperCase().trim()
                            });
                            i++;
                        }
                        if (pernyataanBS.length === 0) continue;
                        soalData = {
                            tipe,
                            soal: row.Soal,
                            gambar: row.Gambar || '',
                            pilihan: [],
                            kunci: '',
                            pernyataanBS
                        };
                    }

                    if (soalData) parsedSoals.push(soalData);
                }
            }

            if (parsedSoals.length === 0) {
                showToast('❌ Tidak ada soal valid di file Excel.', 'error');
                if (inputElement) inputElement.value = '';
                return;
            }

            // ========== SIMPAN KE SETIAP KELAS TERPILIH ==========
            const batch = db.batch();
            let totalSaved = 0;

            for (const kelas of selectedKelas) {
                // Cari nomor terakhir untuk kelas ini
                const existingQuery = await questionsRef
                    .where('kelas', '==', kelas)
                    .where('mataPelajaran', '==', mapel)
                    .get();

                let lastNomor = 0;
                existingQuery.forEach(doc => {
                    const d = doc.data();
                    if (d.nomor && d.nomor > lastNomor) lastNomor = d.nomor;
                });

                for (const soal of parsedSoals) {
                    lastNomor++;
                    const newRef = questionsRef.doc();
                    batch.set(newRef, {
                        ...soal,
                        kelas,
                        mataPelajaran: mapel,
                        examId: `${mapel}_${kelas}`.replace(/\s+/g, '_'),
                        nomor: lastNomor,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    totalSaved++;
                }
            }

            await batch.commit();

            const perKelas = parsedSoals.length;
            showToast(
                `✅ ${totalSaved} soal tersimpan (${perKelas} soal × ${selectedKelas.length} kelas)`,
                'success'
            );

            // Reset form
            document.querySelectorAll('.upload-kelas-checkbox').forEach(cb => cb.checked = false);
            if (inputElement) inputElement.value = '';

            closeUploadSoalModal();
            loadSoal(true);

        } catch (error) {
            console.error('Error processing file:', error);
            showToast('❌ ' + error.message, 'error');
            if (inputElement) inputElement.value = '';
        }
    };

    reader.onerror = function () {
        showToast('Gagal membaca file', 'error');
        if (inputElement) inputElement.value = '';
    };

    reader.readAsArrayBuffer(file);
}

// ==================== MODAL ====================
function showUploadSoalModal() {
    const modal = document.getElementById('uploadSoalModal');
    if (modal) modal.style.display = 'block';
    // Render checkbox tiap kali modal dibuka
    renderUploadKelasCheckbox();
}

function closeUploadSoalModal() {
    const modal = document.getElementById('uploadSoalModal');
    if (modal) modal.style.display = 'none';
}

// ==================== EVENT LISTENER ====================
document.addEventListener('DOMContentLoaded', function () {
    const filterKelas = document.getElementById('filterKelasSoal');
    const filterMapel = document.getElementById('filterMapelSoal');

    if (filterKelas) filterKelas.addEventListener('change', () => loadSoal(true));
    if (filterMapel) filterMapel.addEventListener('change', () => loadSoal(true));
});

// expose
window.renderUploadKelasCheckbox = renderUploadKelasCheckbox;
