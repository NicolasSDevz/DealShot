import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Inicialização única do Admin SDK, compartilhada por todas as functions -- sem argumentos porque
// dentro do ambiente do Cloud Functions/Firebase ele já sabe qual projeto e credencial usar.
if (!getApps().length) {
  initializeApp();
}

export const db = getFirestore();
export const auth = getAuth();
