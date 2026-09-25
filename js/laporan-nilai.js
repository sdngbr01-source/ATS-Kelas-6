// ==================== DOWNLOAD LAPORAN EXCEL ====================

// laporan-nilai.js
// Download laporan per kelas (Excel) - Format PG, PGK, BS + Sorting A-Z

async function downloadLaporanKelas() {
    const kelas = document.getElementById('laporanKelas').value;
    const mapel = document.getElementById('laporanMapel').value;
    
    if (!kelas || !mapel) {
        alert('Pilih kelas dan mata pelajaran!');
        return;
    }
    
    try {
        // Ambil data jawaban
        const snapshot = await answersRef
            .where('kelas', '==', kelas)
            .where('mataPelajaran', '==', mapel)
            .get();
        
        if (snapshot.empty) {
            alert('Tidak ada data untuk kelas dan mapel ini');
            return;
        }
        
        // Fungsi helper untuk mendapatkan nilai waktu (timestamp atau date)
        function getWaktuValue(data) {
            if (!data.waktu) return null;
            
            if (data.waktu instanceof Date) return data.waktu;
            
            if (data.waktu.toDate && typeof data.waktu.toDate === 'function') {
                return data.waktu.toDate();
            }
            
            if (typeof data.waktu === 'string') {
                const parsed = new Date(data.waktu);
                return isNaN(parsed.getTime()) ? null : parsed;
            }
            
            if (typeof data.waktu === 'number') {
                return new Date(data.waktu);
            }
            
            return null;
        }
        
        // Group by siswa (ambil data terbaru)
        const nilaiMap = new Map();
        snapshot.forEach(doc => {
            const nilai = doc.data();
            const key = nilai.siswaId;
            
            const currentWaktu = getWaktuValue(nilai);
            const existing = nilaiMap.get(key);
            const existingWaktu = existing ? getWaktuValue(existing) : null;
            
            if (!nilaiMap.has(key) || 
                (currentWaktu && existingWaktu && currentWaktu > existingWaktu) ||
                (currentWaktu && !existingWaktu)) {
                nilaiMap.set(key, nilai);
            }
        });
        
        // ✅ SORTING ALFABETIS berdasarkan nama siswa (A-Z)
        const sortedNilai = Array.from(nilaiMap.values()).sort((a, b) => 
            (a.siswaNama || '').toString().localeCompare(
                (b.siswaNama || '').toString(),
                'id',
                { numeric: true, sensitivity: 'base' }
            )
        );
        
        // Siapkan data untuk Excel (format baru: PG, PGK, BS)
        const excelData = [[
            'No', 'NIS', 'Nama Siswa', 'Kelas', 'Mata Pelajaran',
            'Nilai PG', 'Nilai PGK', 'Nilai BS', 'Nilai Akhir', 'Status'
        ]];
        let no = 1;
        
        for (const nilai of sortedNilai) {
            // Ambil nilai per tipe
            let nilaiPG = nilai.nilaiPG || 0;
            let nilaiPGK = nilai.nilaiPGK || 0;
            let nilaiBS = nilai.nilaiBS || 0;
            
            const nilaiAkhir = nilai.nilaiAkhir || 0;
            
            let statusText = '';
            if (nilai.statusKoreksi === 'pending') {
                statusText = 'Menunggu Koreksi';
            } else {
                statusText = 'Selesai';
            }
            
            excelData.push([
                no++,
                nilai.nis || '-',
                nilai.siswaNama || '-',
                nilai.kelas || '-',
                nilai.mataPelajaran || '-',
                nilaiPG,
                nilaiPGK,
                nilaiBS,
                nilaiAkhir,
                statusText
            ]);
        }
        
        // Buat Excel file
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Atur lebar kolom
        ws['!cols'] = [
            { wch: 5 },   // No
            { wch: 12 },  // NIS
            { wch: 25 },  // Nama Siswa
            { wch: 10 },  // Kelas
            { wch: 20 },  // Mata Pelajaran
            { wch: 12 },  // Nilai PG
            { wch: 12 },  // Nilai PGK
            { wch: 12 },  // Nilai BS
            { wch: 12 },  // Nilai Akhir
            { wch: 18 }   // Status
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Laporan Nilai');
        XLSX.writeFile(wb, `Laporan_Nilai_${kelas}_${mapel}_${new Date().toISOString().slice(0,10)}.xlsx`);
        
        alert('Laporan berhasil didownload!\nTotal data: ' + (no-1) + ' siswa');
        
    } catch (error) {
        console.error('Error downloading laporan:', error);
        alert('Gagal mendownload laporan: ' + error.message);
    }
}

// ==================== GENERATE PDF LEMBAR JAWABAN ====================
async function generatePDFSiswa(siswa, jawaban, mapel) {
    return new Promise(async (resolve, reject) => {
        try {
            const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
            if (!JsPDF) {
                reject(new Error('jsPDF library not loaded'));
                return;
            }
            
            const headerSetting = getPdfSetting();
            const doc = new JsPDF();
            let yPos = 15;
            
            // Header dengan logo
            if (headerSetting.logoKiriUrl) {
                try {
                    doc.addImage(headerSetting.logoKiriUrl, 'JPEG', 15, yPos, 25, 25);
                } catch (e) {}
            }
            
            if (headerSetting.logoKananUrl) {
                try {
                    doc.addImage(headerSetting.logoKananUrl, 'JPEG', 170, yPos, 25, 25);
                } catch (e) {}
            }
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(headerSetting.headerWarna || '#2c3e50');
            
            const namaSekolahLines = (headerSetting.sekolahNama || '').split('\n');
            let currentY = yPos + 8;
            for (const line of namaSekolahLines) {
                if (line.trim()) {
                    doc.text(line.trim(), 105, currentY, { align: 'center' });
                    currentY += 5;
                }
            }
            
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            const alamatLines = (headerSetting.sekolahAlamat || '').split('\n');
            for (const line of alamatLines) {
                if (line.trim()) {
                    doc.text(line.trim(), 105, currentY, { align: 'center' });
                    currentY += 4;
                }
            }
            
            doc.text('Telp: ' + (headerSetting.sekolahTelp || '-') + ' | Email: ' + (headerSetting.sekolahEmail || '-'), 105, currentY, { align: 'center' });
            currentY += 4;
            doc.text(headerSetting.sekolahKota || '', 105, currentY, { align: 'center' });
            currentY += 5;
            
            doc.setFontSize(7);
            doc.setFont(undefined, 'italic');
            const mottoLines = (headerSetting.sekolahMotto || '').split('\n');
            for (const line of mottoLines) {
                if (line.trim()) {
                    doc.text(line.trim(), 105, currentY, { align: 'center' });
                    currentY += 4;
                }
            }
            
            doc.setDrawColor(200, 200, 200);
            doc.line(15, currentY + 3, 195, currentY + 3);
            
            yPos = currentY + 12;
            
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('LEMBAR JAWABAN SISWA', 105, yPos, { align: 'center' });
            yPos += 12;
            
            // Info Siswa
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text('Nama          : ' + (siswa.nama || '-'), 20, yPos);
            yPos += 6;
            doc.text('Kelas         : ' + (siswa.kelas || '-'), 20, yPos);
            yPos += 6;
            doc.text('NIS           : ' + (siswa.nis || '-'), 20, yPos);
            yPos += 6;
            doc.text('Mata Pelajaran: ' + mapel, 20, yPos);
            yPos += 6;
            doc.text('Tanggal       : ' + new Date().toLocaleDateString('id-ID'), 20, yPos);
            yPos += 15;
            
            // ========== FORMAT BARU: PG, PGK, BS ==========
            const nilaiPG = jawaban.nilaiPG || 0;
            const nilaiPGK = jawaban.nilaiPGK || 0;
            const nilaiBS = jawaban.nilaiBS || 0;
            const totalPG = jawaban.totalPG || 0;
            const totalPGK = jawaban.totalPGK || 0;
            const totalBS = jawaban.totalBS || 0;
            const nilaiAkhir = jawaban.nilaiAkhir || 0;
            
            // Ringkasan Nilai
            doc.setFont(undefined, 'bold');
            doc.text('RINGKASAN NILAI:', 20, yPos);
            yPos += 8;
            
            doc.setFont(undefined, 'normal');
            doc.text('   Pilihan Ganda   : ' + nilaiPG + ' / ' + totalPG, 20, yPos);
            yPos += 6;
            doc.text('   PG Kompleks     : ' + nilaiPGK + ' / ' + totalPGK, 20, yPos);
            yPos += 6;
            doc.text('   Benar/Salah     : ' + nilaiBS + ' / ' + totalBS, 20, yPos);
            yPos += 8;
            
            doc.setFont(undefined, 'bold');
            doc.text('   NILAI AKHIR     : ' + nilaiAkhir, 20, yPos);
            yPos += 20;
            
            // Detail Jawaban
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('DETAIL JAWABAN:', 20, yPos);
            yPos += 10;
            
            const questionsSnapshot = await firebase.firestore()
                .collection('questions')
                .where('examId', '==', jawaban.examId)
                .get();
            
            const questions = [];
            questionsSnapshot.forEach(doc => {
                questions.push({ id: doc.id, ...doc.data() });
            });
            questions.sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
            
            const jawabanPG = jawaban.jawabanPG || {};
            const jawabanPGK = jawaban.jawabanPGK || {};
            const jawabanBS = jawaban.jawabanBS || {};
            
            let noSoal = 1;
            for (const question of questions) {
                if (yPos > 260) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 0, 0);
                
                let jenisSoal = '';
                if (question.tipe === 'pg') jenisSoal = 'PILIHAN GANDA';
                else if (question.tipe === 'pgk') jenisSoal = 'PG KOMPLEKS';
                else if (question.tipe === 'bs') jenisSoal = 'BENAR/SALAH';
                
                doc.text(noSoal++ + '. [' + jenisSoal + ']', 20, yPos);
                yPos += 6;
                
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                const soalSplit = doc.splitTextToSize(question.soal || '', 170);
                doc.text(soalSplit, 25, yPos);
                yPos += soalSplit.length * 5 + 3;
                
                // ---------- PG ----------
                if (question.tipe === 'pg') {
                    const jawabanBenar = question.kunci;
                    const jawabanData = jawabanPG[question.id];
                    const jawabanSiswa = jawabanData?.jawaban || '';
                    const isCorrect = jawabanSiswa && jawabanSiswa.toUpperCase() === String(jawabanBenar).toUpperCase();
                    
                    doc.setTextColor(0, 0, 0);
                    doc.text('   Jawaban : ' + (jawabanSiswa || '(tidak dijawab)'), 25, yPos);
                    yPos += 5;
                    
                    if (isCorrect) {
                        doc.setTextColor(0, 128, 0);
                        doc.text('   Status  : BENAR', 25, yPos);
                    } else {
                        doc.setTextColor(255, 0, 0);
                        doc.text('   Status  : SALAH', 25, yPos);
                        yPos += 5;
                        doc.setTextColor(0, 128, 0);
                        doc.text('   Seharusnya : ' + jawabanBenar, 25, yPos);
                    }
                    doc.setTextColor(0, 0, 0);
                    yPos += 8;
                }
                // ---------- PGK ----------
                else if (question.tipe === 'pgk') {
                    const jawabanBenar = question.kunci;
                    const jawabanData = jawabanPGK[question.id];
                    let jawabanSiswa = jawabanData?.jawaban || [];
                    if (Array.isArray(jawabanSiswa)) jawabanSiswa = jawabanSiswa.join(', ');
                    
                    doc.setTextColor(0, 0, 0);
                    doc.text('   Jawaban : ' + (jawabanSiswa || '(tidak dijawab)'), 25, yPos);
                    yPos += 5;
                    
                    doc.setTextColor(0, 128, 0);
                    doc.text('   Kunci   : ' + (jawabanBenar || '-'), 25, yPos);
                    doc.setTextColor(0, 0, 0);
                    yPos += 5;
                    
                    const nilai = jawabanData?.nilai || 0;
                    doc.text('   Nilai   : ' + nilai, 25, yPos);
                    yPos += 8;
                }
                // ---------- BS ----------
                else if (question.tipe === 'bs') {
                    const jawabanData = jawabanBS[question.id];
                    const pernyataanList = question.pernyataanBS || [];
                    const jawabanSiswa = jawabanData?.jawaban || {};
                    
                    doc.setTextColor(0, 0, 0);
                    doc.text('   Jawaban:', 25, yPos);
                    yPos += 5;
                    
                    pernyataanList.forEach((item, idx) => {
                        const jwb = jawabanSiswa[idx] || '-';
                        const kunci = (item.kunci || item.jawaban || '-').toUpperCase();
                        const isBenar = jwb === kunci;
                        const textPernyataan = (item.text || item.pernyataan || '').substring(0, 80);
                        
                        doc.setTextColor(isBenar ? 0 : 255, isBenar ? 128 : 0, 0);
                        doc.text(`     ${idx + 1}. ${textPernyataan}`, 28, yPos);
                        yPos += 4;
                        doc.text(`        Jawab: ${jwb} | Kunci: ${kunci} ${isBenar ? '✓' : '✗'}`, 28, yPos);
                        yPos += 5;
                    });
                    
                    doc.setTextColor(0, 0, 0);
                    const nilai = jawabanData?.nilai || 0;
                    doc.text('   Nilai   : ' + nilai, 25, yPos);
                    yPos += 8;
                }
                yPos += 5;
            }
            
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.setFont(undefined, 'italic');
            doc.text('Dicetak pada: ' + new Date().toLocaleString('id-ID'), 105, 285, { align: 'center' });
            
            doc.save('Lembar_Jawaban_' + (siswa.nama || 'siswa') + '_' + mapel + '.pdf');
            resolve();
            
        } catch (error) {
            console.error('Error in generatePDFSiswa:', error);
            reject(error);
        }
    });
}
