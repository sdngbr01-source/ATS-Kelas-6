// ============================================================
// dashboard-siswa.js - REBUILD 2025
// 3 Jenis Soal: PG, PGK (PG Kompleks), BS (Benar/Salah)
// ============================================================

const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
let currentExam = null;
let currentQuestions = [];
let currentAnswers = {};
let currentQuestionIndex = 0;
let timerInterval = null;

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
    
    loadSubjects();
});

// ==================== LOAD SUBJECTS ====================
async function loadSubjects() {
    const subjectList = document.getElementById('subjectList');
    if (!subjectList) return;
    
    subjectList.innerHTML = '<p>Loading...</p>';
    
    try {
        const examsSnapshot = await examsRef
            .where('kelas', '==', currentUser.kelas)
            .where('aktif', '==', true)
            .get();
        
        subjectList.innerHTML = '';
        
        if (examsSnapshot.empty) {
            subjectList.innerHTML = '<p>Tidak ada ujian tersedia</p>';
            return;
        }
        
        examsSnapshot.forEach(doc => {
            const exam = doc.data();
            const totalSoal = (exam.jumlahSoal?.pg || 0) + (exam.jumlahSoal?.pgk || 0) + (exam.jumlahSoal?.bs || 0);
            subjectList.innerHTML += `
                <div class="card" onclick="startExam('${doc.id}', '${exam.mataPelajaran || 'Ujian'}')">
                    <div class="card-icon">📚</div>
                    <h3>${exam.mataPelajaran || 'Mata Pelajaran'}</h3>
                    <p>${totalSoal} Soal</p>
                    <p>Durasi: ${exam.durasi || 60} menit</p>
                </div>
            `;
        });
        
    } catch (error) {
        console.error('Error loading subjects:', error);
        subjectList.innerHTML = '<p style="color: red;">Error loading data</p>';
    }
}

// ==================== START EXAM ====================
async function startExam(examId, subjectName) {
    try {
        const existingAnswer = await answersRef
            .where('examId', '==', examId)
            .where('siswaId', '==', currentUser.id)
            .limit(1)
            .get();
        
        if (!existingAnswer.empty) {
            alert('Anda sudah mengerjakan ujian ini!');
            return;
        }
        
        const examDoc = await examsRef.doc(examId).get();
        if (!examDoc.exists) {
            alert('Ujian tidak ditemukan');
            return;
        }
        
        currentExam = { id: examId, ...examDoc.data() };
        
        const questionsSnapshot = await questionsRef
            .where('kelas', '==', currentExam.kelas)
            .where('mataPelajaran', '==', currentExam.mataPelajaran)
            .get();
        
        let allQuestions = questionsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
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
        
        currentQuestions = [
            ...pgQuestions.slice(0, pgCount),
            ...pgkQuestions.slice(0, pgkCount),
            ...bsQuestions.slice(0, bsCount)
        ];
        
        if (currentQuestions.length === 0) {
            alert('Tidak ada soal yang sesuai konfigurasi ujian');
            return;
        }
        
        const nilaiSetting = currentExam.nilaiPerSoal || { pg: 5, pgk: 5, bs: 5 };
        currentQuestions = currentQuestions.map(q => {
            if (!q.nilai) {
                if (q.tipe === 'pg') q.nilai = nilaiSetting.pg;
                else if (q.tipe === 'pgk') q.nilai = nilaiSetting.pgk;
                else if (q.tipe === 'bs') q.nilai = nilaiSetting.bs;
            }
            return q;
        });
        
        currentAnswers = {};
        currentQuestionIndex = 0;
        
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('examPage').style.display = 'block';
        document.getElementById('examSubject').textContent = subjectName;
        
        startTimer((currentExam.durasi || 60) * 60);
        showQuestion();
        updateQuestionGrid();
        
    } catch (error) {
        console.error('Error starting exam:', error);
        alert('Gagal memulai ujian: ' + error.message);
    }
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
    
    if (question.tipe === 'pg') {
        html += renderPG(question);
    } else if (question.tipe === 'pgk') {
        html += renderPGK(question);
    } else if (question.tipe === 'bs') {
        html += renderBS(question);
    }
    
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

// ==================== RENDER PILIHAN GANDA ====================
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
            html += `<img src="${gambarUrl}" 
                    onclick="showOptionImage('${gambarUrl}', event)" 
                    onerror="this.style.display='none'">`;
        }
        html += `<span>${pilihanText}</span>`;
        html += `</div></div>`;
    }
    html += '</div>';
    return html;
}

