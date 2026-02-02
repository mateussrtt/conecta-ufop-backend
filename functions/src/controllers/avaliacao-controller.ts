import { Request, Response } from "express";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const criarAvaliacao = async (req: Request, res: Response) => {
  try {
    // usuário já autenticado pelo middleware
    const userId = (req as any).user.uid;
    const { caronaID, nota, comentario } = req.body;

    const caronaRef = db.collection("caronas").doc(caronaID);
    const caronaSnap = await caronaRef.get();

    if (!caronaSnap.exists) {
      return res.status(404).json({ message: "Carona não encontrada" });
    }

    const carona = caronaSnap.data();

    if (!carona?.passageiros?.includes(userId)) {
      return res.status(403).json({
        message: "Usuário não é passageiro dessa carona",
      });
    }

    const avaliacao = {
      caronaID,
      nota,
      comentario,
      userId,
      motoristaId: carona.motoristaId,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("avaliacoes").add(avaliacao);

    return res.status(201).json({
      id: ref.id,
      ...avaliacao,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};
