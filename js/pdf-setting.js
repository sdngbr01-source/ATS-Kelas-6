// pdf-setting.js
// Generate Rapor PDF - 1 File = 1 Kelas (1 Halaman = 1 Siswa)
// Default KOP: SDN Gambirono 01 - Jember

// ==================== KONSTANTA ====================
const PDF_SETTING_KEY = 'pdf_header_setting';
const KKM_DEFAULT = 70;

// ==================== DEFAULT KOP ====================
const DEFAULT_KOP = {
    sekolahNama: 'PEMERINTAH KABUPATEN JEMBER\nSEKOLAH DASAR NEGERI GAMBIRONO 01',
    sekolahAlamat: 'Jl. Moch. Seruji No. 161 Gambirono Kecamatan Bangsalsari\nKabupaten Jember Propinsi Jawa Timur Kodepos : 68154',
    sekolahKota: 'Jember',
    sekolahTelp: '089521255360',
    sekolahEmail: 'sdn.gbr01@gmail.com',
    sekolahMotto: 'Whatsapp : 089521255360 | Pos El : sdn.gbr01@gmail.com | Laman: https://sdn-gambirono-01-web.vercel.app/',
    headerWarna: '#2c3e50',
    logoWidth: 40,
    logoHeight: 40,
    logoKiriData: '',
    logoKananData: ''
};

