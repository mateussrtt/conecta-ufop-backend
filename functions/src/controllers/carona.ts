import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { postCaronaSchema } from "../schemas/caronaSchema";



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

    const docRef = await admin.firestore().collection("caronas").add(caronaData);

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

    const caronaSnap = await admin.firestore().collection("caronas").doc(id).get();

    if (!caronaSnap.exists) {
      return res.status(404).json({ message: "Carona não encontrada" });
    }

    if (!caronaSnap.exists) {
      return res.status(404).json({ message: "Carona não encontrada" });
    }

    const carona = caronaSnap.data()!;

    const motoristaSnap = await admin.firestore()
      .collection("users")
      .doc(carona?.motoristaId)
      .get();

    if (!motoristaSnap.exists) {
      return res.status(404).json({ message: "Motorista não encontrado" });
    }

    const motorista = motoristaSnap.data();


    const avaliacoesSnap = await admin.firestore()
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


    const caronasMotoristaSnap = await admin.firestore()
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
        const userSnap = await admin.firestore().collection("users").doc(passageiroId).get();

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

    let solicitacoes: Array<{ id: string; nome: string; fotoUrl: string; perfil: string }> | undefined;
    const userId = (req as any).user?.uid;
    if (userId && userId === carona?.motoristaId) {
      const solicitacoesIds = carona?.solicitacoes || [];
      solicitacoes = [];
      for (const sid of solicitacoesIds) {
        const userSnap = await admin.firestore().collection("users").doc(sid).get();
        if (userSnap.exists) {
          const u = userSnap.data();
          let idade = 0;
          if (u?.dtAniversario) {
            const nascimento = u.dtAniversario.toDate();
            idade = new Date().getFullYear() - nascimento.getFullYear();
          }
          solicitacoes.push({
            id: sid,
            nome: u?.nome || "",
            fotoUrl: u?.fotoUrl || "",
            perfil: `${idade} anos, ${u?.curso_ocupacao || ""}`,
          });
        }
      }
    }

    const response: Record<string, unknown> = {
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
      veiculo: normalizarVeiculo(carona?.veiculo),
      valor: carona?.valor,
      vagasDisponiveis: carona?.vagas - (carona?.passageiros?.length || 0),
      origem: carona?.origem,
      destino: carona?.destino,
      dtPartida: carona?.dtPartida,
      dtChegada: carona?.dtChegada,
      passageiros,
    };
    if (solicitacoes !== undefined) {
      response.solicitacoes = solicitacoes;
    }
    return res.status(200).json(response);
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

      let motoristaData = { nome: "Desconhecido", notaMedia: 0, fotoUrl: "" };
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
        veiculo: normalizarVeiculo(data.veiculo),
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

function normalizarVeiculo(veiculo: unknown): { modelo: string; placa: string; veiculoStr: string } {
  let obj: { modelo: string; placa: string };
  if (veiculo && typeof veiculo === "object" && "modelo" in veiculo && "placa" in veiculo) {
    obj = veiculo as { modelo: string; placa: string };
  } else {
    const str = typeof veiculo === "string" ? veiculo : "";
    obj = { modelo: str, placa: "" };
  }
  const veiculoStr = obj.placa ? `${obj.modelo} - ${obj.placa}` : obj.modelo;
  return { ...obj, veiculoStr };
}

async function getDetalhesUsuario(userId: string) {
  const userSnap = await admin.firestore().collection("users").doc(userId).get();
  if (!userSnap.exists) return null;
  const u = userSnap.data();
  let idade = 0;
  if (u?.dtAniversario) {
    const nascimento = u.dtAniversario.toDate();
    idade = new Date().getFullYear() - nascimento.getFullYear();
  }
  return {
    id: userId,
    nome: u?.nome,
    fotoUrl: u?.fotoUrl || "",
    idade,
    curso_ocupacao: u?.curso_ocupacao,
    perfil: `${idade} anos, ${u?.curso_ocupacao || ""}`,
  };
}

