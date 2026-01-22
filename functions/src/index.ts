import * as admin from "firebase-admin";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import express from "express";
import cors from "cors";
import * as swagger from "./schemas/swagger.json";
import { serve, setup } from "swagger-ui-express";
import { onRequest } from "firebase-functions/v2/https";

import { initializeApp, getApps } from "firebase/app";

import { onError } from "./middlewares/error";
import { migrationsUp } from "./controllers/migrations-controller";
import { createUser } from "./controllers/users";
import { catchAsyncErrors } from "./middlewares/catch-async-errors";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { createCarona } from "./controllers/carona";
import { authenticate } from "./middlewares/authenticate";

// Inicializa Firebase Admin
admin.initializeApp();

// Configuração para testes locais
if (process.env.NODE_ENV === "test") {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

  const firebaseConfig = {
    apiKey: "AIzaSyBEDdrkmkChOQn0BvLp-aAEdpynOyr3L1Y",
    authDomain: "conecta-ufop.firebaseapp.com",
    projectId: "conecta-ufop",
    storageBucket: "conecta-ufop.firebasestorage.app",
    messagingSenderId: "227650590229",
    appId: "1:227650590229:web:0dad8b4597f2279938201c",
    measurementId: "G-3Y0Y0Y7JE8",
  };

  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
    const auth = getAuth();
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
  }

  admin.firestore().settings({
    host: "localhost:8080",
    ssl: false,
  });
}

// Configurações globais do Firebase Functions
setGlobalOptions({ maxInstances: 10, region: "southamerica-east1" });

const app = express();

// Middlewares globais
app.use(cors({ origin: true }));
app.use(express.json());
app.use("/docs/", serve, setup(swagger));

// Rotas
app.post("/migrations-up", migrationsUp);
app.post("/users", catchAsyncErrors(createUser));

// ✅ Rota de carona protegida por autenticação
app.post("/carona", authenticate, catchAsyncErrors(createCarona));

// Middleware de tratamento de erros
app.use(onError);

// Exporta a função do Firebase Functions
export const api = onRequest(app);
export { app };
