// ============================================================
// management-soal.js - REBUILD 2025 (MULTI-KODE)
// Template & Upload Soal untuk 3 Tipe: PG, PGK, BS
// + Kolom KODE (ATS1/ASAS/ATS2/ASAT/ASAJ)
// ============================================================

let soalCache = null;
let lastSoalFetch = 0;
const SOAL_CACHE_DURATION = 30000;

// Mapping label kode
const KODE_LABELS = {
    'UH1': 'Ulangan Harian 1',
    'UH2': 'Ulangan Harian 2',
    'UH3': 'Ulangan Harian 3',
    'UH4': 'Ulangan Harian 4',
    'UH5': 'Ulangan Harian 5',
    'UH6': 'Ulangan Harian 6',
    'UH7': 'Ulangan Harian 7',
    'UH8': 'Ulangan Harian 8',
    'ATS1': 'ATS Ganjil',
    'ASAS': 'ASAS Semester 1',
    'ATS2': 'ATS Genap',
    'ASAT': 'ASAT Semester 2',
    'ASAJ': 'ASAT Akhir Jenjang'
};

// ==================== LOAD SOAL ====================
async function loadSoal(forceRefresh = false) {
    const kelas = document.getElementById('filterKelasSoal')?.value;
    const mapel = document.getElementById('filterMapelSoal')?.value;
    const kode = document.getElementById('filterKodeSoal')?.value;
    const tbody = document.getElementById('soalTableBody');
    
    if (!tbody) return;
    
    const now = Date.now();
    const cacheKey = `soal_${kelas || 'all'}_${mapel || 'all'}_${kode || 'all'}`;
    
    if (!forceRefresh && soalCache && soalCache.key === cacheKey && (now - lastSoalFetch) < SOAL_CACHE_DURATION) {
        renderSoalTable(soalCache.data, tbody);
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Loading...</td></tr>';
    
    try {
        let query = questionsRef;
        if (kelas) query = query.where('kelas', '==', kelas);
        if (mapel) query = query.where('mataPelajaran', '==', mapel);
        // ⚠️ JANGAN filter by kode di Firestore (karena data lama tidak punya field kode)
        
        const snapshot = await query.get();
        const soals = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // ✅ DEFAULT KODE = "ATS1" kalau kosong
            if (!data.kode) {
                data.kode = 'ATS1';
            }
            soals.push({ id: doc.id, ...data });
        });
        
        // ✅ Filter kode di JavaScript (bukan Firestore)
        let filtered = soals;
        if (kode) {
            filtered = soals.filter(s => s.kode === kode);
        }
        
        filtered.sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
        
        soalCache = { key: cacheKey, data: filtered };
        lastSoalFetch = now;
        
        renderSoalTable(filtered, tbody);
        
    } catch (error) {
        console.error('Error loading soal:', error);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
    }
}

// ==================== RENDER TABLE ====================
function renderSoalTable(soals, tbody) {
    if (!soals || soals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Tidak ada data soal</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    let no = 1;
    
    soals.forEach(soal => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = no++;
        
        // Kolom KODE (baru)
        const kode = soal.kode || '-';
        row.insertCell(1).innerHTML = `<span style="background:#1e40af;color:white;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">${kode}</span>`;
        
        row.insertCell(2).textContent = soal.kelas || '-';
        row.insertCell(3).textContent = soal.mataPelajaran || '-';
        row.insertCell(4).innerHTML = getTipeBadge(soal.tipe);
        
        let soalText = soal.soal || '-';
        if (soalText.length > 50) soalText = soalText.substring(0, 50) + '...';
        row.insertCell(5).innerHTML = `<div style="max-width: 300px; white-space: normal;">${escapeHtml(soalText)}</div>`;
        
        let gambarHtml = '-';
        if (soal.gambar && soal.gambar !== '') {
            gambarHtml = `<a href="${soal.gambar}" target="_blank" style="color: #007bff;">🔍 Lihat</a>`;
        }
        row.insertCell(6).innerHTML = gambarHtml;
        
        row.insertCell(7).innerHTML = `
            <button onclick="deleteSoal('${soal.id}')" 
                    style="background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
                🗑 Hapus
            </button>
        `;
    });
}

