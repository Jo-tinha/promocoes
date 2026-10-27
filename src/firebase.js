import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Configuração do app web do Firebase (projeto joao-iam).
// Essa chave não é secreta: a proteção dos dados vem das regras do Firestore (firestore.rules).
// Variáveis VITE_FIREBASE_* no .env ou no Vercel substituem estes valores, se existirem.
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBEsy5cHJOMfq5rDOz0JjaQHeJmZ4j3X_s',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'joao-iam.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'joao-iam',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'joao-iam.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '872120514311',
  appId: env.VITE_FIREBASE_APP_ID || '1:872120514311:web:59b632c8ce282dd200f7a2',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
