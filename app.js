import express from 'express';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, push, remove, set } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import session from 'express-session';

const app = express();
const port = 3000;

const firebaseConfig = {
  apiKey: "AIzaSyAXSrvXlriajK-IMacwN4z9xY3mtkW5KPs",
  authDomain: "wisteria-7dc52.firebaseapp.com",
  databaseURL: "https://wisteria-7dc52-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "wisteria-7dc52",
  storageBucket: "wisteria-7dc52.firebasestorage.app",
  messagingSenderId: "67244581472",
  appId: "1:67244581472:web:2faa9ec7bfa4979539d905"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

// Update database references
const postsRef = ref(db, 'posts');
const commentsRef = ref(db, 'comments');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Register routes
app.get('/register', (req, res) => {
  res.render('register.ejs', { error: null });
});

app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    req.session.user = { email: userCredential.user.email };
    res.redirect('/');
  } catch (error) {
    res.render('register.ejs', { error: error.message });
  }
});

// Login routes
app.get('/login', (req, res) => {
  res.render('login.ejs', { error: null });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    req.session.user = { email: userCredential.user.email };
    res.redirect('/');
  } catch (error) {
    res.render('login.ejs', { error: error.message });
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy();
  signOut(auth);
  res.redirect('/login');
});

// Protected home route
app.get('/', requireAuth, async (req, res) => {
  const snapshot = await get(postsRef);
  let posts = [];
  if (snapshot.exists()) {
    const data = snapshot.val();
    if (data) {
      posts = await Promise.all(Object.entries(data).map(async ([id, post]) => {
        // Get comments for this post
        const commentsSnapshot = await get(ref(db, `comments/${id}`));
        const comments = commentsSnapshot.exists() ? Object.entries(commentsSnapshot.val()).map(([commentId, comment]) => ({
          id: commentId,
          ...comment
        })) : [];
        
        return {
          id,
          ...post,
          comments: comments
        };
      }));
      posts.reverse();
    }
  }
  res.render('home_page.ejs', { posts, user: req.session.user });
});

// Create a new post
app.post('/submit-post', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (content && content.trim() !== '') {
    const newPost = {
      content: content.trim(),
      author: req.session.user.email,
      timestamp: Date.now()
    };
    await push(postsRef, newPost);
  }
  res.redirect('/');
});

// Add a comment to a post
app.post('/posts/:postId/comment', requireAuth, async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  
  if (content && content.trim() !== '') {
    const newComment = {
      content: content.trim(),
      author: req.session.user.email,
      timestamp: Date.now(),
      isReply: false
    };
    await push(ref(db, `comments/${postId}`), newComment);
  }
  res.redirect('/');
});

// Add a reply to a comment
app.post('/posts/:postId/comments/:commentId/reply', requireAuth, async (req, res) => {
  const { postId, commentId } = req.params;
  const { content } = req.body;
  
  if (content && content.trim() !== '') {
    const newReply = {
      content: content.trim(),
      author: req.session.user.email,
      timestamp: Date.now(),
      isReply: true,
      replyTo: commentId
    };
    await push(ref(db, `comments/${postId}`), newReply);
  }
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});