import { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Token não fornecido" });
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];

    const decodedToken = await admin.auth().verifyIdToken(idToken);

    (req as any).user = { uid: decodedToken.uid };

    next();
    return;
  } catch (err: any) {
    console.error(err);
    res.status(401).json({
      message: "Não autorizado",
      error: err.message,
    });
    return;
  }
};