// ==================== RENDER PG KOMPLEKS ====================
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
            html += `<img src="${gambarUrl}" 
                    onclick="showOptionImage('${gambarUrl}', event)" 
                    onerror="this.style.display='none'">`;
        }
        html += `<span>${pilihanText}</span>`;
        html += `</div></div>`;
    }
    html += '</div>';
    return html;
}

// ==================== RENDER BENAR/SALAH ====================
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
                    <button class="tf-btn" 
                            onclick="selectTrueFalse('${question.id}', ${idx}, 'B')"
                            style="border-color: ${jawabanItem === 'B' ? '#28a745' : '#ddd'}; 
                                   background: ${jawabanItem === 'B' ? '#28a745' : 'white'}; 
                                   color: ${jawabanItem === 'B' ? 'white' : '#333'};">
                        B
                    </button>
                    <button class="tf-btn" 
                            onclick="selectTrueFalse('${question.id}', ${idx}, 'S')"
                            style="border-color: ${jawabanItem === 'S' ? '#dc3545' : '#ddd'}; 
                                   background: ${jawabanItem === 'S' ? '#dc3545' : 'white'}; 
                                   color: ${jawabanItem === 'S' ? 'white' : '#333'};">
                        S
                    </button>
                </div>
            </div>
        `;
    });
    
    return html;
}

// ==================== HELPER ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== MODAL GAMBAR ====================
function showImageModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    if (modal && modalImg) {
        modal.style.display = 'flex';
        modalImg.src = imageUrl;
    }
}

function showOptionImage(imageUrl, event) {
    if (event) event.stopPropagation();
    showImageModal(imageUrl);
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) modal.style.display = 'none';
}

// ==================== HANDLER JAWABAN ====================
function selectOption(questionId, answer) {
    currentAnswers[questionId] = answer;
    showQuestion();
    updateQuestionGrid();
}

function toggleMultiOption(questionId, optionLetter) {
    if (!currentAnswers[questionId]) {
        currentAnswers[questionId] = [];
    }
    const answers = currentAnswers[questionId];
    const index = answers.indexOf(optionLetter);
    if (index === -1) {
        answers.push(optionLetter);
    } else {
        answers.splice(index, 1);
    }
    showQuestion();
    updateQuestionGrid();
}

function selectTrueFalse(questionId, pernyataanIndex, jawaban) {
    if (!currentAnswers[questionId]) {
        currentAnswers[questionId] = {};
    }
    currentAnswers[questionId][pernyataanIndex] = jawaban;
    showQuestion();
    updateQuestionGrid();
}

// ==================== NAVIGASI (FIXED) ====================
function goToQuestion(index) {
    if (index >= 0 && index < currentQuestions.length) {
        currentQuestionIndex = index;
        showQuestion();
        updateQuestionGrid();
    }
}

function nextQuestion() {
    goToQuestion(currentQuestionIndex + 1);
}

function prevQuestion() {
    goToQuestion(currentQuestionIndex - 1);
}

function jumpToQuestion(index) {
    goToQuestion(index);
}

// ==================== UPDATE GRID ====================
function updateQuestionGrid() {
    const grid = document.getElementById('questionGrid');
    if (!grid) return;
    
    let html = '';
    
    currentQuestions.forEach((question, index) => {
        const jawaban = currentAnswers[question.id];
        let isAnswered = false;
        
        if (jawaban !== undefined && jawaban !== '') {
            if (Array.isArray(jawaban)) {
                isAnswered = jawaban.length > 0;
            } else if (typeof jawaban === 'object' && jawaban !== null) {
                isAnswered = Object.keys(jawaban).length > 0;
            } else {
                isAnswered = true;
            }
        }
        
        const isCurrent = index === currentQuestionIndex;
        
        html += `
            <div class="question-grid-item ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}" 
                 onclick="jumpToQuestion(${index})">
                ${index + 1}
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// ==================== SUBMIT EXAM (AUTO KOREKSI) ====================
async function submitExam() {
    if (!confirm('Apakah Anda yakin ingin mengumpulkan jawaban?')) return;
    
    if (timerInterval) clearInterval(timerInterval);
    
    try {
        const examDoc = await examsRef.doc(currentExam.id).get();
        if (!examDoc.exists) {
            alert('Data ujian tidak ditemukan');
            return;
        }
        const examData = examDoc.data();
        
        const POIN_PER_SOAL = 5;
        const nilaiPGPerSoal = examData.nilaiPerSoal?.pg || POIN_PER_SOAL;
        const nilaiPGKPerSoal = examData.nilaiPerSoal?.pgk || POIN_PER_SOAL;
        const nilaiBSPerSoal = examData.nilaiPerSoal?.bs || POIN_PER_SOAL;
        
        const jawabanPG = {};
        const jawabanPGK = {};
        const jawabanBS = {};
        
        let nilaiPG = 0, nilaiPGK = 0, nilaiBS = 0;
        let jmlPG = 0, jmlPGK = 0, jmlBS = 0;
        const detailKoreksi = { pg: {}, pgk: {}, bs: {} };
        
        for (const question of currentQuestions) {
            const jawabanSiswa = currentAnswers[question.id];
            const tipe = question.tipe;
            
            if (tipe === 'pg') {
                jmlPG++;
                const jawabanStr = String(jawabanSiswa || '').trim().toUpperCase();
                const kunciStr = String(question.kunci || '').trim().toUpperCase();
                const benar = (jawabanStr !== '' && jawabanStr === kunciStr);
                const nilai = benar ? nilaiPGPerSoal : 0;
                nilaiPG += nilai;
                
                jawabanPG[question.id] = {
                    jawaban: jawabanStr,
                    kunci: kunciStr,
                    benar: benar,
                    nilai: nilai,
                    nomor: question.nomor,
                    soal: question.soal,
                    pilihan: question.pilihan || []
                };
                
                detailKoreksi.pg[question.id] = {
                    jawaban: jawabanStr,
                    kunci: kunciStr,
                    benar: benar,
                    nilai: nilai,
                    nilaiMaksimal: nilaiPGPerSoal
                };
            }
            else if (tipe === 'pgk') {
                jmlPGK++;
                const jawabanArr = Array.isArray(jawabanSiswa) ? jawabanSiswa : [];
                const kunciArr = Array.isArray(question.kunci) 
                    ? question.kunci 
                    : (typeof question.kunci === 'string' 
                        ? question.kunci.split(',').map(k => k.trim().toUpperCase()).filter(Boolean)
                        : []);
                
                const nilai = hitungNilaiPGK(jawabanArr, kunciArr, nilaiPGKPerSoal);
                nilaiPGK += nilai;
                
                jawabanPGK[question.id] = {
                    jawaban: jawabanArr,
                    kunci: kunciArr,
                    nilai: nilai,
                    nomor: question.nomor,
                    soal: question.soal,
                    pilihan: question.pilihan || []
                };
                
                detailKoreksi.pgk[question.id] = {
                    jawaban: jawabanArr,
                    kunci: kunciArr,
                    nilai: nilai,
                    nilaiMaksimal: nilaiPGKPerSoal
                };
            }
            else if (tipe === 'bs') {
                jmlBS++;
                const jawabanObj = jawabanSiswa || {};
                const pernyataanList = question.pernyataanBS || [];
                
                let benar = 0;
                const detailBS = [];
                
                pernyataanList.forEach((item, idx) => {
                    const jawabanItem = jawabanObj[idx] || '';
                    const kunciItem = (item.kunci || item.jawaban || '').toUpperCase();
                    const isBenar = (jawabanItem === kunciItem && jawabanItem !== '');
                    if (isBenar) benar++;
                    
                    detailBS.push({
                        pernyataan: item.text || item.pernyataan || '',
                        jawaban: jawabanItem,
                        kunci: kunciItem,
                        benar: isBenar
                    });
                });
                
                const totalPernyataan = pernyataanList.length;
                const nilai = totalPernyataan > 0 
                    ? (benar / totalPernyataan) * nilaiBSPerSoal 
                    : 0;
                nilaiBS += nilai;
                
                jawabanBS[question.id] = {
                    jawaban: jawabanObj,
                    pernyataan: pernyataanList,
                    benar: benar,
                    total: totalPernyataan,
                    nilai: nilai,
                    nomor: question.nomor,
                    soal: question.soal
                };
                
                detailKoreksi.bs[question.id] = {
                    jawaban: jawabanObj,
                    pernyataan: detailBS,
                    benar: benar,
                    totalPernyataan: totalPernyataan,
                    nilai: nilai,
                    nilaiMaksimal: nilaiBSPerSoal
                };
            }
        }
        
        const totalPG = jmlPG * nilaiPGPerSoal;
        const totalPGK = jmlPGK * nilaiPGKPerSoal;
        const totalBS = jmlBS * nilaiBSPerSoal;
        
        const jumlahNilaiDiperoleh = nilaiPG + nilaiPGK + nilaiBS;
        const jumlahNilaiMaksimal = totalPG + totalPGK + totalBS;
        
        let nilaiAkhir = 0;
        if (jumlahNilaiMaksimal > 0) {
            nilaiAkhir = Math.round((jumlahNilaiDiperoleh / jumlahNilaiMaksimal) * 100);
        }
        
        await answersRef.add({
            examId: currentExam.id,
            siswaId: currentUser.id,
            siswaNama: currentUser.nama,
            nis: currentUser.nis || '',
            kelas: currentUser.kelas,
            mataPelajaran: currentExam.mataPelajaran,
            
            jawabanPG: jawabanPG,
            jawabanPGK: jawabanPGK,
            jawabanBS: jawabanBS,
            
            nilaiPG: nilaiPG,
            nilaiPGK: nilaiPGK,
            nilaiBS: nilaiBS,
            totalPG: totalPG,
            totalPGK: totalPGK,
            totalBS: totalBS,
            
            detailKoreksi: detailKoreksi,
            jumlahSoal: { pg: jmlPG, pgk: jmlPGK, bs: jmlBS },
            nilaiAkhir: nilaiAkhir,
            
            statusKoreksi: 'selesai',
            waktu: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showResults(nilaiPG, nilaiPGK, nilaiBS, totalPG, totalPGK, totalBS, nilaiAkhir);
        
    } catch (error) {
        console.error('Error submitting exam:', error);
        alert('Gagal mengumpulkan jawaban: ' + error.message);
    }
}

// ==================== HITUNG NILAI PGK ====================
function hitungNilaiPGK(jawabanArr, kunciArr, nilaiMaks) {
    if (!jawabanArr || jawabanArr.length === 0) return 0;
    if (!kunciArr || kunciArr.length === 0) return 0;
    
    const jawaban = jawabanArr.map(j => String(j).toUpperCase().trim()).filter(Boolean);
    const kunci = kunciArr.map(k => String(k).toUpperCase().trim()).filter(Boolean);
    
    let B = 0;
    let S = 0;
    
    for (const j of jawaban) {
        if (kunci.includes(j)) {
            B++;
        } else {
            S++;
        }
    }
    
    const K = kunci.length;
    
    if (B === K && S === 0 && jawaban.length === K) {
        return nilaiMaks;
    }
    
    if (S >= 1 && B >= 1) {
        return 1;
    }
    
    if (B >= 1 && S === 0 && B < K) {
        return nilaiMaks / 2;
    }
    
    return 0;
}

// ==================== SHOW RESULTS ====================
function showResults(nilaiPG, nilaiPGK, nilaiBS, totalPG, totalPGK, totalBS, nilaiAkhir) {
    const examPage = document.getElementById('examPage');
    const resultPage = document.getElementById('resultPage');
    
    if (examPage) examPage.style.display = 'none';
    if (resultPage) resultPage.style.display = 'block';
    
    const el = (id) => document.getElementById(id);
    
    if (el('resultPG')) el('resultPG').textContent = nilaiPG + ' / ' + totalPG;
    if (el('resultPGK')) el('resultPGK').textContent = nilaiPGK + ' / ' + totalPGK;
    if (el('resultBS')) el('resultBS').textContent = nilaiBS + ' / ' + totalBS;
    if (el('resultTotal')) el('resultTotal').textContent = 
        (nilaiPG + nilaiPGK + nilaiBS) + ' / ' + (totalPG + totalPGK + totalBS);
    if (el('resultNilaiAkhir')) el('resultNilaiAkhir').textContent = nilaiAkhir;
}

// ==================== BACK TO MENU ====================
function backToMenu() {
    const resultPage = document.getElementById('resultPage');
    const mainMenu = document.getElementById('mainMenu');
    
    if (resultPage) resultPage.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'block';
    
    currentExam = null;
    currentQuestions = [];
    currentAnswers = {};
    currentQuestionIndex = 0;
    if (timerInterval) clearInterval(timerInterval);
    
    loadSubjects();
}

// ==================== LOGOUT ====================
function logout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}
