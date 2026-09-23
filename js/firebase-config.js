// Konfigurasi Firebase
const firebaseConfig = {
apiKey: "AIzaSyD9XT8pSNqOykugsb7Cv5rO-BNOcCh4440",
  authDomain: "ats-kelas-5.firebaseapp.com",
  projectId: "ats-kelas-5",
  storageBucket: "ats-kelas-5.firebasestorage.app",
  messagingSenderId: "548455920485",
  appId: "1:548455920485:web:4fa898fb5d31c2b102a78c"
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
