const firebaseConfig = {
  apiKey: "AIzaSyAjYEvRTK98Refrz0RSPTDvImwd3mYlYI8",
  authDomain: "unfinished-drafts.firebaseapp.com",
  projectId: "unfinished-drafts",
  storageBucket: "unfinished-drafts.firebasestorage.app",
  messagingSenderId: "642695304388",
  appId: "1:642695304388:web:89cfd1d034588d01016591"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// It's stored in plain text here. fine for a casual gate, not real security.
const WRITE_PASSCODE = "letmein";
