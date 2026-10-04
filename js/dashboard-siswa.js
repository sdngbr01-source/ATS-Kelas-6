// ============================================================
// dashboard-siswa.js - MULTI-LEVEL (REBUILD 2025)
// Level 1: Pilih Kode Ujian (ATS1/ASAS/ATS2/ASAT/ASAJ)
// Level 2: Pilih Kategori (Utama/Remidial/Pengayaan)
// Level 3: Pilih Mata Pelajaran
// ============================================================

const POIN_PER_SOAL = 5;

const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
let currentExam = null;
let currentQuestions = [];
let currentAnswers = {};
let currentQuestionIndex = 0;
let timerInterval = null;

// State navigasi
let state = {
    kode: null,
    kategori: null,
    examList: [],
    nilaiMapel: {}
};

// ==================== MAPPING KODE UJIAN ====================
const KODE_UJIAN_LABELS = {
    // ========== ULANGAN HARIAN ==========
    'UH1': { singkatan: 'UH1', nama: 'Ulangan Harian 1', short: 'UH 1', icon: '📖', urutan: 1, kelasKhusus: null },
    'UH2': { singkatan: 'UH2', nama: 'Ulangan Harian 2', short: 'UH 2', icon: '📖', urutan: 2, kelasKhusus: null },
    'UH3': { singkatan: 'UH3', nama: 'Ulangan Harian 3', short: 'UH 3', icon: '📖', urutan: 3, kelasKhusus: null },
    'UH4': { singkatan: 'UH4', nama: 'Ulangan Harian 4', short: 'UH 4', icon: '📖', urutan: 4, kelasKhusus: null },
    'UH5': { singkatan: 'UH5', nama: 'Ulangan Harian 5', short: 'UH 5', icon: '📖', urutan: 5, kelasKhusus: null },
    'UH6': { singkatan: 'UH6', nama: 'Ulangan Harian 6', short: 'UH 6', icon: '📖', urutan: 6, kelasKhusus: null },
    'UH7': { singkatan: 'UH7', nama: 'Ulangan Harian 7', short: 'UH 7', icon: '📖', urutan: 7, kelasKhusus: null },
    'UH8': { singkatan: 'UH8', nama: 'Ulangan Harian 8', short: 'UH 8', icon: '📖', urutan: 8, kelasKhusus: null },
    
    // ========== ASESMEN SEMESTER ==========
    'ATS1': { singkatan: 'ATS1', nama: 'Asesmen Tengah Semester Ganjil', short: 'ATS Ganjil', icon: '📝', urutan: 10, kelasKhusus: null },
    'ASAS': { singkatan: 'ASAS', nama: 'Asesmen Sumatif Akhir Semester 1', short: 'ASAS Semester 1', icon: '📝', urutan: 11, kelasKhusus: null },
    'ATS2': { singkatan: 'ATS2', nama: 'Asesmen Tengah Semester Genap', short: 'ATS Genap', icon: '📝', urutan: 12, kelasKhusus: null },
    'ASAT': { singkatan: 'ASAT', nama: 'Asesmen Sumatif Akhir Tahun', short: 'ASAT Semester 2', icon: '📝', urutan: 13, kelasKhusus: null },
    'ASAJ': { singkatan: 'ASAJ', nama: 'Asesmen Sumatif Akhir Jenjang', short: 'Ujian Akhir Jenjang', icon: '🎓', urutan: 14, kelasKhusus: ['6A', '6B', '6C', '6D'] }
};

const KATEGORI_LABELS = {
    'utama': { nama: 'Ujian Utama', icon: '🎯', desc: 'Kerjakan ujian utama terlebih dahulu', badge: 'utama' },
    'remidial': { nama: 'Remidial', icon: '🔄', desc: 'Untuk nilai < 70', badge: 'remidial' },
    'pengayaan': { nama: 'Pengayaan', icon: '⭐', desc: 'Untuk nilai 70 - 85', badge: 'pengayaan' }
};

// Cek login
if (!currentUser || currentUser.role !== 'siswa') {
    window.location.href = 'index.html';
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', function() {
    const userNameEl = document.getElementById('userName');
    const kelasSiswaEl = document.getElementById('kelasSiswa');
    
    if (userNameEl) userNameEl.textContent = currentUser.nama || 'Siswa';
    if (kelasSiswaEl) kelasSiswaEl.textContent = currentUser.kelas || '-';
    
    loadNilaiSummary();
    loadKodeUjian();
});

// ==================== LOAD NILAI SUMMARY ====================
async function loadNilaiSummary() {
    const summary = document.getElementById('nilaiSummary');
    if (!summary) return;
    
    try {
        const snapshot = await answersRef
            .where('siswaId', '==', currentUser.id)
            .get();
        summary.innerHTML = `<i class="fas fa-chart-line"></i> ${snapshot.size} ujian selesai`;
    } catch (error) {
        summary.innerHTML = `<i class="fas fa-chart-line"></i> -`;
    }
}

