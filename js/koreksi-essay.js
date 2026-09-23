// koreksi-essay.js
// ⚠️ DINONAKTIFKAN
// Semua tipe soal (PG, PGK, BS) sudah auto-koreksi
// Tidak ada lagi koreksi manual untuk essay

console.log('ℹ️ Koreksi essay dinonaktifkan - menggunakan auto koreksi (PG, PGK, BS)');

// Fungsi escape HTML (tetap dipertahankan untuk kompatibilitas)
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}