// ==================== HELPER ====================
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) console.warn(`Element dengan id "${id}" tidak ditemukan`);
    return element;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toastContainer = getElement('toastContainer');
    if (!toastContainer) {
        if (type === 'error') alert(message);
        else console.log(message);
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function getWaktuValue(data) {
    if (!data || !data.waktu) return null;
    if (data.waktu instanceof Date) return data.waktu;
    if (data.waktu.toDate && typeof data.waktu.toDate === 'function') return data.waktu.toDate();
    if (typeof data.waktu === 'string') {
        const parsed = new Date(data.waktu);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof data.waktu === 'number') return new Date(data.waktu);
    return null;
}

// ==================== KOMPRES GAMBAR ====================
async function compressImage(file, maxWidth = 200, maxHeight = 200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    } else {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                const sizeInBytes = Math.round((compressedDataUrl.length * 3) / 4);
                console.log(`Ukuran gambar setelah kompresi: ${(sizeInBytes / 1024).toFixed(2)} KB`);
                if (sizeInBytes > 800000) {
                    resolve(canvas.toDataURL('image/jpeg', 0.5));
                } else {
                    resolve(compressedDataUrl);
                }
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// ==================== HANDLE LOGO UPLOAD ====================
async function handleLogoUpload(position, input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.match('image.*')) {
        showToast('Hanya file gambar yang diperbolehkan!', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file maksimal 5MB!', 'error');
        return;
    }
    showToast('📸 Memproses gambar...', 'info');
    try {
        const compressedBase64 = await compressImage(file, 150, 150, 0.7);
        const sizeInBytes = Math.round((compressedBase64.length * 3) / 4);
        if (sizeInBytes > 900000) {
            showToast('Gambar masih terlalu besar setelah kompresi', 'error');
            return;
        }
        if (position === 'kiri') {
            const dataInput = getElement('logoKiriData');
            if (dataInput) dataInput.value = compressedBase64;
            const img = getElement('logoKiriImg');
            if (img) {
                img.src = compressedBase64;
                img.style.display = 'block';
            }
        } else {
            const dataInput = getElement('logoKananData');
            if (dataInput) dataInput.value = compressedBase64;
            const img = getElement('logoKananImg');
            if (img) {
                img.src = compressedBase64;
                img.style.display = 'block';
            }
        }
        updatePdfPreview();
        showToast(`Logo ${position === 'kiri' ? 'kiri' : 'kanan'} berhasil diupload`, 'success');
    } catch (error) {
        console.error('Error compressing image:', error);
        showToast('Gagal memproses gambar', 'error');
    }
}

// ==================== PREVIEW HEADER ====================
function updatePdfPreview() {
    const previewDiv = getElement('pdfPreview');
    if (!previewDiv) return;
    const sekolahNama = getElement('sekolahNama')?.value || 'Nama Sekolah';
    const sekolahAlamat = getElement('sekolahAlamat')?.value || 'Alamat Sekolah';
    const sekolahKota = getElement('sekolahKota')?.value || '';
    const sekolahTelp = getElement('sekolahTelp')?.value || '';
    const sekolahEmail = getElement('sekolahEmail')?.value || '';
    const sekolahMotto = getElement('sekolahMotto')?.value || '';
    const headerWarna = getElement('headerWarna')?.value || '#2c3e50';
    const logoWidth = getElement('logoWidth')?.value || 40;
    const logoHeight = getElement('logoHeight')?.value || 40;
    const logoKiriData = getElement('logoKiriData')?.value || '';
    const logoKananData = getElement('logoKananData')?.value || '';
    previewDiv.innerHTML = `
        <div style="background: ${headerWarna}; color: white; padding: 15px; border-radius: 5px; text-align: center;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px;">
                ${logoKiriData ? `<img src="${logoKiriData}" style="width: ${logoWidth}px; height: ${logoHeight}px; object-fit: contain;">` : '<div style="width: 40px;"></div>'}
                <div style="flex: 1;">
                    <div style="font-size: 16px; font-weight: bold; white-space: pre-line;">${escapeHtml(sekolahNama)}</div>
                    <div style="font-size: 12px; white-space: pre-line;">${escapeHtml(sekolahAlamat)}</div>
                    ${sekolahKota ? `<div style="font-size: 11px;">${escapeHtml(sekolahKota)}</div>` : ''}
                    <div style="font-size: 10px; margin-top: 5px;">
                        ${sekolahTelp ? `Telp: ${escapeHtml(sekolahTelp)} | ` : ''}
                        ${sekolahEmail ? `Email: ${escapeHtml(sekolahEmail)}` : ''}
                    </div>
                    ${sekolahMotto ? `<div style="font-size: 11px; font-style: italic; margin-top: 5px; white-space: pre-line;">${escapeHtml(sekolahMotto)}</div>` : ''}
                </div>
                ${logoKananData ? `<img src="${logoKananData}" style="width: ${logoWidth}px; height: ${logoHeight}px; object-fit: contain;">` : '<div style="width: 40px;"></div>'}
            </div>
        </div>
    `;
}

// ==================== SIMPAN SETTING PDF ====================
const pdfSettingForm = getElement('pdfSettingForm');
if (pdfSettingForm) {
    pdfSettingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const setting = {
            sekolahNama: getElement('sekolahNama')?.value || '',
            sekolahAlamat: getElement('sekolahAlamat')?.value || '',
            sekolahKota: getElement('sekolahKota')?.value || '',
            sekolahTelp: getElement('sekolahTelp')?.value || '',
            sekolahEmail: getElement('sekolahEmail')?.value || '',
            sekolahMotto: getElement('sekolahMotto')?.value || '',
            headerWarna: getElement('headerWarna')?.value || '#2c3e50',
            logoWidth: getElement('logoWidth')?.value || 40,
            logoHeight: getElement('logoHeight')?.value || 40,
            logoKiriData: getElement('logoKiriData')?.value || '',
            logoKananData: getElement('logoKananData')?.value || '',
            updatedAt: new Date().toISOString()
        };
        try {
            localStorage.setItem(PDF_SETTING_KEY, JSON.stringify(setting));
            if (typeof db !== 'undefined' && db) {
                const settingWithoutLogo = {
                    sekolahNama: setting.sekolahNama,
                    sekolahAlamat: setting.sekolahAlamat,
                    sekolahKota: setting.sekolahKota,
                    sekolahTelp: setting.sekolahTelp,
                    sekolahEmail: setting.sekolahEmail,
                    sekolahMotto: setting.sekolahMotto,
                    headerWarna: setting.headerWarna,
                    logoWidth: setting.logoWidth,
                    logoHeight: setting.logoHeight,
                    hasLogoKiri: !!setting.logoKiriData,
                    hasLogoKanan: !!setting.logoKananData,
                    updatedAt: setting.updatedAt
                };
                await db.collection('settings').doc('pdfHeader').set(settingWithoutLogo, { merge: true });
            }
            showToast('✅ Setting PDF berhasil disimpan!', 'success');
        } catch (error) {
            console.error('Error saving PDF setting:', error);
            showToast('❌ Gagal menyimpan setting PDF', 'error');
        }
    });
}