function getTipeBadge(tipe) {
    const badges = {
        pg: '<span style="background:#007bff; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">📝 Pilihan Ganda</span>',
        pgk: '<span style="background:#6f42c1; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">☑️ PG Kompleks</span>',
        bs: '<span style="background:#20c997; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">✓✗ Benar/Salah</span>'
    };
    return badges[tipe] || tipe || '-';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// ==================== DOWNLOAD TEMPLATE ====================
function downloadTemplateSoal() {
    // Sheet 1: Template PG & PGK
    const templateData = [
// Tambahkan contoh UH di templateData:
{
    Kode: 'UH1',
    Tipe: 'pg',
    Soal: 'Contoh soal Ulangan Harian 1...',
    Pilihan_A: 'Jawaban A',
    Pilihan_B: 'Jawaban B',
    Pilihan_C: 'Jawaban C',
    Pilihan_D: 'Jawaban D',
    Pilihan_E: '',
    Kunci: 'A',
    Gambar: ''
}
        {
            Kode: 'ATS1',
            Tipe: 'pg',
            Soal: 'Ibu kota Indonesia adalah...',
            Pilihan_A: 'Jakarta',
            Pilihan_B: 'Bandung',
            Pilihan_C: 'Surabaya',
            Pilihan_D: 'Medan',
            Pilihan_E: '',
            Kunci: 'A',
            Gambar: ''
        },
        {
            Kode: 'ATS1',
            Tipe: 'pgk',
            Soal: 'Pilih semua bilangan prima (jawaban lebih dari 1)',
            Pilihan_A: '2',
            Pilihan_B: '3',
            Pilihan_C: '4',
            Pilihan_D: '5',
            Pilihan_E: '6',
            Kunci: 'A,B,D',
            Gambar: ''
        },
        {
            Kode: 'ASAS',
            Tipe: 'pg',
            Soal: '5 + 3 = ...',
            Pilihan_A: '6',
            Pilihan_B: '7',
            Pilihan_C: '8',
            Pilihan_D: '9',
            Pilihan_E: '',
            Kunci: 'C',
            Gambar: ''
        }
    ];
    
    // Sheet 2: Template Benar/Salah
    const templateBS = [
        {
            Kode: 'ATS1',
            Tipe: 'bs',
            Soal: 'Tentukan Benar atau Salah pernyataan berikut',
            Pernyataan_1: 'Matahari terbit dari timur',
            Kunci_1: 'B',
            Pernyataan_2: 'Bumi berbentuk datar',
            Kunci_2: 'S',
            Pernyataan_3: 'Air mendidih pada suhu 100°C',
            Kunci_3: 'B',
            Pernyataan_4: '',
            Kunci_4: '',
            Pernyataan_5: '',
            Kunci_5: '',
            Gambar: ''
        }
    ];
    
    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(templateData);
    ws1['!cols'] = [
        {wch:8}, {wch:8}, {wch:50}, {wch:20}, {wch:20}, 
        {wch:20}, {wch:20}, {wch:20}, {wch:15}, {wch:30}
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'PG & PGK');
    
    const ws2 = XLSX.utils.json_to_sheet(templateBS);
    ws2['!cols'] = [
        {wch:8}, {wch:8}, {wch:50}, {wch:30}, {wch:8},
        {wch:30}, {wch:8}, {wch:30}, {wch:8},
        {wch:30}, {wch:8}, {wch:30}, {wch:8}, {wch:30}
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Benar-Salah');
    
    XLSX.writeFile(wb, 'template_soal.xlsx');
    showToast('📥 Template soal berhasil diunduh', 'success');
}

// ==================== HANDLE UPLOAD ====================
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
    
    const kelas = document.getElementById('uploadKelas')?.value;
    const mapel = document.getElementById('uploadMapel')?.value;
    
    if (!kelas || !mapel) {
        showToast('Pilih kelas dan mata pelajaran dulu!', 'error');
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
    
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Cari nomor terakhir per kode + kelas + mapel
            const existingQuery = await questionsRef
                .where('kelas', '==', kelas)
                .where('mataPelajaran', '==', mapel)
                .get();
            
            const lastNomorPerKode = {};
            existingQuery.forEach(doc => {
                const d = doc.data();
                const k = d.kode || 'ATS1';
                if (!lastNomorPerKode[k]) lastNomorPerKode[k] = 0;
                if (d.nomor && d.nomor > lastNomorPerKode[k]) lastNomorPerKode[k] = d.nomor;
            });
            
            let success = 0, failed = 0;
            let errorDetails = [];
            
            // Proses SEMUA sheet
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                
                for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
                    const row = jsonData[rowIndex];
                    
                    // Validasi kolom wajib
                    if (!row.Kode || !row.Tipe || !row.Soal) {
                        failed++;
                        errorDetails.push(`Baris ${rowIndex + 2}: Kode/Tipe/Soal kosong`);
                        continue;
                    }
                    
                    const kode = String(row.Kode).toUpperCase().trim();
                    if (!['UH1','UH2','UH3','UH4','UH5','UH6','UH7','UH8','ATS1','ASAS','ATS2','ASAT','ASAJ'].includes(kode)) {
                        failed++;
                        errorDetails.push(`Baris ${rowIndex + 2}: Kode "${kode}" tidak valid`);
                        continue;
                    }
                    
                    try {
                        if (!lastNomorPerKode[kode]) lastNomorPerKode[kode] = 0;
                        lastNomorPerKode[kode]++;
                        
                        const tipe = String(row.Tipe).toLowerCase().trim();
                        
                        let soalData = {
                            kode: kode,
                            kelas: kelas,
                            mataPelajaran: mapel,
                            tipe: tipe,
                            soal: row.Soal,
                            gambar: row.Gambar || '',
                            nomor: lastNomorPerKode[kode],
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        
                        // ==================== PG ====================
                        if (tipe === 'pg') {
                            soalData.pilihan = [
                                row.Pilihan_A || '',
                                row.Pilihan_B || '',
                                row.Pilihan_C || '',
                                row.Pilihan_D || ''
                            ];
                            soalData.kunci = (row.Kunci || '').toUpperCase().trim();
                            soalData.gambarPilihan = {};
                            if (row.Gambar_A) soalData.gambarPilihan.A = row.Gambar_A;
                            if (row.Gambar_B) soalData.gambarPilihan.B = row.Gambar_B;
                            if (row.Gambar_C) soalData.gambarPilihan.C = row.Gambar_C;
                            if (row.Gambar_D) soalData.gambarPilihan.D = row.Gambar_D;
                        }
                        // ==================== PGK ====================
                        else if (tipe === 'pgk') {
                            soalData.pilihan = [
                                row.Pilihan_A || '',
                                row.Pilihan_B || '',
                                row.Pilihan_C || '',
                                row.Pilihan_D || '',
                                row.Pilihan_E || ''
                            ];
                            const kunciStr = String(row.Kunci || '');
                            soalData.kunci = kunciStr.split(',')
                                .map(k => k.toUpperCase().trim())
                                .filter(k => k !== '');
                            soalData.gambarPilihan = {};
                            if (row.Gambar_A) soalData.gambarPilihan.A = row.Gambar_A;
                            if (row.Gambar_B) soalData.gambarPilihan.B = row.Gambar_B;
                            if (row.Gambar_C) soalData.gambarPilihan.C = row.Gambar_C;
                            if (row.Gambar_D) soalData.gambarPilihan.D = row.Gambar_D;
                            if (row.Gambar_E) soalData.gambarPilihan.E = row.Gambar_E;
                        }
                        // ==================== BS ====================
                        else if (tipe === 'bs') {
                            soalData.pilihan = [];
                            soalData.kunci = '';
                            soalData.pernyataanBS = [];
                            
                            let i = 1;
                            while (row[`Pernyataan_${i}`]) {
                                soalData.pernyataanBS.push({
                                    text: row[`Pernyataan_${i}`],
                                    kunci: (row[`Kunci_${i}`] || '').toUpperCase().trim()
                                });
                                i++;
                                if (i > 10) break;
                            }
                            
                            if (soalData.pernyataanBS.length === 0) {
                                failed++;
                                errorDetails.push(`Baris ${rowIndex + 2}: BS tanpa pernyataan`);
                                continue;
                            }
                        }
                        else {
                            failed++;
                            errorDetails.push(`Baris ${rowIndex + 2}: Tipe "${tipe}" tidak dikenal`);
                            continue;
                        }
                        
                        await questionsRef.add(soalData);
                        success++;
                        
                    } catch (err) {
                        console.error('Error adding soal:', err);
                        failed++;
                        errorDetails.push(`Baris ${rowIndex + 2}: ${err.message}`);
                    }
                }
            }
            
            let message = `✅ ${success} soal ditambahkan`;
            if (failed > 0) message += `, ${failed} gagal`;
            
            showToast(message, success > 0 ? 'success' : 'error');
            
            if (errorDetails.length > 0) {
                console.warn('Detail error:', errorDetails);
                if (errorDetails.length <= 5) {
                    setTimeout(() => alert('Detail error:\n' + errorDetails.join('\n')), 500);
                }
            }
            
            closeUploadSoalModal();
            loadSoal(true);
            
        } catch (error) {
            console.error('Error processing file:', error);
            showToast('❌ ' + error.message, 'error');
        }
        
        if (inputElement) inputElement.value = '';
    };
    
    reader.onerror = function() {
        showToast('Gagal membaca file', 'error');
        if (inputElement) inputElement.value = '';
    };
    
    reader.readAsArrayBuffer(file);
}

// ==================== MODAL ====================
function showUploadSoalModal() {
    const modal = document.getElementById('uploadSoalModal');
    if (modal) modal.style.display = 'block';
}

function closeUploadSoalModal() {
    const modal = document.getElementById('uploadSoalModal');
    if (modal) modal.style.display = 'none';
}

// ==================== EVENT LISTENER ====================
document.addEventListener('DOMContentLoaded', function() {
    const filterKelas = document.getElementById('filterKelasSoal');
    const filterMapel = document.getElementById('filterMapelSoal');
    const filterKode = document.getElementById('filterKodeSoal');
    
    if (filterKelas) filterKelas.addEventListener('change', () => loadSoal(true));
    if (filterMapel) filterMapel.addEventListener('change', () => loadSoal(true));
    if (filterKode) filterKode.addEventListener('change', () => loadSoal(true));
});
