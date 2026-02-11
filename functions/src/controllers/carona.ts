import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { postCaronaSchema } from "../schemas/caronaSchema";

const db = admin.firestore();

/* =====================================================
   CREATE CARONA
===================================================== */
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

/* =====================================================
   GET CARONA POR ID
===================================================== */
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


    // ================= MOTORISTA =================

    const motoristaSnap = await db
      .collection("users")
      .doc(carona?.motoristaId)
      .get();

    if (!motoristaSnap.exists) {
      return res.status(404).json({ message: "Motorista não encontrado" });
    }

    const motorista = motoristaSnap.data();

    // ===== Calcular nota média =====

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

    // ===== Contar caronas do motorista =====

    const caronasMotoristaSnap = await db
      .collection("caronas")
      .where("motoristaId", "==", carona?.motoristaId)
      .get();

    const caronasCont = caronasMotoristaSnap.size;

    // ===== Calcular idade motorista =====

    let idadeMotorista = 0;

    if (motorista?.dtAniversario) {
      const nascimento = motorista.dtAniversario.toDate();
      const hoje = new Date();
      idadeMotorista = hoje.getFullYear() - nascimento.getFullYear();
    }

    // ================= PASSAGEIROS =================

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

    // ================= RESPOSTA FINAL =================

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
