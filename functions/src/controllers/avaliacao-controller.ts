import { Request, Response } from "express";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const criarAvaliacao = async (req: Request, res: Response) => {
  try {
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

export const getAvaliacoes = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const userData = userSnap.data();

    const avaliacoesSnap = await db
      .collection("avaliacoes")
      .where("motoristaId", "==", userId)
      .get();

    const avaliacoes: any[] = [];
    let somaNotas = 0;

    for (const doc of avaliacoesSnap.docs) {
      const data = doc.data();
      somaNotas += data.nota;

      const avaliadorSnap = await db
        .collection("users")
        .doc(data.userId)
        .get();

      const avaliador = avaliadorSnap.data();

      avaliacoes.push({
        nome: avaliador?.nome || "",
        fotoUrl: avaliador?.fotoUrl || "",
        createdAt: data.criadoEm,
        nota: data.nota,
        comentario: data.comentario,
      });
    }

    const notaMedia =
      avaliacoes.length > 0 ? somaNotas / avaliacoes.length : 0;

    const nascimento = userData?.dtAniversario?.toDate?.();
    let idade = 0;

    if (nascimento) {
      const hoje = new Date();
      idade = hoje.getFullYear() - nascimento.getFullYear();
    }

    const caronasSnap = await db
      .collection("caronas")
      .where("motoristaId", "==", userId)
      .get();

    return res.status(200).json({
      usuario: {
        id: userId,
        fotoUrl: userData?.fotoUrl || "",
        nome: userData?.nome,
        notaMedia,
        perfil: `${idade} - ${userData?.curso_ocupacao}`,
        descricao: userData?.descricao || "",
        createdAt: userData?.createdAt,
        contCaronas: caronasSnap.size,
      },
      avaliacoes,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};
