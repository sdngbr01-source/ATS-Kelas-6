// ============================================================
// setting-soal.js - REBUILD 2025 (MULTI-KODE)
// Setting Ujian dengan KODE + Kategori + Acak Soal
// ============================================================

let examCache = null;
let lastExamFetch = 0;
const EXAM_CACHE_DURATION = 30000;

// ✅ Pakai window biar tidak bentrok dengan file lain
window.KODE_LABELS_SETTING = {
    'UH1': { short: 'UH 1', full: 'Ulangan Harian 1' },
    'UH2': { short: 'UH 2', full: 'Ulangan Harian 2' },
    'UH3': { short: 'UH 3', full: 'Ulangan Harian 3' },
    'UH4': { short: 'UH 4', full: 'Ulangan Harian 4' },
    'UH5': { short: 'UH 5', full: 'Ulangan Harian 5' },
    'UH6': { short: 'UH 6', full: 'Ulangan Harian 6' },
    'UH7': { short: 'UH 7', full: 'Ulangan Harian 7' },
    'UH8': { short: 'UH 8', full: 'Ulangan Harian 8' },
    'ATS1': { short: 'ATS Ganjil', full: 'Asesmen Tengah Semester Ganjil' },
    'ASAS': { short: 'ASAS Sem 1', full: 'Asesmen Sumatif Akhir Semester 1' },
    'ATS2': { short: 'ATS Genap', full: 'Asesmen Tengah Semester Genap' },
    'ASAT': { short: 'ASAT Sem 2', full: 'Asesmen Sumatif Akhir Tahun' },
    'ASAJ': { short: 'ASAJ', full: 'Asesmen Sumatif Akhir Jenjang' }
};
window.KATEGORI_LABELS_SETTING = window.KATEGORI_LABELS_SETTING || {
    'utama': '🎯 Utama',
    'remidial': '🔄 Remidial',
    'pengayaan': '⭐ Pengayaan'
};

// ==================== LOAD EXAM LIST ====================
async function loadExamList(forceRefresh = false) {
    const tbody = document.getElementById('examListBody');
    if (!tbody) return;
    
    if (typeof examsRef === 'undefined') {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:red;">Error: examsRef tidak terdefinisi</td></tr>';
        return;
    }
    
    const now = Date.now();
    if (!forceRefresh && examCache && (now - lastExamFetch) < EXAM_CACHE_DURATION) {
        renderExamTable(examCache, tbody);
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Loading...</td></tr>';
    
    try {
        const snapshot = await examsRef.where('aktif', '==', true).get();
        const exams = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.kode) data.kode = 'ATS1';
            if (!data.kategori) data.kategori = 'utama';
            if (data.acak === undefined) data.acak = false;
            exams.push({ id: doc.id, ...data });
        });
        
        exams.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        
        examCache = exams;
        lastExamFetch = now;
        renderExamTable(exams, tbody);
        
    } catch (error) {
        console.error('Error loading exam list:', error);
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:red;">Error: ${error.message}</td></tr>`;
    }
}

