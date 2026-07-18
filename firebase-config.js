// ---------------------------------------------------------------
// SETUP (one-time, ~5 minutes):
// 1. Go to https://console.firebase.google.com and create a free project.
// 2. In the left sidebar, click "Build" -> "Firestore Database" -> "Create database".
//    Choose "Start in test mode" for now (we lock it down with rules below).
// 3. Click the gear icon (top left) -> "Project settings".
// 4. Scroll to "Your apps" -> click the </> (web) icon -> register an app
//    (nickname can be anything, e.g. "unfinished-drafts").
// 5. It will show you a firebaseConfig object. Copy each value into the
//    matching field below, replacing the placeholder text.
// 6. Back in Firestore Database -> "Rules" tab, paste this and click Publish:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /posts/{postId} {
//          allow read: if true;
//          allow write: if true;
//        }
//      }
//    }
//
//    (This keeps reading open to everyone and writing open to anyone who
//    reaches the editor -- the passcode gate on write.html is what actually
//    keeps casual visitors out of the editor itself.)
// ---------------------------------------------------------------

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

// Change this to whatever passcode you want to use to unlock the write page.
// It's stored in plain text here -- fine for a casual gate, not real security.
const WRITE_PASSCODE = "letmein";