// ============================================================
// LEVEL 1: LOAD KODE UJIAN
// ============================================================
async function loadKodeUjian() {
    const container = document.getElementById('kodeUjianList');
    if (!container) return;
    
    container.innerHTML = '<p>Loading...</p>';
    
    try {
        const snapshot = await examsRef
            .where('kelas', '==', currentUser.kelas)
            .where('aktif', '==', true)
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 30px;">Belum ada ujian tersedia untuk kelas Anda</p>';
            return;
        }
        
        // Group by kode (default ATS1)
        const kodeMap = {};
        snapshot.forEach(doc => {
            const exam = doc.data();
            const kode = exam.kode || 'ATS1';
            if (!kodeMap[kode]) kodeMap[kode] = [];
            kodeMap[kode].push(exam);
        });
        
        const sortedKode = Object.keys(kodeMap).sort((a, b) => {
            const ua = KODE_UJIAN_LABELS[a]?.urutan || 99;
            const ub = KODE_UJIAN_LABELS[b]?.urutan || 99;
            return ua - ub;
        });
        
        container.innerHTML = '';
        let adaKode = false;
        
        sortedKode.forEach(kode => {
            const label = KODE_UJIAN_LABELS[kode];
            if (!label) return;
            
            if (label.kelasKhusus && !label.kelasKhusus.includes(currentUser.kelas)) {
                return;
            }
            
            adaKode = true;
            const mapelUnik = new Set(kodeMap[kode].map(e => e.mataPelajaran));
            
            container.innerHTML += `
                <div class="card" onclick="pilihKode('${kode}')">
                    <div class="kode-badge">${label.singkatan}</div>
                    <div class="card-icon">${label.icon}</div>
                    <h3>${label.short}</h3>
                    <p>${label.nama}</p>
                    <p style="margin-top: 12px; color: #2563eb; font-weight: 600;">
                        ${mapelUnik.size} mata pelajaran
                    </p>
                </div>
            `;
        });
        
        if (!adaKode) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 30px;">Belum ada ujian tersedia</p>';
        }
        
    } catch (error) {
        console.error('Error loading kode ujian:', error);
        container.innerHTML = '<p style="color: red;">Gagal memuat data ujian</p>';
    }
}

// ============================================================
// LEVEL 2: PILIH KODE → LOAD KATEGORI
// ============================================================
async function pilihKode(kode) {
    state.kode = kode;
    
    document.getElementById('menuKodeUjian').style.display = 'none';
    document.getElementById('menuKategori').style.display = 'block';
    
    const label = KODE_UJIAN_LABELS[kode] || { nama: kode };
    document.getElementById('breadcrumbKategori').innerHTML = `
        <i class="fas fa-home"></i>
        <span class="crumb-active">${label.singkatan} - ${label.short}</span>
    `;
    document.getElementById('kategoriTitle').textContent = label.short;
    
    await loadKategori();
}

async function loadKategori() {
    const container = document.getElementById('kategoriList');
    if (!container) return;
    
    container.innerHTML = '<p>Loading...</p>';
    
    try {
        const snapshot = await examsRef
            .where('kelas', '==', currentUser.kelas)
            .where('kode', '==', state.kode)
            .where('aktif', '==', true)
            .get();
        
        state.examList = [];
        snapshot.forEach(doc => {
            state.examList.push({ id: doc.id, ...doc.data() });
        });
        
        const kategoriMap = { 'utama': [], 'remidial': [], 'pengayaan': [] };
        state.examList.forEach(exam => {
            const kategori = exam.kategori || 'utama';
            if (!kategoriMap[kategori]) kategoriMap[kategori] = [];
            kategoriMap[kategori].push(exam);
        });
        
        await loadNilaiMapel();
        
        container.innerHTML = '';
        
        ['utama', 'remidial', 'pengayaan'].forEach(kat => {
            const label = KATEGORI_LABELS[kat];
            const examCount = kategoriMap[kat].length;
            const mapelUnik = new Set(kategoriMap[kat].map(e => e.mataPelajaran));
            
            let statusInfo = '';
            let isDisabled = false;
            
            if (kat === 'remidial') {
                const bisaRemidial = cekMapelBisaRemidial();
                if (bisaRemidial.length === 0) {
                    isDisabled = true;
                    statusInfo = '<p style="color: #ef4444; font-size: 0.75rem; margin-top: 8px;">🔒 Belum ada mapel dengan nilai < 70</p>';
                } else {
                    statusInfo = `<p style="color: #f59e0b; font-size: 0.75rem; margin-top: 8px;">⚠️ ${bisaRemidial.length} mapel tersedia</p>`;
                }
            } else if (kat === 'pengayaan') {
                const bisaPengayaan = cekMapelBisaPengayaan();
                if (bisaPengayaan.length === 0) {
                    isDisabled = true;
                    statusInfo = '<p style="color: #ef4444; font-size: 0.75rem; margin-top: 8px;">🔒 Belum ada mapel dengan nilai 70-85</p>';
                } else {
                    statusInfo = `<p style="color: #10b981; font-size: 0.75rem; margin-top: 8px;">✅ ${bisaPengayaan.length} mapel tersedia</p>`;
                }
            } else {
                if (examCount === 0) isDisabled = true;
                statusInfo = `<p style="color: #2563eb; font-size: 0.75rem; margin-top: 8px;">${mapelUnik.size} mapel</p>`;
            }
            
            if (examCount === 0) {
                isDisabled = true;
                statusInfo = '<p style="color: #94a3b8; font-size: 0.75rem; margin-top: 8px;">🔒 Belum tersedia</p>';
            }
            
            container.innerHTML += `
                <div class="card ${isDisabled ? 'disabled' : ''}" 
                     ${isDisabled ? '' : `onclick="pilihKategori('${kat}')"`}>
                    <div class="card-badge badge-${label.badge}">${label.nama}</div>
                    <div class="card-icon">${label.icon}</div>
                    <h3>${label.nama}</h3>
                    <p>${label.desc}</p>
                    ${statusInfo}
                </div>
            `;
        });
        
    } catch (error) {
        console.error('Error loading kategori:', error);
        container.innerHTML = '<p style="color: red;">Gagal memuat kategori</p>';
    }
}