// ==================== LOAD SETTING PDF ====================
async function loadPdfSetting() {
    try {
        let setting = null;
        const localSetting = localStorage.getItem(PDF_SETTING_KEY);
        if (localSetting) setting = JSON.parse(localSetting);
        if (typeof db !== 'undefined' && db) {
            try {
                const doc = await db.collection('settings').doc('pdfHeader').get();
                if (doc.exists) {
                    const firestoreData = doc.data();
                    setting = setting ? { ...setting, ...firestoreData } : firestoreData;
                }
            } catch (err) {
                console.warn('Gagal load dari Firestore:', err);
            }
        }
        if (setting) {
            const fields = ['sekolahNama', 'sekolahAlamat', 'sekolahKota', 'sekolahTelp', 'sekolahEmail', 'sekolahMotto'];
            fields.forEach(f => {
                const el = getElement(f);
                if (el) el.value = setting[f] || '';
            });
            const headerWarna = getElement('headerWarna');
            if (headerWarna) headerWarna.value = setting.headerWarna || '#2c3e50';
            const logoWidth = getElement('logoWidth');
            if (logoWidth) logoWidth.value = setting.logoWidth || 40;
            const logoHeight = getElement('logoHeight');
            if (logoHeight) logoHeight.value = setting.logoHeight || 40;
            if (setting.logoKiriData) {
                const d = getElement('logoKiriData');
                if (d) d.value = setting.logoKiriData;
                const img = getElement('logoKiriImg');
                if (img) { img.src = setting.logoKiriData; img.style.display = 'block'; }
            }
            if (setting.logoKananData) {
                const d = getElement('logoKananData');
                if (d) d.value = setting.logoKananData;
                const img = getElement('logoKananImg');
                if (img) { img.src = setting.logoKananData; img.style.display = 'block'; }
            }
            updatePdfPreview();
        } else {
            resetPdfSetting();
        }
    } catch (error) {
        console.error('Error loading PDF setting:', error);
        resetPdfSetting();
    }
}

// ==================== RESET SETTING PDF ====================
function resetPdfSetting() {
    const defaults = {
        sekolahNama: DEFAULT_KOP.sekolahNama,
        sekolahAlamat: DEFAULT_KOP.sekolahAlamat,
        sekolahKota: DEFAULT_KOP.sekolahKota,
        sekolahTelp: DEFAULT_KOP.sekolahTelp,
        sekolahEmail: DEFAULT_KOP.sekolahEmail,
        sekolahMotto: DEFAULT_KOP.sekolahMotto
    };
    Object.keys(defaults).forEach(k => {
        const el = getElement(k);
        if (el) el.value = defaults[k];
    });
    const headerWarna = getElement('headerWarna');
    if (headerWarna) headerWarna.value = DEFAULT_KOP.headerWarna;
    const logoWidth = getElement('logoWidth');
    if (logoWidth) logoWidth.value = DEFAULT_KOP.logoWidth;
    const logoHeight = getElement('logoHeight');
    if (logoHeight) logoHeight.value = DEFAULT_KOP.logoHeight;
    const lk = getElement('logoKiriData');
    if (lk) lk.value = '';
    const rk = getElement('logoKananData');
    if (rk) rk.value = '';
    const lki = getElement('logoKiriImg');
    if (lki) lki.style.display = 'none';
    const rki = getElement('logoKananImg');
    if (rki) rki.style.display = 'none';
    updatePdfPreview();
    showToast('Setting direset ke default SDN Gambirono 01', 'info');
}

// ==================== GET PDF SETTING ====================
function getPdfSetting() {
    try {
        let setting = localStorage.getItem(PDF_SETTING_KEY);
        if (setting) {
            setting = JSON.parse(setting);
            console.log('✅ Setting PDF dari localStorage:', setting.sekolahNama);
            return setting;
        }
        return { ...DEFAULT_KOP };
    } catch (error) {
        console.error('Error getPdfSetting:', error);
        return { ...DEFAULT_KOP };
    }
}

// ==================== STATUS NILAI ====================
function getStatusNilai(nilai, kkm = KKM_DEFAULT) {
    if (nilai < kkm) {
        return { text: 'Remidial', warna: [220, 53, 69] };
    }
    return { text: 'Pengayaan', warna: [40, 167, 69] };
}

