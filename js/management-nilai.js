// management-nilai.js
// Manajemen nilai - Auto koreksi PG, PGK, BS

// ==================== KONFIGURASI ====================
const POIN_PER_SOAL = 5; // Nilai maksimal per soal untuk semua tipe

// ==================== FUNGSI UTAMA: LOAD NILAI ====================
async function loadNilai() {
    const kelas = document.getElementById('filterKelasNilai')?.value;
    const mapel = document.getElementById('filterMapelNilai')?.value;
    const search = document.getElementById('searchSiswa')?.value.toLowerCase() || '';
    const tbody = document.getElementById('nilaiTableBody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Loading...</td></tr>';
    
    try {
        if (typeof answersRef === 'undefined') {
            console.error('answersRef tidak terdefinisi');
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error: answersRef tidak terdefinisi</td></tr>';
            return;
        }
        
        let query = answersRef;
        if (kelas) query = query.where('kelas', '==', kelas);
        if (mapel) query = query.where('mataPelajaran', '==', mapel);
        
        const snapshot = await query.orderBy('waktu', 'desc').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center">Tidak ada data</td></tr>';
            return;
        }
        
        // Gabungkan berdasarkan siswaId + mapel (ambil yang terbaru)
        const nilaiMap = new Map();
        snapshot.forEach(doc => {
            const nilai = doc.data();
            const key = nilai.siswaId + '_' + nilai.mataPelajaran;
            const waktuBaru = nilai.waktu?.toDate?.() || new Date(0);
            const waktuLama = nilaiMap.get(key)?.waktu?.toDate?.() || new Date(0);
            
            if (!nilaiMap.has(key) || waktuBaru > waktuLama) {
                nilaiMap.set(key, { id: doc.id, ...nilai });
            }
        });
        
        const filteredData = Array.from(nilaiMap.values()).filter(nilai => {
            if (search) return (nilai.siswaNama || '').toLowerCase().includes(search);
            return true;
        });
        
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center">Tidak ada data sesuai filter</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        let no = 1;
        
        for (const nilai of filteredData) {
            // ========== AMBIL NILAI DARI FIRESTORE ==========
            const nilaiPG = nilai.nilaiPG || 0;
            const nilaiPGK = nilai.nilaiPGK || 0;
            const nilaiBS = nilai.nilaiBS || 0;
            
            const totalPG = nilai.totalPG || 0;
            const totalPGK = nilai.totalPGK || 0;
            const totalBS = nilai.totalBS || 0;
            
            const nilaiAkhir = nilai.nilaiAkhir || 0;
            
            const statusText = nilai.statusKoreksi === 'pending' ? 'Menunggu' : 'Selesai';
            const statusClass = nilai.statusKoreksi === 'pending' ? 'status-pending' : 'status-selesai';
            
            const row = tbody.insertRow();
            row.insertCell(0).textContent = no++;
            row.insertCell(1).textContent = nilai.siswaNama || '-';
            row.insertCell(2).textContent = nilai.kelas || '-';
            row.insertCell(3).textContent = nilai.mataPelajaran || '-';
            row.insertCell(4).textContent = totalPG > 0 ? `${nilaiPG} / ${totalPG}` : '-';
            row.insertCell(5).textContent = totalPGK > 0 ? `${nilaiPGK} / ${totalPGK}` : '-';
            row.insertCell(6).textContent = totalBS > 0 ? `${nilaiBS} / ${totalBS}` : '-';
            row.insertCell(7).innerHTML = `<strong>${nilaiAkhir}</strong>`;
            row.insertCell(8).innerHTML = `<span class="exam-status ${statusClass}">${statusText}</span>`;
        }
        
    } catch (error) {
        console.error('Error loading nilai:', error);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
    }
}

// ==================== FUNGSI AUTO KOREKSI (DIPANGGIL SAAT SUBMIT UJIAN) ====================
/**
 * Fungsi untuk mengoreksi jawaban siswa secara otomatis
 * @param {Object} jawabanSiswa - { pg: {qId: 'A'}, pgk: {qId: 'A,C'}, bs: {qId: 'B,S,B'} }
 * @param {Object} kunciJawaban - { pg: {qId: 'A'}, pgk: {qId: 'A,C'}, bs: {qId: 'B,S,B'} }
 * @returns {Object} - { nilaiPG, nilaiPGK, nilaiBS, totalPG, totalPGK, totalBS, nilaiAkhir, detail }
 */