function cekMapelBisaRemidial() {
    const hasil = [];
    for (const [mapel, data] of Object.entries(state.nilaiMapel)) {
        if (data.nilaiAkhir !== null && data.nilaiAkhir < 70 && !data.sudahRemidial) {
            hasil.push(mapel);
        }
    }
    return hasil;
}

function cekMapelBisaPengayaan() {
    const hasil = [];
    for (const [mapel, data] of Object.entries(state.nilaiMapel)) {
        if (data.nilaiAkhir !== null && data.nilaiAkhir >= 70 && data.nilaiAkhir <= 85 
            && !data.sudahPengayaan && !data.sudahRemidial) {
            hasil.push(mapel);
        }
    }
    return hasil;
}

// ============================================================
// LOAD NILAI MAPEL
// ============================================================
async function loadNilaiMapel() {
    state.nilaiMapel = {};
    
    try {
        const snapshot = await answersRef
            .where('siswaId', '==', currentUser.id)
            .get();
        
        const mapelData = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const kode = data.kode || 'ATS1';
            if (kode !== state.kode) return;
            
            const mapel = data.mataPelajaran;
            const kategori = data.kategori || 'utama';
            const waktu = data.waktu?.toDate?.() || new Date(0);
            
            if (!mapelData[mapel]) {
                mapelData[mapel] = {
                    nilaiAkhir: null,
                    sudahRemidial: false,
                    sudahPengayaan: false,
                    waktuUtama: new Date(0)
                };
            }
            
            if (kategori === 'utama') {
                if (waktu > mapelData[mapel].waktuUtama || mapelData[mapel].nilaiAkhir === null) {
                    mapelData[mapel].nilaiAkhir = data.nilaiAkhir || 0;
                    mapelData[mapel].waktuUtama = waktu;
                }
            } else if (kategori === 'remidial') {
                mapelData[mapel].sudahRemidial = true;
            } else if (kategori === 'pengayaan') {
                mapelData[mapel].sudahPengayaan = true;
            }
        });
        
        state.nilaiMapel = mapelData;
        
    } catch (error) {
        console.error('Error loading nilai mapel:', error);
    }
}

// ============================================================
// LEVEL 3: PILIH KATEGORI → LOAD MAPEL
// ============================================================
async function pilihKategori(kategori) {
    state.kategori = kategori;
    
    document.getElementById('menuKategori').style.display = 'none';
    document.getElementById('menuMapel').style.display = 'block';
    
    const labelKode = KODE_UJIAN_LABELS[state.kode] || { singkatan: state.kode };
    const labelKat = KATEGORI_LABELS[kategori] || { nama: kategori };
    document.getElementById('breadcrumbMapel').innerHTML = `
        <i class="fas fa-home"></i>
        <span>${labelKode.singkatan}</span>
        <i class="fas fa-chevron-right"></i>
        <span class="crumb-active">${labelKat.nama}</span>
    `;
    
    await loadMapel();
}

