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

    const { veiculo, vagas, valor, dtPartida, dtChegada, origem, destino } =
      validatedData;

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
      destino,
      criadoEm: admin.firestore.Timestamp.now(),
      motoristaId,
      status: "ABERTA",
    };

    // Salva no Firestore
    const docRef = await admin
      .firestore()
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
  try {
    const { caronaID } = req.params;

    const passageiroID = (req as any).user.uid || (req as any).user.uid;

    const caronaRef = admin.firestore().collection("caronas").doc(caronaID);
    const caronaDoc = await caronaRef.get();

    if (!caronaDoc.exists) {
      return res.status(404).json({ message: "Carona não encontrada" });
    }

    const data = caronaDoc.data();

    const capacidadeTotal = data?.vagas || 0;
    const passageirosConfirmados = data?.passageiros?.lenght || 0;
    const vagasDisponiveis = capacidadeTotal - passageirosConfirmados;

    if (vagasDisponiveis <= 0) {
      return res.status(400).json({ message: "Esta carona está lotada" });
    }

    const solicitacoes = data?.solicitacoes || [];
    const passageiros = data?.passageiros || [];
    const motoristaId = data?.motoristaId;

    if (motoristaId === passageiroID) {
      return res
        .status(400)
        .json({ message: "O motorista não pode solicitar a própria carona" });
    }

    if (solicitacoes.includes(passageiroID)) {
      return res
        .status(409)
        .json({ message: "Você já enviou uma solicitação para esta carona" });
    }

    if (passageiros.includes(passageiroID)) {
      return res
        .status(200)
        .json({ message: "VocÊ já é um passageiro desta carona" });
    }

    await caronaRef.update({
      solicitacoes: admin.firestore.FieldValue.arrayUnion(passageiroID),
    });

    return res
      .status(200)
      .json({ message: "Solicitação de carona enviada com sucesso!" });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erro ao solicitar carona",
      error: error.message,
    });
  }
};

export const getAllCaronas = async (req: Request, res: Response) => {
  try {
    const snapshot = await admin.firestore().collection("caronas").where("status", "==", "ABERTA").get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const caronasPromises = snapshot.docs.map(async (doc) => {
      const data = doc.data();

      const qtdSolicitacoes = data.solicitacoes ? data.solicitacoes.length : 0;
      const qtdPassageiros = data.passageiros ? data.passageiros.length : 0;
      const vagasDisponiveis = (data.vagas || 0) - (qtdSolicitacoes + qtdPassageiros);

      if (vagasDisponiveis <= 0) {
        return null;
      }

      let motoristaData = { nome: "Desconhecido", notaMedia: 0, fotoUrl: ""};
      if (data.motoristaId) {
        const userDoc = await admin.firestore().collection("users").doc(data.motoristaId).get();
        if (userDoc.exists) {
          const uData = userDoc.data();
          motoristaData = {
            nome: uData?.nome || "Usuário",
            notaMedia: uData?.notaMedia || 5.0,
            fotoUrl: uData?.fotoUrl || null
          };

        }
      } 
      return {
        id: doc.id,
        criadoEm: data.criadoEm?.toDate(),
        motorista: motoristaData,
        veiculo: data.veiculo,
        valor: data.valor,
        vagasDisponiveis: vagasDisponiveis,
        origem: data.origem,
        destino: data.destino,
        dtPartida: data.dtPartida?.toDate(),
        dtChegada: data.dtChegada?.toDate()
      };
    });

    const caronasProcessadas = await Promise.all(caronasPromises);

    const caronasFiltradas = caronasProcessadas.filter(c => c !== null);

    return res.status(200).json(caronasFiltradas);

  } catch (error: any) {
    return res.status(500).json({
      message: "Erro ao buscar caronas disponíveis",
      error: error.message
    });
  }
}

export const responderSolicitacao = async (req: Request, res: Response) => {
  try {
    const { caronaID, passageiroID } = req.params;
    const { aceite } = req.body;
    const motoristaIdLogado = (req as any).user.uid || (req as any).user.id;

    if (typeof aceite !== 'boolean') {
      return res.status(400).json({ message: "O campo 'aceite' é obrigatório e deve ser booleano."});
    }

    const caronaRef = admin.firestore().collection("caronas").doc(caronaID);
    const caronaDoc = await caronaRef.get();

    if (!caronaDoc.exists) {
      return res.status(404).json({ message: "Carona não econtrada."});
    }

    const data = caronaDoc.data();

    if (data?.motoristaId !== motoristaIdLogado){
      return res.status(403).json({ message: "Apenas o motorista responsável pode gerenciar solicitações."});
    }

    const solicitacoes = data?.solicitacoes || [];
    if (!solicitacoes.includes(passageiroID)){
      return res.status(404).json({ message: "Solicitação deste passageiro não encontrada."});
    }

    if (aceite === false) {
      await caronaRef.update({
        solicitacoes: admin.firestore.FieldValue.arrayRemove(passageiroID)});
        return res.status(200).json({ message: "Solciitação recusada com sucesso."});
    
    }

    else {
      const capacidadeTotal = data?.vagas || 0;
      const passageirosConfirmados = data?.passageiros || [];
      const vagasDisponiveis = capacidadeTotal - passageirosConfirmados.length;

      if (vagasDisponiveis <= 0) {
        return res.status(400).json({ message: "Não é possível aceitar: Carona lotada."});
      }

      if (passageirosConfirmados.includes(passageiroID)){
        return res.status(409).json({ message: "Este passageiro já está confirmado na carona"});
      }
      
      await caronaRef.update({
        solicitacoes: admin.firestore.FieldValue.arrayRemove(passageiroID),
        passageiros: admin.firestore.FieldValue.arrayUnion(passageiroID)
      });

      return res.status(200).json({ message: "SOlicitação aceita! Passageiro confirmado."});
    }
  } catch (error: any){
    return res.status(500).json({
      message: "Erro ao processar solicitação de carona",
      error: error.message
    });
  }
};