// ==================== RENDER EXAM TABLE ====================
function renderExamTable(exams, tbody) {
    if (!exams || exams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Tidak ada ujian aktif</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    let no = 1;
    
    exams.forEach(exam => {
        const jml = exam.jumlahSoal || {};
        const totalSoal = (jml.pg || 0) + (jml.pgk || 0) + (jml.bs || 0);
        const totalNilai = exam.totalNilaiMaksimal?.keseluruhan || 0;
        
        const kode = exam.kode || 'ATS1';
        const kategori = exam.kategori || 'utama';
        const acakLabel = exam.acak === true ? '🔀 Ya' : '➡️ Urut';
        
        const kategoriLabel = window.KATEGORI_LABELS_SETTING[kategori] || kategori;
        
        const row = tbody.insertRow();
        row.insertCell(0).textContent = no++;
        row.insertCell(1).innerHTML = `<span style="background:#1e40af;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">${kode}</span>`;
        row.insertCell(2).textContent = exam.kelas || '-';
        row.insertCell(3).textContent = exam.mataPelajaran || '-';
        row.insertCell(4).innerHTML = `<span style="background:#f1f5f9;color:#334155;padding:3px 10px;border-radius:12px;font-size:11px;">${kategoriLabel}</span>`;
        row.insertCell(5).textContent = `${totalSoal} soal`;
        row.insertCell(6).textContent = totalNilai;
        row.insertCell(7).textContent = `${exam.durasi || 60} menit`;
        row.insertCell(8).textContent = acakLabel;
        row.insertCell(9).innerHTML = `
            <button onclick="deactivateExam('${exam.id}')" 
                    style="background:#dc3545;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;">
                🔴 Nonaktif
            </button>
        `;
    });
}

// ==================== DEACTIVATE ====================
async function deactivateExam(examId) {
    if (!confirm('Nonaktifkan ujian ini?')) return;
    
    try {
        await examsRef.doc(examId).update({
            aktif: false,
            deactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('✅ Ujian dinonaktifkan', 'success');
        loadExamList(true);
    } catch (error) {
        console.error('Error deactivating exam:', error);
        showToast('❌ Gagal menonaktifkan ujian', 'error');
    }
}

// ==================== FORM SUBMIT ====================
const examSettingForm = document.getElementById('examSettingForm');
if (examSettingForm) {
    examSettingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (typeof examsRef === 'undefined') {
            showToast('Error: examsRef tidak terdefinisi', 'error');
            return;
        }
        
        const kode = document.getElementById('settingKode')?.value || '';
        const kategori = document.getElementById('settingKategori')?.value || 'utama';
        const kelas = document.getElementById('settingKelas').value;
        const mapel = document.getElementById('settingMapel').value;
        const jmlPG = parseInt(document.getElementById('jmlPG').value) || 0;
        const jmlPGK = parseInt(document.getElementById('jmlPGK').value) || 0;
        const jmlBS = parseInt(document.getElementById('jmlBS').value) || 0;
        const nilaiPG = parseInt(document.getElementById('nilaiPG').value) || 5;
        const nilaiPGK = parseInt(document.getElementById('nilaiPGK').value) || 5;
        const nilaiBS = parseInt(document.getElementById('nilaiBS').value) || 5;
        const durasi = parseInt(document.getElementById('durasi').value) || 60;
        const acakForm = document.getElementById('settingAcak')?.checked || false;
        
        if (!kode) {
            showToast('Pilih Kode Ujian!', 'error');
            return;
        }
        
        if (kode === 'ASAJ') {
            const kelasNum = parseInt(kelas.charAt(0));
            if (kelasNum !== 6) {
                showToast('Kode ASAJ hanya untuk kelas 6!', 'error');
                return;
            }
        }
        
        if (!kelas || !mapel) {
            showToast('Pilih kelas dan mata pelajaran!', 'error');
            return;
        }
        
        if (jmlPG === 0 && jmlPGK === 0 && jmlBS === 0) {
            showToast('Minimal harus ada 1 soal!', 'error');
            return;
        }
        
        try {
            const examQuery = await examsRef
                .where('kode', '==', kode)
                .where('kategori', '==', kategori)
                .where('kelas', '==', kelas)
                .where('mataPelajaran', '==', mapel)
                .get();
            
            const totalNilaiPG = jmlPG * nilaiPG;
            const totalNilaiPGK = jmlPGK * nilaiPGK;
            const totalNilaiBS = jmlBS * nilaiBS;
            
            const examData = {
                kode: kode,
                kategori: kategori,
                kelas: kelas,
                mataPelajaran: mapel,
                jumlahSoal: { pg: jmlPG, pgk: jmlPGK, bs: jmlBS },
                nilaiPerSoal: { pg: nilaiPG, pgk: nilaiPGK, bs: nilaiBS },
                totalNilaiMaksimal: {
                    pg: totalNilaiPG,
                    pgk: totalNilaiPGK,
                    bs: totalNilaiBS,
                    keseluruhan: totalNilaiPG + totalNilaiPGK + totalNilaiBS
                },
                durasi: durasi,
                acak: acakForm,
                aktif: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const label = `${kode} - ${window.KATEGORI_LABELS_SETTING[kategori]}`;
            
            if (!examQuery.empty) {
                await examsRef.doc(examQuery.docs[0].id).update(examData);
                showToast(`✅ Setting ujian diupdate (${label})`, 'success');
            } else {
                examData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await examsRef.add(examData);
                showToast(`✅ Setting ujian disimpan (${label})`, 'success');
            }
            
            examSettingForm.reset();
            loadExamList(true);
            
        } catch (error) {
            console.error('Error saving exam setting:', error);
            showToast('❌ Gagal menyimpan: ' + error.message, 'error');
        }
    });
}

// ==================== AUTO DISABLE ASAJ untuk non-kelas 6 ====================
document.addEventListener('DOMContentLoaded', function() {
    const settingKelas = document.getElementById('settingKelas');
    const settingKode = document.getElementById('settingKode');
    
    if (settingKelas && settingKode) {
        settingKelas.addEventListener('change', function() {
            const kelasNum = parseInt(this.value?.charAt(0) || '0');
            const asajOption = settingKode.querySelector('option[value="ASAJ"]');
            
            if (asajOption) {
                if (kelasNum === 6) {
                    asajOption.disabled = false;
                    asajOption.textContent = '🎓 ASAJ (Asesmen Sumatif Akhir Jenjang)';
                } else {
                    asajOption.disabled = true;
                    asajOption.textContent = '🎓 ASAJ (Khusus Kelas 6)';
                    if (settingKode.value === 'ASAJ') {
                        settingKode.value = '';
                    }
                }
            }
        });
    }
});

// ==================== INIT ====================
if (document.getElementById('examListBody')) {
    setTimeout(() => loadExamList(), 500);
}

// ==================== TOAST ====================
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        if (type === 'error') alert(message);
        return;
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: white; padding: 12px 20px; border-radius: 8px;
        margin-bottom: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex; align-items: center; gap: 12px; min-width: 300px;
        border-left: 4px solid ${type === 'success' ? '#28a745' : '#dc3545'};
    `;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
