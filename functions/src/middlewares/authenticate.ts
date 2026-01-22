import { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Pega o header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token não fornecido" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    // Verifica o token no Firebase Auth
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Adiciona o UID do usuário na requisição
    (req as any).user = { uid: decodedToken.uid };

    next();
  } catch (err: any) {
    console.error(err);
    return res.status(401).json({ message: "Não autorizado", error: err.message });
  }
};
