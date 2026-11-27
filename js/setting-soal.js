// ============================================================
// setting-soal.js - REBUILD 2025 (MULTI-KELAS)
// Setting ujian sekaligus untuk beberapa kelas
// ============================================================

let examCache = null;
let lastExamFetch = 0;
const EXAM_CACHE_DURATION = 30000;

// ==================== RENDER CHECKBOX KELAS (SETTING) ====================
async function renderSettingKelasCheckbox() {
    const container = document.getElementById('settingKelasCheckboxList');
    if (!container) return;

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
            console.error('Gagal load kelas untuk checkbox setting:', err);
        }
    }

    if (listKelas.length === 0) {
        container.innerHTML = '<em>Tidak ada kelas aktif</em>';
        return;
    }

    container.innerHTML = listKelas.map(k => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 4px;cursor:pointer;border-bottom:1px solid #f1f5f9;">
            <input type="checkbox" class="setting-kelas-checkbox" value="${escapeHtml(k.namaKelas)}"
                   style="width:18px;height:18px;cursor:pointer;">
            <span>${escapeHtml(k.namaKelas)} — Kelas ${k.tingkatan} SD</span>
        </label>
    `).join('');
}

// ==================== LOAD EXAM LIST ====================
async function loadExamList(forceRefresh = false) {
    const tbody = document.getElementById('examListBody');
    if (!tbody) return;

    if (typeof examsRef === 'undefined') {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:red;">Error: examsRef tidak terdefinisi</td></tr>';
        return;
    }

    const now = Date.now();
    if (!forceRefresh && examCache && (now - lastExamFetch) < EXAM_CACHE_DURATION) {
        renderExamTable(examCache, tbody);
        return;
    }

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading...</td></tr>';

    try {
        const snapshot = await examsRef.where('aktif', '==', true).get();
        const exams = [];
        snapshot.forEach(doc => exams.push({ id: doc.id, ...doc.data() }));
        exams.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

        examCache = exams;
        lastExamFetch = now;
        renderExamTable(exams, tbody);
    } catch (error) {
        console.error('Error loading exam list:', error);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;">Error: ${error.message}</td></tr>`;
    }
}

// ==================== RENDER EXAM TABLE ====================
function renderExamTable(exams, tbody) {
    if (!exams || exams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Tidak ada ujian aktif</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    let no = 1;

    exams.forEach(exam => {
        const jml = exam.jumlahSoal || {};
        const totalSoal = (jml.pg || 0) + (jml.pgk || 0) + (jml.bs || 0);
        const totalNilai = exam.totalNilaiMaksimal?.keseluruhan || 0;

        const row = tbody.insertRow();
        row.insertCell(0).textContent = no++;
        row.insertCell(1).textContent = exam.kelas || '-';
        row.insertCell(2).textContent = exam.mataPelajaran || '-';
        row.insertCell(3).textContent = `${totalSoal} soal (PG:${jml.pg||0}, PGK:${jml.pgk||0}, BS:${jml.bs||0})`;
        row.insertCell(4).textContent = totalNilai;
        row.insertCell(5).textContent = `${exam.durasi || 60} menit`;
        row.insertCell(6).innerHTML = '<span style="background:#28a745;color:white;padding:2px 8px;border-radius:12px;">✅ Aktif</span>';
        row.insertCell(7).innerHTML = `
            <button onclick="deactivateExam('${exam.id}')"
                    style="background:#dc3545;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">
                🔴 Nonaktifkan
            </button>`;
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

// ==================== FORM SUBMIT (MULTI-KELAS) ====================
const examSettingForm = document.getElementById('examSettingForm');
if (examSettingForm) {
    examSettingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (typeof examsRef === 'undefined') {
            showToast('Error: examsRef tidak terdefinisi', 'error');
            return;
        }

        // Ambil kelas terpilih
        const checkedBoxes = document.querySelectorAll('.setting-kelas-checkbox:checked');
        const selectedKelas = Array.from(checkedBoxes).map(cb => cb.value);
        const mapel = document.getElementById('settingMapel').value;

        const jmlPG = parseInt(document.getElementById('jmlPG').value) || 0;
        const jmlPGK = parseInt(document.getElementById('jmlPGK').value) || 0;
        const jmlBS = parseInt(document.getElementById('jmlBS').value) || 0;
        const nilaiPG = parseInt(document.getElementById('nilaiPG').value) || 5;
        const nilaiPGK = parseInt(document.getElementById('nilaiPGK').value) || 5;
        const nilaiBS = parseInt(document.getElementById('nilaiBS').value) || 5;
        const durasi = parseInt(document.getElementById('durasi').value) || 60;

        if (selectedKelas.length === 0 || !mapel) {
            showToast('Pilih minimal satu kelas dan mata pelajaran!', 'error');
            return;
        }
        if (jmlPG === 0 && jmlPGK === 0 && jmlBS === 0) {
            showToast('Minimal harus ada 1 soal!', 'error');
            return;
        }

        try {
            const totalNilaiPG = jmlPG * nilaiPG;
            const totalNilaiPGK = jmlPGK * nilaiPGK;
            const totalNilaiBS = jmlBS * nilaiBS;

            const baseData = {
                mataPelajaran: mapel,
                jumlahSoal: { pg: jmlPG, pgk: jmlPGK, bs: jmlBS },
                nilaiPerSoal: { pg: nilaiPG, pgk: nilaiPGK, bs: nilaiBS },
                totalNilaiMaksimal: {
                    pg: totalNilaiPG,
                    pgk: totalNilaiPGK,
                    bs: totalNilaiBS,
                    keseluruhan: totalNilaiPG + totalNilaiPGK + totalNilaiBS
                },
                durasi,
                aktif: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const results = [];

            for (const kelas of selectedKelas) {
                const examQuery = await examsRef
                    .where('kelas', '==', kelas)
                    .where('mataPelajaran', '==', mapel)
                    .get();

                if (!examQuery.empty) {
                    await examsRef.doc(examQuery.docs[0].id).update({
                        ...baseData,
                        kelas
                    });
                    results.push(`🔄 ${kelas}: diupdate`);
                } else {
                    await examsRef.add({
                        ...baseData,
                        kelas,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    results.push(`✅ ${kelas}: dibuat`);
                }
            }

            showToast(`Setting ujian disimpan untuk ${selectedKelas.length} kelas`, 'success');
            console.log('Setting ujian multi-kelas:', results);

            // Reset form
            examSettingForm.reset();
            document.querySelectorAll('.setting-kelas-checkbox').forEach(cb => cb.checked = false);

            loadExamList(true);
        } catch (error) {
            console.error('Error saving exam setting:', error);
            showToast('❌ Gagal menyimpan: ' + error.message, 'error');
        }
    });
}

// ==================== INIT ====================
if (document.getElementById('examListBody')) {
    setTimeout(() => {
        loadExamList();
        renderSettingKelasCheckbox();
    }, 500);
}

// expose
window.renderSettingKelasCheckbox = renderSettingKelasCheckbox;

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