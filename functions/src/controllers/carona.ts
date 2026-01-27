import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { postCaronaSchema } from "../schemas/caronaSchema";

// Controller para criar carona
export const createCarona = async (req: Request, res: Response) => {
  try {
    // Validação com Yup
    const validatedData = await postCaronaSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    const {
      veiculo,
      vagas,
      valor,
      dtPartida,
      dtChegada,
      origem,
    } = validatedData;

    // Regra de negócio: data de partida < data de chegada
    const partida = new Date(dtPartida);
    const chegada = new Date(dtChegada);

    if (partida >= chegada) {
      return res.status(400).json({
        message: "Data de partida deve ser anterior à data de chegada",
      });
    }

    // Converte datas para Timestamp do Firestore
    const partidaTimestamp = admin.firestore.Timestamp.fromDate(partida);
    const chegadaTimestamp = admin.firestore.Timestamp.fromDate(chegada);

    // Usuário autenticado (já validado pelo middleware authenticate)
    const motoristaId = (req as any).user.uid;

    // Monta o documento da carona
    const caronaData = {
      veiculo,
      vagas,
      valor,
      dtPartida: partidaTimestamp,
      dtChegada: chegadaTimestamp,
      origem,
      criadoEm: admin.firestore.Timestamp.now(),
      motoristaId,
      status: "ABERTA",
    };

    // Salva no Firestore
    const docRef = await admin.firestore()
      .collection("caronas")
      .add(caronaData);

    return res.status(201).json({
      message: "Carona criada com sucesso",
      id: docRef.id,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erro ao criar carona",
      error: error.message,
    });
  }
};
