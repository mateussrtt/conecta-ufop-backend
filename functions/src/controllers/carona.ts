import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { postCaronaSchema } from "../schemas/caronaSchema";

const db = admin.firestore();


export const createCarona = async (req: Request, res: Response) => {
  try {
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
      destino,
    } = validatedData;

    const partida = new Date(dtPartida);
    const chegada = new Date(dtChegada);

    if (partida >= chegada) {
      return res.status(400).json({
        message: "Data de partida deve ser anterior à data de chegada",
      });
    }

    const partidaTimestamp = admin.firestore.Timestamp.fromDate(partida);
    const chegadaTimestamp = admin.firestore.Timestamp.fromDate(chegada);

    const motoristaId = (req as any).user.uid;

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
      passageiros: [],
    };

    const docRef = await db.collection("caronas").add(caronaData);

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


export const getCaronaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const caronaSnap = await db.collection("caronas").doc(id).get();

    if (!caronaSnap.exists) {
      return res.status(404).json({ message: "Carona não encontrada" });
    }

    if (!caronaSnap.exists) {
  return res.status(404).json({ message: "Carona não encontrada" });
}

const carona = caronaSnap.data()!;

    const motoristaSnap = await db
      .collection("users")
      .doc(carona?.motoristaId)
      .get();

    if (!motoristaSnap.exists) {
      return res.status(404).json({ message: "Motorista não encontrado" });
    }

    const motorista = motoristaSnap.data();


    const avaliacoesSnap = await db
      .collection("avaliacoes")
      .where("motoristaId", "==", carona?.motoristaId)
      .get();

    let notaMedia = 0;

    if (!avaliacoesSnap.empty) {
      const soma = avaliacoesSnap.docs.reduce(
        (acc, doc) => acc + doc.data().nota,
        0
      );
      notaMedia = soma / avaliacoesSnap.size;
    }


    const caronasMotoristaSnap = await db
      .collection("caronas")
      .where("motoristaId", "==", carona?.motoristaId)
      .get();

    const caronasCont = caronasMotoristaSnap.size;


    let idadeMotorista = 0;

    if (motorista?.dtAniversario) {
      const nascimento = motorista.dtAniversario.toDate();
      const hoje = new Date();
      idadeMotorista = hoje.getFullYear() - nascimento.getFullYear();
    }


    const passageiros = [];

    if (carona?.passageiros?.length > 0) {
      for (const passageiroId of carona.passageiros) {
        const userSnap = await db.collection("users").doc(passageiroId).get();

        if (userSnap.exists) {
          const user = userSnap.data();

          let idadePassageiro = 0;

          if (user?.dtAniversario) {
            const nascimento = user.dtAniversario.toDate();
            const hoje = new Date();
            idadePassageiro = hoje.getFullYear() - nascimento.getFullYear();
          }

          passageiros.push({
            nome: user?.nome,
            fotoUrl: user?.fotoUrl || "",
            perfil: `${idadePassageiro} - ${user?.curso_ocupacao}`,
          });
        }
      }
    }


    return res.status(200).json({
      criadoEm: carona?.criadoEm,
      motorista: {
        createdAt: motorista?.createdAt,
        nome: motorista?.nome,
        notaMedia,
        fotoUrl: motorista?.fotoUrl || "",
        descricao: motorista?.descricao,
        caronasCont,
        perfil: `${idadeMotorista} - ${motorista?.curso_ocupacao}`,
      },
      veiculo: carona?.veiculo,
      valor: carona?.valor,
      vagasDisponiveis:
        carona?.vagas - (carona?.passageiros?.length || 0),
      origem: carona?.origem,
      destino: carona?.destino,
      dtPartida: carona?.dtPartida,
      dtChegada: carona?.dtChegada,
      passageiros,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erro ao buscar carona",
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