export const getMinhasCaronas = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const comoMotorista: any[] = [];
    const comoPassageiro: any[] = [];

    const caronasMotoristaSnap = await admin.firestore()
      .collection("caronas")
      .where("motoristaId", "==", userId)
      .get();

    const motoristaUser = await getDetalhesUsuario(userId);

    for (const doc of caronasMotoristaSnap.docs) {
      const data = doc.data();
      const passageirosIds = data.passageiros || [];
      const solicitacoesIds = data.solicitacoes || [];
      const vagasTotal = data.vagas || 0;
      const vagasDisponiveis = vagasTotal - passageirosIds.length;

      const status = solicitacoesIds.length > 0 ? "SOLICITADA" : "CONFIRMADA";

      const solicitacoes = [];
      for (const sid of solicitacoesIds) {
        const detalhe = await getDetalhesUsuario(sid);
        if (detalhe) solicitacoes.push(detalhe);
      }

      const passageiros = [];
      for (const pid of passageirosIds) {
        const detalhe = await getDetalhesUsuario(pid);
        if (detalhe) passageiros.push({ nome: detalhe.nome, fotoUrl: detalhe.fotoUrl, perfil: detalhe.perfil });
      }

      const origemObj = data.origem && typeof data.origem === "object" ? data.origem : { nomeLocal: data.origem };
      const destinoObj = data.destino && typeof data.destino === "object" ? data.destino : { nomeLocal: data.destino };
      const rotaStr = `${origemObj?.nomeLocal || origemObj} → ${destinoObj?.nomeLocal || destinoObj}`;

      comoMotorista.push({
        id: doc.id,
        eMotorista: true,
        motorista: motoristaUser ? { nome: motoristaUser.nome, fotoUrl: motoristaUser.fotoUrl } : null,
        veiculo: normalizarVeiculo(data.veiculo),
        origem: origemObj,
        destino: destinoObj,
        rota: rotaStr,
        dtPartida: data.dtPartida?.toDate?.() || data.dtPartida,
        dtChegada: data.dtChegada?.toDate?.() || data.dtChegada,
        valor: data.valor,
        vagasDisponiveis,
        vagasTotal,
        status,
        solicitacoes,
        passageiros,
      });
    }

    const caronasPassageiroSnap = await admin.firestore()
      .collection("caronas")
      .where("passageiros", "array-contains", userId)
      .get();

    const caronasSolicitanteSnap = await admin.firestore()
      .collection("caronas")
      .where("solicitacoes", "array-contains", userId)
      .get();

    const idsJaIncluidos = new Set<string>();

    const processarComoPassageiro = async (doc: admin.firestore.QueryDocumentSnapshot) => {
      if (idsJaIncluidos.has(doc.id)) return;
      idsJaIncluidos.add(doc.id);

      const data = doc.data();
      const motoristaId = data.motoristaId;
      const motorista = await getDetalhesUsuario(motoristaId);
      if (!motorista) return;

      const passageirosIds = data.passageiros || [];
      const vagasTotal = data.vagas || 0;
      const vagasDisponiveis = vagasTotal - passageirosIds.length;

      const souConfirmado = passageirosIds.includes(userId);
      const status = souConfirmado ? "CONFIRMADO" : "SOLICITADO";

      const passageiros = [];
      for (const pid of passageirosIds) {
        const detalhe = await getDetalhesUsuario(pid);
        if (detalhe) passageiros.push({ nome: detalhe.nome, fotoUrl: detalhe.fotoUrl, perfil: detalhe.perfil });
      }

      const origemObj = data.origem && typeof data.origem === "object" ? data.origem : { nomeLocal: data.origem };
      const destinoObj = data.destino && typeof data.destino === "object" ? data.destino : { nomeLocal: data.destino };
      const rotaStr = `${origemObj?.nomeLocal || origemObj} → ${destinoObj?.nomeLocal || destinoObj}`;

      comoPassageiro.push({
        id: doc.id,
        eMotorista: false,
        status,
        motorista: {
          nome: motorista.nome,
          fotoUrl: motorista.fotoUrl,
          perfil: motorista.perfil,
        },
        veiculo: normalizarVeiculo(data.veiculo),
        origem: origemObj,
        destino: destinoObj,
        rota: rotaStr,
        dtPartida: data.dtPartida?.toDate?.() || data.dtPartida,
        dtChegada: data.dtChegada?.toDate?.() || data.dtChegada,
        valor: data.valor,
        vagasDisponiveis,
        passageiros,
      });
    };

    for (const doc of caronasPassageiroSnap.docs) {
      await processarComoPassageiro(doc);
    }
    for (const doc of caronasSolicitanteSnap.docs) {
      await processarComoPassageiro(doc);
    }

    return res.status(200).json({
      comoMotorista,
      comoPassageiro,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erro ao listar minhas caronas",
      error: error.message,
    });
  }
};

export const responderSolicitacao = async (req: Request, res: Response) => {
  try {
    const { caronaID, passageiroID } = req.params;
    const { aceite } = req.body;
    const motoristaIdLogado = (req as any).user.uid || (req as any).user.id;

    if (typeof aceite !== "boolean") {
      return res.status(400).json({ message: "O campo 'aceite' é obrigatório e deve ser booleano." });
    }

    const caronaRef = admin.firestore().collection("caronas").doc(caronaID);
    const caronaDoc = await caronaRef.get();

    if (!caronaDoc.exists) {
      return res.status(404).json({ message: "Carona não econtrada." });
    }

    const data = caronaDoc.data();

    if (data?.motoristaId !== motoristaIdLogado) {
      return res.status(403).json({ message: "Apenas o motorista responsável pode gerenciar solicitações." });
    }

    const solicitacoes = data?.solicitacoes || [];
    if (!solicitacoes.includes(passageiroID)) {
      return res.status(404).json({ message: "Solicitação deste passageiro não encontrada." });
    }

    if (aceite === false) {
      await caronaRef.update({
        solicitacoes: admin.firestore.FieldValue.arrayRemove(passageiroID)
      });
      return res.status(200).json({ message: "Solciitação recusada com sucesso." });

    }

    else {
      const capacidadeTotal = data?.vagas || 0;
      const passageirosConfirmados = data?.passageiros || [];
      const vagasDisponiveis = capacidadeTotal - passageirosConfirmados.length;

      if (vagasDisponiveis <= 0) {
        return res.status(400).json({ message: "Não é possível aceitar: Carona lotada." });
      }

      if (passageirosConfirmados.includes(passageiroID)) {
        return res.status(409).json({ message: "Este passageiro já está confirmado na carona" });
      }

      await caronaRef.update({
        solicitacoes: admin.firestore.FieldValue.arrayRemove(passageiroID),
        passageiros: admin.firestore.FieldValue.arrayUnion(passageiroID)
      });

      return res.status(200).json({ message: "SOlicitação aceita! Passageiro confirmado." });
    }
  } catch (error: any) {
    return res.status(500).json({
      message: "Erro ao processar solicitação de carona",
      error: error.message

    });
  }
};