async function loadMapel() {
    const container = document.getElementById('subjectList');
    if (!container) return;
    
    container.innerHTML = '<p>Loading...</p>';
    
    try {
        const snapshot = await examsRef
            .where('kelas', '==', currentUser.kelas)
            .where('kode', '==', state.kode)
            .where('kategori', '==', state.kategori)
            .where('aktif', '==', true)
            .get();
        
        const examList = [];
        snapshot.forEach(doc => {
            examList.push({ id: doc.id, ...doc.data() });
        });
        
        if (examList.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 30px;">Belum ada ujian untuk kategori ini</p>';
            return;
        }
        
        container.innerHTML = '';
        
        for (const exam of examList) {
            const mapel = exam.mataPelajaran;
            const nilaiData = state.nilaiMapel[mapel] || {
                nilaiAkhir: null, sudahRemidial: false, sudahPengayaan: false
            };
            
            let isDisabled = false;
            let statusText = '';
            let statusColor = '#64748b';
            let nilaiDisplay = '';
            
            if (nilaiData.nilaiAkhir !== null) {
                const nilai = nilaiData.nilaiAkhir;
                let nilaiClass = 'mid';
                if (nilai >= 70) nilaiClass = 'high';
                else nilaiClass = 'low';
                nilaiDisplay = `<span class="nilai-badge ${nilaiClass}">Nilai: ${nilai}</span>`;
            } else {
                nilaiDisplay = `<span class="nilai-badge none">Belum Ujian</span>`;
            }
            
            const sudahDikerjakan = await cekSudahDikerjakan(exam.id);
            
            if (sudahDikerjakan) {
                isDisabled = true;
                statusText = '✅ Sudah dikerjakan';
                statusColor = '#10b981';
            } else if (state.kategori === 'remidial') {
                if (nilaiData.nilaiAkhir === null) {
                    isDisabled = true;
                    statusText = '⚠️ Kerjakan Ujian Utama dulu';
                    statusColor = '#f59e0b';
                } else if (nilaiData.nilaiAkhir >= 70) {
                    isDisabled = true;
                    statusText = '🔒 Nilai ≥ 70, tidak perlu remidial';
                    statusColor = '#ef4444';
                } else if (nilaiData.sudahRemidial) {
                    isDisabled = true;
                    statusText = '✅ Sudah remidial';
                    statusColor = '#10b981';
                } else {
                    statusText = '✅ Bisa Remidial';
                    statusColor = '#10b981';
                }
            } else if (state.kategori === 'pengayaan') {
                if (nilaiData.nilaiAkhir === null) {
                    isDisabled = true;
                    statusText = '⚠️ Kerjakan Ujian Utama dulu';
                    statusColor = '#f59e0b';
                } else if (nilaiData.sudahRemidial) {
                    isDisabled = true;
                    statusText = '🔒 Sudah remidial, tidak perlu pengayaan';
                    statusColor = '#ef4444';
                } else if (nilaiData.nilaiAkhir < 70) {
                    isDisabled = true;
                    statusText = '🔒 Nilai < 70, kerjakan remidial dulu';
                    statusColor = '#ef4444';
                } else if (nilaiData.nilaiAkhir > 85) {
                    isDisabled = true;
                    statusText = '🔒 Nilai > 85, sudah sangat baik';
                    statusColor = '#ef4444';
                } else if (nilaiData.sudahPengayaan) {
                    isDisabled = true;
                    statusText = '✅ Sudah pengayaan';
                    statusColor = '#10b981';
                } else {
                    statusText = '✅ Bisa Pengayaan';
                    statusColor = '#10b981';
                }
            } else {
                statusText = '▶️ Mulai Ujian';
                statusColor = '#2563eb';
            }
            
            const jml = exam.jumlahSoal || {};
            const totalSoal = (jml.pg || 0) + (jml.pgk || 0) + (jml.bs || 0);
            
            container.innerHTML += `
                <div class="card ${isDisabled ? 'disabled' : ''}" 
                     ${isDisabled ? '' : `onclick="startExam('${exam.id}', '${mapel}')"`}>
                    <div class="card-icon">📚</div>
                    <h3>${mapel}</h3>
                    <p>${totalSoal} soal • ${exam.durasi || 60} menit</p>
                    <div style="margin-top: 10px;">${nilaiDisplay}</div>
                    <p style="color: ${statusColor}; font-size: 0.75rem; font-weight: 600; margin-top: 8px;">
                        ${statusText}
                    </p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading mapel:', error);
        container.innerHTML = '<p style="color: red;">Gagal memuat mata pelajaran</p>';
    }
}

async function cekSudahDikerjakan(examId) {
    try {
        const snapshot = await answersRef
            .where('examId', '==', examId)
            .where('siswaId', '==', currentUser.id)
            .limit(1)
            .get();
        return !snapshot.empty;
    } catch (error) {
        return false;
    }
}

// ============================================================
// NAVIGASI
// ============================================================
function backToKodeUjian() {
    state.kode = null;
    state.kategori = null;
    document.getElementById('menuKategori').style.display = 'none';
    document.getElementById('menuMapel').style.display = 'none';
    document.getElementById('menuKodeUjian').style.display = 'block';
}

function backToKategori() {
    state.kategori = null;
    document.getElementById('menuMapel').style.display = 'none';
    document.getElementById('menuKategori').style.display = 'block';
    loadKategori();
}

// ============================================================
// START EXAM
// ============================================================
async function startExam(examId, subjectName) {
    try {
        const examDoc = await examsRef.doc(examId).get();
        if (!examDoc.exists) {
            alert('Ujian tidak ditemukan');
            return;
        }
        
        currentExam = { id: examId, ...examDoc.data() };
        
        const kode = currentExam.kode || 'ATS1';
        
        // Ambil soal TANPA filter kode di Firestore (backward compat)
        const questionsSnapshot = await questionsRef
            .where('kelas', '==', currentExam.kelas)
            .where('mataPelajaran', '==', currentExam.mataPelajaran)
            .get();
        
        // Default kode ATS1, filter di JS
        let allQuestions = questionsSnapshot.docs
            .map(doc => {
                const data = doc.data();
                if (!data.kode) data.kode = 'ATS1';
                return { id: doc.id, ...data };
            })
            .filter(q => q.kode === kode)
            .sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
        
        if (allQuestions.length === 0) {
            alert('Tidak ada soal untuk ujian ini.');
            return;
        }
        
        const examJumlahSoal = currentExam.jumlahSoal || {};
        const pgQuestions = allQuestions.filter(q => q.tipe === 'pg');
        const pgkQuestions = allQuestions.filter(q => q.tipe === 'pgk');
        const bsQuestions = allQuestions.filter(q => q.tipe === 'bs');
        
        const pgCount = examJumlahSoal.pg || pgQuestions.length;
        const pgkCount = examJumlahSoal.pgk || pgkQuestions.length;
        const bsCount = examJumlahSoal.bs || bsQuestions.length;
        
        let selectedPG = pgQuestions.slice(0, pgCount);
        let selectedPGK = pgkQuestions.slice(0, pgkCount);
        let selectedBS = bsQuestions.slice(0, bsCount);
        
        if (currentExam.acak === true) {
            selectedPG = shuffleArray(selectedPG);
            selectedPGK = shuffleArray(selectedPGK);
            selectedBS = shuffleArray(selectedBS);
        }
        
        currentQuestions = [...selectedPG, ...selectedPGK, ...selectedBS];
        
        if (currentQuestions.length === 0) {
            alert('Tidak ada soal yang sesuai konfigurasi ujian');
            return;
        }
        
        currentQuestions = currentQuestions.map(q => {
            q.nilai = POIN_PER_SOAL;
            return q;
        });
        
        currentAnswers = {};
        currentQuestionIndex = 0;
        
        document.getElementById('menuKodeUjian').style.display = 'none';
        document.getElementById('menuKategori').style.display = 'none';
        document.getElementById('menuMapel').style.display = 'none';
        document.getElementById('examPage').style.display = 'block';
        
        const labelKat = KATEGORI_LABELS[state.kategori] || { nama: '' };
        document.getElementById('examSubject').textContent = 
            `${subjectName} ${labelKat.nama ? '- ' + labelKat.nama : ''}`;
        
        startTimer((currentExam.durasi || 60) * 60);
        showQuestion();
        updateQuestionGrid();
        
    } catch (error) {
        console.error('Error starting exam:', error);
        alert('Gagal memulai ujian: ' + error.message);
    }
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ==================== TIMER ====================
function startTimer(duration) {
    const timerDisplay = document.getElementById('timer');
    if (!timerDisplay) return;
    
    let timeLeft = duration;
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert('Waktu habis!');
            submitExam();
        }
        timeLeft--;
    }, 1000);
}

// ==================== SHOW QUESTION ====================
function showQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    const container = document.getElementById('questionContainer');
    
    if (!question || !container) return;
    
    let html = `
        <div class="question-number">Soal ${currentQuestionIndex + 1} dari ${currentQuestions.length}</div>
        <div class="question-point">Nilai: ${question.nilai || 0} poin</div>
    `;
    
    if (question.gambar && question.gambar.trim() !== '') {
        html += `
            <div class="question-image-container">
                <img src="${question.gambar}" 
                     alt="Gambar soal" 
                     class="question-image"
                     onclick="showImageModal('${question.gambar}')"
                     onerror="this.style.display='none'">
                <p style="font-size: 12px; color: #666; margin-top: 5px;">Klik gambar untuk memperbesar</p>
            </div>
        `;
    }
    
    html += `<div class="question-text">${question.soal || 'Soal tidak tersedia'}</div>`;
    
    if (question.tipe === 'pg') html += renderPG(question);
    else if (question.tipe === 'pgk') html += renderPGK(question);
    else if (question.tipe === 'bs') html += renderBS(question);
    
    html += `<div class="navigation-buttons">`;
    if (currentQuestionIndex > 0) {
        html += `<button class="nav-btn prev" onclick="prevQuestion()">← Sebelumnya</button>`;
    } else {
        html += `<div></div>`;
    }
    
    if (currentQuestionIndex < currentQuestions.length - 1) {
        html += `<button class="nav-btn next" onclick="nextQuestion()">Selanjutnya →</button>`;
    } else {
        html += `<button class="nav-btn submit" onclick="submitExam()">Selesai</button>`;
    }
    html += `</div>`;
    
    container.innerHTML = html;
}

function renderPG(question) {
    let html = '<div class="options">';
    const optionLetters = ['A', 'B', 'C', 'D'];
    const pilihan = question.pilihan || [];
    const gambarPilihan = question.gambarPilihan || {};
    
    for (let i = 0; i < pilihan.length; i++) {
        const pilihanText = pilihan[i];
        if (!pilihanText) continue;
        
        const optionLetter = optionLetters[i];
        const isSelected = currentAnswers[question.id] === optionLetter;
        const gambarUrl = gambarPilihan[optionLetter] || '';
        
        html += `<div class="option ${isSelected ? 'selected' : ''}" onclick="selectOption('${question.id}', '${optionLetter}')">`;
        html += `<div class="option-marker">${optionLetter}</div>`;
        html += `<div class="option-text">`;
        if (gambarUrl) {
            html += `<img src="${gambarUrl}" onclick="showOptionImage('${gambarUrl}', event)" onerror="this.style.display='none'">`;
        }
        html += `<span>${pilihanText}</span></div></div>`;
    }
    html += '</div>';
    return html;
}

function renderPGK(question) {
    let html = '<div class="info-multiple">ℹ️ Pilih lebih dari satu jawaban yang benar</div>';
    html += '<div class="options">';
    
    const optionLetters = ['A', 'B', 'C', 'D', 'E'];
    const pilihan = question.pilihan || [];
    const gambarPilihan = question.gambarPilihan || {};
    const selectedAnswers = currentAnswers[question.id] || [];
    
    for (let i = 0; i < pilihan.length; i++) {
        const pilihanText = pilihan[i];
        if (!pilihanText) continue;
        
        const optionLetter = optionLetters[i];
        const isSelected = Array.isArray(selectedAnswers) && selectedAnswers.includes(optionLetter);
        const gambarUrl = gambarPilihan[optionLetter] || '';
        
        html += `<div class="option ${isSelected ? 'selected' : ''}" onclick="toggleMultiOption('${question.id}', '${optionLetter}')">`;
        html += `<div class="option-marker">${isSelected ? '✓' : ''} ${optionLetter}</div>`;
        html += `<div class="option-text">`;
        if (gambarUrl) {
            html += `<img src="${gambarUrl}" onclick="showOptionImage('${gambarUrl}', event)" onerror="this.style.display='none'">`;
        }
        html += `<span>${pilihanText}</span></div></div>`;
    }
    html += '</div>';
    return html;
}

function renderBS(question) {
    const pernyataanList = question.pernyataanBS || [];
    const jawabanSiswa = currentAnswers[question.id] || {};
    
    let html = '<div class="info-tf">ℹ️ Tentukan Benar (B) atau Salah (S) untuk setiap pernyataan</div>';
    
    pernyataanList.forEach((item, idx) => {
        const jawabanItem = jawabanSiswa[idx] || '';
        const textPernyataan = item.text || item.pernyataan || '';
        
        html += `
            <div class="tf-item">
                <div class="tf-number">${idx + 1}.</div>
                <div class="tf-text">${textPernyataan}</div>
                <div class="tf-options">
                    <button class="tf-btn" onclick="selectTrueFalse('${question.id}', ${idx}, 'B')"
                            style="border-color: ${jawabanItem === 'B' ? '#28a745' : '#ddd'}; 
                                   background: ${jawabanItem === 'B' ? '#28a745' : 'white'}; 
                                   color: ${jawabanItem === 'B' ? 'white' : '#333'};">B</button>
                    <button class="tf-btn" onclick="selectTrueFalse('${question.id}', ${idx}, 'S')"
                            style="border-color: ${jawabanItem === 'S' ? '#dc3545' : '#ddd'}; 
                                   background: ${jawabanItem === 'S' ? '#dc3545' : 'white'}; 
                                   color: ${jawabanItem === 'S' ? 'white' : '#333'};">S</button>
                </div>
            </div>
        `;
    });
    return html;
}

function showImageModal(url) {
    document.getElementById('imageModal').style.display = 'flex';
    document.getElementById('modalImage').src = url;
}
function showOptionImage(url, event) {
    if (event) event.stopPropagation();
    showImageModal(url);
}
function closeImageModal() {
    document.getElementById('imageModal').style.display = 'none';
}
function selectOption(qId, ans) {
    currentAnswers[qId] = ans;
    showQuestion();
    updateQuestionGrid();
}
function toggleMultiOption(qId, opt) {
    if (!currentAnswers[qId]) currentAnswers[qId] = [];
    const arr = currentAnswers[qId];
    const idx = arr.indexOf(opt);
    if (idx === -1) arr.push(opt);
    else arr.splice(idx, 1);
    showQuestion();
    updateQuestionGrid();
}
function selectTrueFalse(qId, idx, val) {
    if (!currentAnswers[qId]) currentAnswers[qId] = {};
    currentAnswers[qId][idx] = val;
    showQuestion();
    updateQuestionGrid();
}
function goToQuestion(i) {
    if (i >= 0 && i < currentQuestions.length) {
        currentQuestionIndex = i;
        showQuestion();
        updateQuestionGrid();
    }
}
function nextQuestion() { goToQuestion(currentQuestionIndex + 1); }
function prevQuestion() { goToQuestion(currentQuestionIndex - 1); }
function jumpToQuestion(i) { goToQuestion(i); }

function updateQuestionGrid() {
    const grid = document.getElementById('questionGrid');
    if (!grid) return;
    
    let html = '';
    currentQuestions.forEach((q, i) => {
        const jwb = currentAnswers[q.id];
        let isAnswered = false;
        if (jwb !== undefined && jwb !== '') {
            if (Array.isArray(jwb)) isAnswered = jwb.length > 0;
            else if (typeof jwb === 'object' && jwb !== null) isAnswered = Object.keys(jwb).length > 0;
            else isAnswered = true;
        }
        const isCurrent = i === currentQuestionIndex;
        html += `<div class="question-grid-item ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}" onclick="jumpToQuestion(${i})">${i + 1}</div>`;
    });
    grid.innerHTML = html;
}

// ============================================================
// SUBMIT EXAM
// ============================================================
async function submitExam() {
    if (!confirm('Apakah Anda yakin ingin mengumpulkan jawaban?')) return;
    
    if (timerInterval) clearInterval(timerInterval);
    
    try {
        const jawabanPG = {}, jawabanPGK = {}, jawabanBS = {};
        let nilaiPG = 0, nilaiPGK = 0, nilaiBS = 0;
        let jmlPG = 0, jmlPGK = 0, jmlBS = 0;
        const detailKoreksi = { pg: {}, pgk: {}, bs: {} };
        
        for (const q of currentQuestions) {
            const jwbSiswa = currentAnswers[q.id];
            const tipe = q.tipe;
            
            if (tipe === 'pg') {
                jmlPG++;
                const jwbStr = String(jwbSiswa || '').trim().toUpperCase();
                const kunciStr = String(q.kunci || '').trim().toUpperCase();
                const benar = (jwbStr !== '' && jwbStr === kunciStr);
                const nilai = benar ? POIN_PER_SOAL : 0;
                nilaiPG += nilai;
                jawabanPG[q.id] = { jawaban: jwbStr, kunci: kunciStr, benar, nilai, nomor: q.nomor, soal: q.soal, pilihan: q.pilihan || [] };
                detailKoreksi.pg[q.id] = { jawaban: jwbStr, kunci: kunciStr, benar, nilai, nilaiMaksimal: POIN_PER_SOAL };
            } else if (tipe === 'pgk') {
                jmlPGK++;
                const jwbArr = Array.isArray(jwbSiswa) ? jwbSiswa : [];
                const kunciArr = Array.isArray(q.kunci) ? q.kunci : (typeof q.kunci === 'string' ? q.kunci.split(',').map(k => k.trim().toUpperCase()).filter(Boolean) : []);
                const nilai = hitungNilaiPGK(jwbArr, kunciArr);
                nilaiPGK += nilai;
                jawabanPGK[q.id] = { jawaban: jwbArr, kunci: kunciArr, nilai, nomor: q.nomor, soal: q.soal, pilihan: q.pilihan || [] };
                detailKoreksi.pgk[q.id] = { jawaban: jwbArr, kunci: kunciArr, nilai, nilaiMaksimal: POIN_PER_SOAL };
            } else if (tipe === 'bs') {
                jmlBS++;
                const jwbObj = jwbSiswa || {};
                const pernyataanList = q.pernyataanBS || [];
                let benar = 0;
                const detailBS = [];
                pernyataanList.forEach((item, idx) => {
                    const jwbItem = (jwbObj[idx] || '').toUpperCase();
                    const kunciItem = (item.kunci || item.jawaban || '').toUpperCase();
                    const isBenar = (jwbItem !== '' && jwbItem === kunciItem);
                    if (isBenar) benar++;
                    detailBS.push({ pernyataan: item.text || item.pernyataan || '', jawaban: jwbItem, kunci: kunciItem, benar: isBenar });
                });
                const nilai = hitungNilaiBS(jwbObj, pernyataanList);
                nilaiBS += nilai;
                jawabanBS[q.id] = { jawaban: jwbObj, pernyataan: pernyataanList, benar, total: pernyataanList.length, nilai, nomor: q.nomor, soal: q.soal };
                detailKoreksi.bs[q.id] = { jawaban: jwbObj, pernyataan: detailBS, benar, totalPernyataan: pernyataanList.length, nilai, nilaiMaksimal: POIN_PER_SOAL };
            }
        }
        
        const totalPG = jmlPG * POIN_PER_SOAL;
        const totalPGK = jmlPGK * POIN_PER_SOAL;
        const totalBS = jmlBS * POIN_PER_SOAL;
        const jumlahDiperoleh = nilaiPG + nilaiPGK + nilaiBS;
        const jumlahMaksimal = totalPG + totalPGK + totalBS;
        let nilaiAkhir = jumlahMaksimal > 0 ? Math.round((jumlahDiperoleh / jumlahMaksimal) * 100) : 0;
        
        let nilaiAwal = null;
        let nilaiFinal = nilaiAkhir;
        let keterangan = '';
        const kategori = state.kategori || 'utama';
        
        if (kategori === 'remidial' || kategori === 'pengayaan') {
            nilaiAwal = await getNilaiAwal(currentExam.mataPelajaran, state.kode);
            if (nilaiAwal === null) {
                alert('⚠️ Nilai ujian utama tidak ditemukan. Hubungi guru.');
                return;
            }
            
            if (kategori === 'remidial') {
    nilaiFinal = hitungNilaiFinalRemidial(nilaiAwal, nilaiAkhir);
    keterangan = 'R';
} else {
    nilaiFinal = hitungNilaiFinalPengayaan(nilaiAwal, nilaiAkhir);  // ← Tambah nilaiAkhir
    keterangan = 'P';
}
        }
        
        await answersRef.add({
            examId: currentExam.id,
            siswaId: currentUser.id,
            siswaNama: currentUser.nama,
            nis: currentUser.nis || '',
            kelas: currentUser.kelas,
            mataPelajaran: currentExam.mataPelajaran,
            kode: state.kode || 'ATS1',
            kategori: kategori,
            jawabanPG, jawabanPGK, jawabanBS,
            nilaiPG, nilaiPGK, nilaiBS,
            totalPG, totalPGK, totalBS,
            detailKoreksi,
            jumlahSoal: { pg: jmlPG, pgk: jmlPGK, bs: jmlBS },
            nilaiAkhir: nilaiAkhir,
            nilaiAwal: nilaiAwal,
            nilaiFinal: nilaiFinal,
            keterangan: keterangan,
            statusKoreksi: 'selesai',
            waktu: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showResults(nilaiPG, nilaiPGK, nilaiBS, totalPG, totalPGK, totalBS, nilaiAkhir, nilaiFinal, keterangan, nilaiAwal, kategori);
        
    } catch (error) {
        console.error('Error submitting exam:', error);
        alert('Gagal mengumpulkan jawaban: ' + error.message);
    }
}

async function getNilaiAwal(mapel, kode) {
    try {
        const snapshot = await answersRef
            .where('siswaId', '==', currentUser.id)
            .where('mataPelajaran', '==', mapel)
            .where('kode', '==', kode)
            .where('kategori', '==', 'utama')
            .get();
        
        if (snapshot.empty) return null;
        
        let terbaru = null;
        let waktuTerbaru = new Date(0);
        snapshot.forEach(doc => {
            const data = doc.data();
            const waktu = data.waktu?.toDate?.() || new Date(0);
            if (waktu > waktuTerbaru) {
                waktuTerbaru = waktu;
                terbaru = data;
            }
        });
        return terbaru ? (terbaru.nilaiAkhir || 0) : null;
    } catch (error) {
        return null;
    }
}

function hitungNilaiFinalRemidial(nilaiAwal, nilaiRemidial) {
    if (nilaiRemidial > 70) return 70;
    if (nilaiRemidial < 70 && nilaiRemidial > nilaiAwal) {
        return Math.round((nilaiAwal + nilaiRemidial) / 2);
    }
    return nilaiAwal;
}

function hitungNilaiFinalPengayaan(nilaiAwal, nilaiPengayaan) {
    // Jika nilai pengayaan > nilai awal → rata-rata
    if (nilaiPengayaan > nilaiAwal) {
        return Math.round((nilaiAwal + nilaiPengayaan) / 2);
    }
    // Jika nilai pengayaan < nilai awal → pakai nilai awal
    return nilaiAwal;
}

function hitungNilaiPGK(jwbArr, kunciArr) {
    if (!jwbArr || jwbArr.length === 0 || !kunciArr || kunciArr.length === 0) return 0;
    const parse = (arr) => arr.map(s => String(s).toUpperCase().trim()).filter(s => s.length > 0).sort();
    const aJ = parse(jwbArr), aK = parse(kunciArr);
    if (aK.length === 0 || aJ.length === 0) return 0;
    let B = 0, S = 0;
    for (const j of aJ) { if (aK.includes(j)) B++; else S++; }
    const K = aK.length;
    if (B === K && S === 0) return POIN_PER_SOAL;
    if (S >= 1 && B >= 1) return 1;
    if (B >= 1 && S === 0 && B < K) return POIN_PER_SOAL / 2;
    return 0;
}

function hitungNilaiBS(jwbObj, pernyataanList) {
    if (!jwbObj || !pernyataanList || pernyataanList.length === 0) return 0;
    let benar = 0;
    const total = pernyataanList.length;
    pernyataanList.forEach((item, idx) => {
        const jwbItem = (jwbObj[idx] || '').toUpperCase();
        const kunciItem = (item.kunci || item.jawaban || '').toUpperCase();
        if (jwbItem !== '' && jwbItem === kunciItem) benar++;
    });
    return (benar / total) * POIN_PER_SOAL;
}

function showResults(nilaiPG, nilaiPGK, nilaiBS, totalPG, totalPGK, totalBS, nilaiAkhir, nilaiFinal, keterangan, nilaiAwal, kategori) {
    document.getElementById('examPage').style.display = 'none';
    document.getElementById('resultPage').style.display = 'block';
    
    const el = (id) => document.getElementById(id);
    if (el('resultPG')) el('resultPG').textContent = nilaiPG + ' / ' + totalPG;
    if (el('resultPGK')) el('resultPGK').textContent = nilaiPGK + ' / ' + totalPGK;
    if (el('resultBS')) el('resultBS').textContent = nilaiBS + ' / ' + totalBS;
    if (el('resultNilaiAkhir')) el('resultNilaiAkhir').textContent = nilaiFinal;
    
    const finalInfo = el('resultFinalInfo');
    if (finalInfo) {
        if (kategori === 'remidial' && nilaiAwal !== null) {
            finalInfo.innerHTML = `
                <div class="info-alert" style="margin-top: 20px;">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <strong>🔄 Remidial Selesai</strong><br>
                        Nilai Ujian Utama: <strong>${nilaiAwal}</strong><br>
                        Nilai Remidial: <strong>${nilaiAkhir}</strong><br>
                        <span style="color: #166534; font-weight: 700;">Nilai Final (R): <strong>${nilaiFinal}</strong></span>
                    </div>
                </div>
            `;
        } else if (kategori === 'pengayaan' && nilaiAwal !== null) {
    let keteranganNilai = '';
    if (nilaiAkhir > nilaiAwal) {
        keteranganNilai = `Rata-rata: (${nilaiAwal} + ${nilaiAkhir}) / 2 = ${nilaiFinal}`;
    } else {
        keteranganNilai = `Nilai pengayaan lebih rendah, pakai nilai utama: ${nilaiAwal}`;
    }
    
    finalInfo.innerHTML = `
        <div class="info-alert info-blue" style="margin-top: 20px;">
            <i class="fas fa-star"></i>
            <div>
                <strong>⭐ Pengayaan Selesai</strong><br>
                Nilai Ujian Utama: <strong>${nilaiAwal}</strong><br>
                Nilai Pengayaan: <strong>${nilaiAkhir}</strong><br>
                <em style="color: #64748b;">${keteranganNilai}</em><br>
                <span style="color: #1e40af; font-weight: 700;">Nilai Final (P): <strong>${nilaiFinal}</strong></span>
            </div>
        </div>
    `;
} else {
            finalInfo.innerHTML = '';
        }
    }
    
    const resultInfo = el('resultInfo');
    if (resultInfo) {
        const labelKat = KATEGORI_LABELS[kategori] || { nama: 'Ujian Utama' };
        resultInfo.innerHTML = `
            <div class="breadcrumb" style="margin-bottom: 20px;">
                <i class="fas fa-check-circle" style="color: #10b981;"></i>
                <span>${labelKat.nama} - ${currentExam.mataPelajaran}</span>
            </div>
        `;
    }
}

function backToMenu() {
    document.getElementById('resultPage').style.display = 'none';
    document.getElementById('examPage').style.display = 'none';
    document.getElementById('menuKodeUjian').style.display = 'none';
    document.getElementById('menuKategori').style.display = 'none';
    document.getElementById('menuMapel').style.display = 'block';
    
    currentExam = null;
    currentQuestions = [];
    currentAnswers = {};
    currentQuestionIndex = 0;
    if (timerInterval) clearInterval(timerInterval);
    
    loadNilaiSummary();
    loadKategori();
}

function logout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}
