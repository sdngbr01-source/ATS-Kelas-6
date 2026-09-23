// Konfigurasi Firebase
const firebaseConfig = {
apiKey: "AIzaSyC2p0rMRZO8-oeElmDupoSMesAqox4d4_o",
  authDomain: "ats-kelas-6.firebaseapp.com",
  projectId: "ats-kelas-6",
  storageBucket: "ats-kelas-6.firebasestorage.app",
  messagingSenderId: "480741142678",
  appId: "1:480741142678:web:1cee92b3f95459faacd2b7"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Collection references
const usersRef = db.collection('users');
const classesRef = db.collection('classes');
const subjectsRef = db.collection('subjects');
const questionsRef = db.collection('questions');
const examsRef = db.collection('exams');
const answersRef = db.collection('answers');
const gradesRef = db.collection('grades');

// Data kelas yang tersedia
const availableClasses = ['4A', '4B', '5A', '5B', '6A', '6B'];

// Data mata pelajaran
const availableSubjects = [
    'Matematika',
    'Bahasa Indonesia',
    'IPA',
    'IPS',
    'PPKn',
    'PJOK',
    'SBdP'
];