function autoKoreksi(jawabanSiswa, kunciJawaban) {
    const detail = { pg: {}, pgk: {}, bs: {} };
    
    // ========== KOREKSI PG ==========
    let nilaiPG = 0;
    let totalPG = 0;
    
    for (const [qId, jawaban] of Object.entries(jawabanSiswa.pg || {})) {
        totalPG += POIN_PER_SOAL;
        const kunci = kunciJawaban.pg?.[qId] || '';
        const benar = (String(jawaban).trim().toUpperCase() === String(kunci).trim().toUpperCase());
        const nilai = benar ? POIN_PER_SOAL : 0;
        nilaiPG += nilai;
        
        detail.pg[qId] = {
            jawaban: jawaban,
            kunci: kunci,
            benar: benar,
            nilai: nilai,
            nilaiMaksimal: POIN_PER_SOAL
        };
    }
    
    // ========== KOREKSI PGK ==========
    let nilaiPGK = 0;
    let totalPGK = 0;
    
    for (const [qId, jawaban] of Object.entries(jawabanSiswa.pgk || {})) {
        totalPGK += POIN_PER_SOAL;
        const kunci = kunciJawaban.pgk?.[qId] || '';
        const nilai = hitungNilaiPGK(jawaban, kunci);
        nilaiPGK += nilai;
        
        detail.pgk[qId] = {
            jawaban: jawaban,
            kunci: kunci,
            nilai: nilai,
            nilaiMaksimal: POIN_PER_SOAL
        };
    }
    
    // ========== KOREKSI BS ==========
    let nilaiBS = 0;
    let totalBS = 0;
    
    for (const [qId, jawaban] of Object.entries(jawabanSiswa.bs || {})) {
        totalBS += POIN_PER_SOAL;
        const kunci = kunciJawaban.bs?.[qId] || '';
        const nilai = hitungNilaiBS(jawaban, kunci);
        nilaiBS += nilai;
        
        detail.bs[qId] = {
            jawaban: jawaban,
            kunci: kunci,
            nilai: nilai,
            nilaiMaksimal: POIN_PER_SOAL
        };
    }
    
    // ========== HITUNG NILAI AKHIR ==========
    const nilaiDiperoleh = nilaiPG + nilaiPGK + nilaiBS;
    const nilaiMaksimal = totalPG + totalPGK + totalBS;
    const nilaiAkhir = nilaiMaksimal > 0 
        ? Math.round((nilaiDiperoleh / nilaiMaksimal) * 100)
        : 0;
    
    return {
        nilaiPG,
        nilaiPGK,
        nilaiBS,
        totalPG,
        totalPGK,
        totalBS,
        nilaiAkhir,
        detail,
        jumlahSoal: {
            pg: Object.keys(jawabanSiswa.pg || {}).length,
            pgk: Object.keys(jawabanSiswa.pgk || {}).length,
            bs: Object.keys(jawabanSiswa.bs || {}).length
        }
    };
}

// ==================== HITUNG NILAI PGK ====================
/**
 * Aturan PGK:
 * - Persis sama (jumlah & isi) → 5
 * - Kurang/lebih tanpa salah → 2.5
 * - Ada jawaban salah → 1
 * - Benar 0 → 0
 */
function hitungNilaiPGK(jawabanSiswa, kunci) {
    if (!jawabanSiswa || !kunci) return 0;
    
    // Parse jawaban jadi array huruf, buang spasi
    const parseArr = (str) => {
        return String(str)
            .toUpperCase()
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .sort();
    };
    
    const arrJawaban = parseArr(jawabanSiswa);
    const arrKunci = parseArr(kunci);
    
    if (arrKunci.length === 0) return 0;
    if (arrJawaban.length === 0) return 0;
    
    // Hitung B (benar, ada di kunci) dan S (salah, tidak ada di kunci)
    let B = 0;
    let S = 0;
    
    for (const j of arrJawaban) {
        if (arrKunci.includes(j)) {
            B++;
        } else {
            S++;
        }
    }
    
    const K = arrKunci.length;
    
    // Persis sama
    if (B === K && S === 0) {
        return POIN_PER_SOAL; // 5
    }
    
    // Ada jawaban salah
    if (S >= 1 && B >= 1) {
        return 1;
    }
    
    // Kurang (tidak salah, tapi tidak lengkap)
    if (B >= 1 && S === 0 && B < K) {
        return POIN_PER_SOAL / 2; // 2.5
    }
    
    // Benar 0
    if (B === 0) {
        return 0;
    }
    
    return 0;
}

// ==================== HITUNG NILAI BS ====================
/**
 * Aturan BS: proporsional
 * nilai = (jumlah benar / jumlah pernyataan) × 5
 */
function hitungNilaiBS(jawabanSiswa, kunci) {
    if (!jawabanSiswa || !kunci) return 0;
    
    const parseArr = (str) => {
        return String(str)
            .toUpperCase()
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    };
    
    const arrJawaban = parseArr(jawabanSiswa);
    const arrKunci = parseArr(kunci);
    
    if (arrKunci.length === 0) return 0;
    
    // Hitung jumlah benar
    let benar = 0;
    const total = arrKunci.length;
    
    for (let i = 0; i < total; i++) {
        if (arrJawaban[i] === arrKunci[i]) {
            benar++;
        }
    }
    
    // Proporsional
    return (benar / total) * POIN_PER_SOAL;
}

// ==================== FUNGSI HELPER ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== TAMBAHKAN CSS (CEK APAKAH SUDAH ADA) ==========
if (!document.getElementById('management-nilai-style')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'management-nilai-style';
    styleTag.textContent = `
        /* Tombol Batalkan Koreksi */
        .btn-batal-koreksi {
            background: #ffc107;
            color: #333;
            border: none;
            padding: 6px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.3s ease;
            white-space: nowrap;
        }
        
        .btn-batal-koreksi:hover {
            background: #e0a800;
            transform: scale(1.02);
        }
        
        .btn-batal-koreksi:active {
            transform: scale(0.98);
        }
        
        /* Status Badge */
        .status-pending {
            background: #ffc107;
            color: #333;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            display: inline-block;
        }
        
        .status-selesai {
            background: #28a745;
            color: white;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            display: inline-block;
        }
    `;
    document.head.appendChild(styleTag);
}