// ==================== GENERATE RAPOR (1 FILE = 1 KELAS) ====================
async function generateLembarJawaban() {
    const kelas = getElement('generateKelas')?.value;
    const mapelFilter = getElement('generateMapel')?.value;
    
    if (!kelas) {
        showToast('Pilih kelas terlebih dahulu!', 'error');
        return;
    }
    
    if (typeof usersRef === 'undefined' || typeof answersRef === 'undefined') {
        showToast('Data siswa tidak tersedia', 'error');
        return;
    }
    
    try {
        showToast('📄 Mengambil data siswa...', 'info');
        
        // 1. Ambil semua siswa di kelas
        const siswaSnapshot = await usersRef
            .where('kelas', '==', kelas)
            .where('role', '==', 'siswa')
            .get();
        
        if (siswaSnapshot.empty) {
            showToast('Tidak ada siswa di kelas ini', 'error');
            return;
        }
        
        // 2. Ambil semua jawaban untuk kelas ini
        const semuaJawabanSnapshot = await answersRef
            .where('kelas', '==', kelas)
            .get();
        
        // 3. Group jawaban by siswaId + mapel (ambil terbaru)
        const nilaiMap = new Map();
        semuaJawabanSnapshot.forEach(doc => {
            const data = doc.data();
            if (!data.siswaId || !data.mataPelajaran) return;
            const key = `${data.siswaId}__${data.mataPelajaran}`;
            const currentWaktu = getWaktuValue(data);
            const existing = nilaiMap.get(key);
            const existingWaktu = existing ? getWaktuValue(existing) : null;
            if (!nilaiMap.has(key) ||
                (currentWaktu && existingWaktu && currentWaktu > existingWaktu) ||
                (currentWaktu && !existingWaktu)) {
                nilaiMap.set(key, data);
            }
        });
        
        // 4. Ambil data wali kelas
        let waliKelasNama = '';
        try {
            if (typeof db !== 'undefined' && db) {
                const kelasSnap = await db.collection('kelas')
                    .where('namaKelas', '==', kelas)
                    .limit(1)
                    .get();
                if (!kelasSnap.empty) {
                    waliKelasNama = kelasSnap.docs[0].data().waliKelas || '';
                }
            }
        } catch (e) {
            console.warn('Gagal ambil wali kelas:', e);
        }
        
        // 5. Susun data per siswa
        const siswaList = [];
        siswaSnapshot.forEach(doc => {
            const siswa = { id: doc.id, ...doc.data() };
            const nilaiPerMapel = [];
            nilaiMap.forEach((nilai) => {
                if (nilai.siswaId === siswa.id) {
                    nilaiPerMapel.push({
                        mapel: nilai.mataPelajaran,
                        nilaiAkhir: Math.round(nilai.nilaiAkhir || 0)
                    });
                }
            });
            nilaiPerMapel.sort((a, b) => a.mapel.localeCompare(b.mapel, 'id', { sensitivity: 'base' }));
            siswaList.push({ ...siswa, nilaiPerMapel, waliKelas: waliKelasNama });
        });
        
        // 6. Sort siswa A-Z
        siswaList.sort((a, b) =>
            (a.nama || '').toString().localeCompare((b.nama || '').toString(), 'id', { sensitivity: 'base' })
        );
        
        // 7. Filter mapel (jika dipilih)
        if (mapelFilter) {
            siswaList.forEach(s => {
                s.nilaiPerMapel = s.nilaiPerMapel.filter(n => n.mapel === mapelFilter);
            });
        }
        
        const totalSiswa = siswaList.length;
        if (totalSiswa === 0) {
            showToast('Tidak ada data siswa untuk diproses', 'error');
            return;
        }
        
        showToast(`📄 Membuat 1 file PDF dengan ${totalSiswa} halaman...`, 'info');
        
        // 8. Generate SATU file PDF untuk semua siswa
        const setting = getPdfSetting();
        await generateRaporKelasPDF(siswaList, kelas, setting, mapelFilter);
        
        showToast(`✅ Berhasil generate 1 file PDF (${totalSiswa} halaman)`, 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('❌ Gagal generate PDF: ' + error.message, 'error');
    }
}

// ==================== FUNGSI UTAMA: GENERATE 1 FILE = 1 KELAS ====================
async function generateRaporKelasPDF(siswaList, kelas, setting, mapelFilter) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const totalSiswa = siswaList.length;
    const now = new Date();
    
    // Loop setiap siswa — 1 siswa = 1 halaman
    for (let idx = 0; idx < totalSiswa; idx++) {
        const siswa = siswaList[idx];
        
        // Tambah halaman baru untuk siswa ke-2 dan seterusnya
        if (idx > 0) {
            doc.addPage();
        }
        
        // ============ KOP SURAT ============
        const headerHeight = 40;
        const headerWarna = setting.headerWarna || '#2c3e50';
        
        doc.setFillColor(
            parseInt(headerWarna.slice(1, 3), 16),
            parseInt(headerWarna.slice(3, 5), 16),
            parseInt(headerWarna.slice(5, 7), 16)
        );
        doc.rect(0, 0, 210, headerHeight, 'F');
        
        const logoWidth = (parseInt(setting.logoWidth) || 40) / 1.6;
        const logoHeight = (parseInt(setting.logoHeight) || 40) / 1.6;
        const logoY = (headerHeight - logoHeight) / 2;
        
        if (setting.logoKiriData && setting.logoKiriData.startsWith('data:image')) {
            try {
                doc.addImage(setting.logoKiriData, 'JPEG', 8, logoY, logoWidth, logoHeight);
            } catch (e) { console.warn('Logo kiri gagal:', e); }
        }
        
        if (setting.logoKananData && setting.logoKananData.startsWith('data:image')) {
            try {
                doc.addImage(setting.logoKananData, 'JPEG', 210 - 8 - logoWidth, logoY, logoWidth, logoHeight);
            } catch (e) { console.warn('Logo kanan gagal:', e); }
        }
        
        doc.setTextColor(255, 255, 255);
        
        const namaLines = (setting.sekolahNama || '').split('\n');
        let textY = 9;
        
        namaLines.forEach((line, i) => {
            if (i === 0) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(line.trim(), 105, textY, { align: 'center' });
                textY += 5;
            } else {
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.text(line.trim(), 105, textY, { align: 'center' });
                textY += 5;
            }
        });
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        const alamatLines = (setting.sekolahAlamat || '').split('\n');
        alamatLines.forEach(line => {
            if (line.trim()) {
                doc.text(line.trim(), 105, textY, { align: 'center' });
                textY += 3.2;
            }
        });
        
        if (setting.sekolahTelp || setting.sekolahEmail) {
            doc.setFontSize(6.5);
            doc.text(`Telp: ${setting.sekolahTelp || '-'} | Email: ${setting.sekolahEmail || '-'}`, 105, textY, { align: 'center' });
            textY += 3;
        }
        
        if (setting.sekolahMotto && setting.sekolahMotto.trim()) {
            doc.setFontSize(6);
            doc.setFont('helvetica', 'italic');
            const mottoLines = setting.sekolahMotto.split('\n');
            for (const line of mottoLines) {
                if (line.trim()) {
                    doc.text(line.trim(), 105, textY, { align: 'center' });
                    textY += 2.8;
                }
            }
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.line(10, headerHeight - 1, 200, headerHeight - 1);
        
        // ============ JUDUL RAPOR ============
        let yPos = headerHeight + 8;
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('RAPOR HASIL ASSESSMENT', 105, yPos, { align: 'center' });
        yPos += 6;
        doc.setFontSize(11);
        doc.text('TENGAH SEMESTER GANJIL', 105, yPos, { align: 'center' });
        yPos += 4;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun Pelajaran: ${now.getFullYear()}/${now.getFullYear() + 1}`, 105, yPos, { align: 'center' });
        
        // Nomor urut siswa di kanan atas
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Halaman ${idx + 1} / ${totalSiswa}`, 195, headerHeight + 6, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        
        yPos += 6;
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.line(15, yPos, 195, yPos);
        doc.setLineWidth(0.2);
        yPos += 8;
        
        // ============ INFO SISWA ============
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        const infoLabelX = 20;
        const infoColonX = 60;
        const infoValueX = 65;
        
        doc.text('Nama', infoLabelX, yPos);
        doc.text(':', infoColonX, yPos);
        doc.setFont('helvetica', 'bold');
        doc.text(siswa.nama || '-', infoValueX, yPos);
        
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        doc.text('NISN / NIS', infoLabelX, yPos);
        doc.text(':', infoColonX, yPos);
        doc.text(siswa.nis || siswa.nisn || '-', infoValueX, yPos);
        
        yPos += 6;
        doc.text('Kelas', infoLabelX, yPos);
        doc.text(':', infoColonX, yPos);
        doc.text(kelas, infoValueX, yPos);
        
        yPos += 10;
        
        // ============ TABEL NILAI ============
        const tableData = [];
        let totalNilai = 0;
        let jumlahMapel = 0;
        
        if (siswa.nilaiPerMapel.length === 0) {
            tableData.push(['-', '-', 'Belum ada nilai']);
        } else {
            siswa.nilaiPerMapel.forEach(item => {
                const nilai = item.nilaiAkhir || 0;
                const status = getStatusNilai(nilai);
                tableData.push([item.mapel, String(nilai), status.text]);
                totalNilai += nilai;
                jumlahMapel++;
            });
        }
        
        const rataRata = jumlahMapel > 0 ? Math.round(totalNilai / jumlahMapel) : 0;
        
        doc.autoTable({
            startY: yPos,
            head: [['Mata Pelajaran', 'Nilai', 'Keterangan']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [52, 73, 94],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 10,
                valign: 'middle'
            },
            columnStyles: {
                0: { cellWidth: 100, halign: 'left', valign: 'middle', fontSize: 9 },
                1: { cellWidth: 30, halign: 'center', valign: 'middle', fontSize: 10, fontStyle: 'bold' },
                2: { cellWidth: 50, halign: 'center', valign: 'middle', fontSize: 9 }
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
                lineColor: [180, 180, 180],
                overflow: 'linebreak',
                valign: 'middle'
            },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 15, right: 15 },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 2) {
                    const val = data.cell.raw;
                    if (val === 'Remidial') {
                        data.cell.styles.textColor = [220, 53, 69];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (val === 'Pengayaan') {
                        data.cell.styles.textColor = [40, 167, 69];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });
        
        yPos = doc.lastAutoTable.finalY + 8;
        
        // ============ TOTAL NILAI & RATA-RATA ============
        doc.setFillColor(240, 240, 240);
        doc.rect(15, yPos - 3, 180, 12, 'F');
        doc.setDrawColor(100, 100, 100);
        doc.rect(15, yPos - 3, 180, 12, 'S');
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('TOTAL NILAI', 22, yPos + 5);
        doc.text(':', 75, yPos + 5);
        doc.setFontSize(12);
        doc.text(String(totalNilai), 82, yPos + 5);
        
        doc.setFontSize(10);
        doc.text('RATA-RATA', 110, yPos + 5);
        doc.text(':', 150, yPos + 5);
        doc.setFontSize(12);
        doc.text(String(rataRata), 158, yPos + 5);
        
        yPos += 18;
        
        // ============ CATATAN ============
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('CATATAN:', 15, yPos);
        yPos += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        
        const catatanLines = [
            `• Nilai < ${KKM_DEFAULT} = Remidial, Nilai ≥ ${KKM_DEFAULT} = Pengayaan`,
            `• Siswa wajib mengikuti Remidial untuk sampai kepada KKM`,
            `• Pengayaan bersifat opsional, bisa mengikuti atau tidak`
        ];
        
        catatanLines.forEach(line => {
            doc.text(line, 15, yPos);
            yPos += 4.5;
        });
        
        yPos += 12;
        
        // ============ TANDA TANGAN ============
        const tglCetak = now.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${setting.sekolahKota || 'Jember'}, ${tglCetak}`, 130, yPos);
        yPos += 6;
        
        doc.text('Wali Kelas', 30, yPos);
        doc.text('Orang Tua/Wali', 140, yPos);
        
        yPos += 25;
        
        doc.setFont('helvetica', 'bold');
        const waliNama = siswa.waliKelas || '_________________________';
        doc.text(waliNama, 30, yPos);
        doc.setFont('helvetica', 'normal');
        
        doc.text('_________________________', 140, yPos);
        
        yPos += 5;
        doc.setFontSize(8);
        doc.text('NIP. ___________________', 30, yPos);
    }
    
    // ============ FOOTER SEMUA HALAMAN ============
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(128, 128, 128);
        doc.setFont('helvetica', 'italic');
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 105, 287, { align: 'center' });
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(15, 285, 195, 285);
    }
    
    // ============ SIMPAN SATU FILE ============
    const namaFile = `Rapor_Kelas_${kelas}${mapelFilter ? '_' + mapelFilter : ''}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(namaFile);
}

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        if (typeof loadPdfSetting === 'function') loadPdfSetting();
    }, 500);
});

// ==================== EXPORT KE WINDOW ====================
if (typeof window !== 'undefined') {
    window.handleLogoUpload = handleLogoUpload;
    window.loadPdfSetting = loadPdfSetting;
    window.resetPdfSetting = resetPdfSetting;
    window.generateLembarJawaban = generateLembarJawaban;
    window.downloadLaporanKelas = downloadLaporanKelas;
    window.updatePdfPreview = updatePdfPreview;
}
