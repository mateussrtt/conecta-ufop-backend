import { Request, Response } from "express";
import * as admin from "firebase-admin";
const db = admin.firestore();


export const criarAvaliacao = async (req: Request, res: Response) => {
  try {
    // 🔐 Usuário autenticado
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    // 📦 Body
    const { caronaID, nota, comentario } = req.body;

    if (!caronaID || nota === undefined || !comentario) {
      return res.status(400).json({
        message: "caronaID, nota e comentario são obrigatórios",
      });
    }

    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      return res.status(400).json({
        message: "Nota deve ser um inteiro entre 1 e 5",
      });
    }

    // 🚗 Buscar carona
    const caronaRef = db.collection("caronas").doc(caronaID);
    const caronaSnap = await caronaRef.get();

    if (!caronaSnap.exists) {
      return res.status(404).json({ message: "Carona não encontrada" });
    }

    const carona = caronaSnap.data();

    // 👤 Verificar se é passageiro
    if (!carona?.passageiros || !carona.passageiros.includes(userId)) {
      return res.status(403).json({
        message: "Usuário não é passageiro dessa carona",
      });
    }

    // 🚘 Motorista vem da carona
    const motoristaId = carona.motoristaId;

    // 📝 Criar avaliação
    const avaliacao = {
      caronaID,
      nota,
      comentario,
      userId,
      motoristaId,
      criadoEm: Date.now(), // timestamp
    };

    const avaliacaoRef = await db.collection("avaliacoes").add(avaliacao);

    return res.status(201).json({
      id: avaliacaoRef.id,
      ...avaliacao,
    });
  } catch (error) {
    console.error("Erro ao criar avaliação:", error);
    return res.status(500).json({
      message: "Erro interno do servidor",
    });
  }
};
