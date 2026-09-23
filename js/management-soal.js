// ============================================================
// management-soal.js - REBUILD 2025
// Template & Upload Soal untuk 3 Tipe: PG, PGK, BS
// ============================================================

let soalCache = null;
let lastSoalFetch = 0;
const SOAL_CACHE_DURATION = 30000;

// ==================== LOAD SOAL ====================
async function loadSoal(forceRefresh = false) {
    const kelas = document.getElementById('filterKelasSoal')?.value;
    const mapel = document.getElementById('filterMapelSoal')?.value;
    const tbody = document.getElementById('soalTableBody');
    
    if (!tbody) return;
    
    const now = Date.now();
    const cacheKey = `soal_${kelas || 'all'}_${mapel || 'all'}`;
    
    if (!forceRefresh && soalCache && soalCache.key === cacheKey && (now - lastSoalFetch) < SOAL_CACHE_DURATION) {
        renderSoalTable(soalCache.data, tbody);
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading...</td></tr>';
    
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
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
    }
}

// ==================== RENDER TABLE ====================
function renderSoalTable(soals, tbody) {
    if (!soals || soals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Tidak ada data soal</td></tr>';
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
        row.insertCell(4).innerHTML = `<div style="max-width: 300px; white-space: normal;">${escapeHtml(soalText)}</div>`;
        
        let gambarHtml = '-';
        if (soal.gambar && soal.gambar !== '') {
            gambarHtml = `<a href="${soal.gambar}" target="_blank" style="color: #007bff;">🔍 Lihat</a>`;
        }
        row.insertCell(5).innerHTML = gambarHtml;
        
        row.insertCell(6).innerHTML = `
            <button onclick="deleteSoal('${soal.id}')" 
                    style="background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
                🗑 Hapus
            </button>
        `;
    });
}

// ==================== BADGE TIPE ====================
function getTipeBadge(tipe) {
    const badges = {
        pg: '<span style="background:#007bff; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">📝 Pilihan Ganda</span>',
        pgk: '<span style="background:#6f42c1; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">☑️ PG Kompleks</span>',
        bs: '<span style="background:#20c997; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">✓✗ Benar/Salah</span>'
    };
    return badges[tipe] || tipe || '-';
}

// ==================== HELPER ====================
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
        {
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
            Tipe: 'pgk',
            Soal: 'Pilih semua bilangan prima (jawaban lebih dari 1)',
            Pilihan_A: '2',
            Pilihan_B: '3',
            Pilihan_C: '4',
            Pilihan_D: '5',
            Pilihan_E: '6',
            Kunci: 'A,B,D',
            Gambar: ''
        }
    ];
    
    // Sheet 2: Template Benar/Salah
    const templateBS = [
        {
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
        {wch:8}, {wch:50}, {wch:20}, {wch:20}, 
        {wch:20}, {wch:20}, {wch:20}, {wch:15}, {wch:30}
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'PG & PGK');
    
    const ws2 = XLSX.utils.json_to_sheet(templateBS);
    ws2['!cols'] = [
        {wch:8}, {wch:50}, {wch:30}, {wch:8},
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
    
    if (!(file instanceof File) && !(file instanceof Blob)) {
        showToast('File tidak valid!', 'error');
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
            
            // Cari nomor terakhir
            const existingQuery = await questionsRef
                .where('kelas', '==', kelas)
                .where('mataPelajaran', '==', mapel)
                .get();
            
            let lastNomor = 0;
            existingQuery.forEach(doc => {
                const d = doc.data();
                if (d.nomor && d.nomor > lastNomor) lastNomor = d.nomor;
            });
            
            let success = 0, failed = 0;
            
            // Proses SEMUA sheet
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                
                for (const row of jsonData) {
                    if (!row.Tipe || !row.Soal) {
                        failed++;
                        continue;
                    }
                    
                    try {
                        lastNomor++;
                        const tipe = row.Tipe.toLowerCase().trim();
                        
                        let soalData = {
                            kelas: kelas,
                            mataPelajaran: mapel,
                            tipe: tipe,
                            soal: row.Soal,
                            gambar: row.Gambar || '',
                            nomor: lastNomor,
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
                            // Kunci: "A,B,D" → ["A", "B", "D"]
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
                            
                            // Format: Pernyataan_1, Kunci_1, Pernyataan_2, Kunci_2, ...
                            let i = 1;
                            while (row[`Pernyataan_${i}`]) {
                                soalData.pernyataanBS.push({
                                    text: row[`Pernyataan_${i}`],
                                    kunci: (row[`Kunci_${i}`] || '').toUpperCase().trim()
                                });
                                i++;
                                if (i > 10) break; // max 10 pernyataan
                            }
                            
                            if (soalData.pernyataanBS.length === 0) {
                                failed++;
                                continue;
                            }
                        }
                        // Tipe tidak dikenal
                        else {
                            failed++;
                            continue;
                        }
                        
                        await questionsRef.add(soalData);
                        success++;
                        
                    } catch (err) {
                        console.error('Error adding soal:', err);
                        failed++;
                    }
                }
            }
            
            showToast(`✅ ${success} soal ditambahkan${failed > 0 ? `, ${failed} gagal` : ''}`, 'success');
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
    
    if (filterKelas) filterKelas.addEventListener('change', () => loadSoal(true));
    if (filterMapel) filterMapel.addEventListener('change', () => loadSoal(true));
});