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

export const solicitarCarona = async (req: Request, res: Response) => {
  try{
    const { caronaID } = req.params;

    const passageiroID = (req as any).user.uid || (req as any).user.uid;

    const caronaRef = admin.firestore().collection("caronas").doc(caronaID);
    const caronaDoc = await caronaRef.get();

    if (!caronaDoc.exists){
      return res.status(404).json({ message: "Carona não encontrada"});
    }

    const data = caronaDoc.data();

    const capacidadeTotal = data?.vagas || 0;
    const passageirosConfirmados = data?.passageiros?.lenght || 0;
    const vagaDisponiveis = capacidadeTotal - passageirosConfirmados;

    if (vagasDisponiveis <= 0) {
      return res.status(400).json({ message: "Esta carona está lotada" });
    }
    
    const solicitacoes = data?.solicitacoes || [];
    const passageiros = data?.passageiros || [];
    const motoristaId = data?.motoristaId;

    if (motoristaId === passageiroID) {
      return res.status(400).json({ message: "O motorista não pode solicitar a própria carona"});
    }

    if (solicitacoes.includes(passageiroID)) {
      return res.status(409).json({ message: "Você já enviou uma solicitação para esta carona"});
    }

    if (passageiros.includes(passageiroID)) {
      return res.status(200).json({ message: "VocÊ já é um passageiro desta carona"});
    }
    
    await caronaRef.update({
solicitacoes: admin.firestore.FieldValue.arrayUnion(passageiroID)
    });

    return res.status(200).json({ message: "Solicitação de carona enviada com sucesso!"});
  } catch (error: any) {
    return res.status(500).json({
      message: "Erro ao solicitar carona",
      error: error.message,
    });
  }
};
