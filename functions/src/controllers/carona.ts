import { Request, Response } from "express";
import * as admin from "firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";

// Get a reference to Timestamp class
let TimestampClass: typeof Timestamp | null = null;

// Controller para criar carona
export const createCarona = async (req: Request, res: Response) => {
  try {
    // Desestrutura o body da requisição
    const {
      veiculo,
      vagas,
      valor,
      dtPartida,
      dtChegada,
      origem,
    } = req.body;

    // Validação de campos obrigatórios
    if (!veiculo || vagas === undefined || valor === undefined || !dtPartida || !dtChegada || !origem) {
      return res.status(400).json({ 
        message: "Campos obrigatórios faltando", 
        required: ["veiculo", "vagas", "valor", "dtPartida", "dtChegada", "origem"] 
      });
    }

    // Validação de datas
    const partida = new Date(dtPartida);
    const chegada = new Date(dtChegada);

    if (isNaN(partida.getTime()) || isNaN(chegada.getTime())) {
      return res.status(400).json({ message: "Datas inválidas. Use formato ISO 8601 (ex: 2026-01-23T10:00:00.000Z)" });
    }

    if (partida >= chegada) {
      return res.status(400).json({ message: "Data de partida deve ser anterior à chegada" });
    }

    // Conversão para Timestamp do Firestore
    // Try to get Timestamp class dynamically
    if (!TimestampClass) {
      const db = admin.firestore();
      // In Firebase Admin SDK, Timestamp is a static property of the Firestore instance
      TimestampClass = (db.constructor as any).Timestamp || admin.firestore.Timestamp;
    }
    
    if (!TimestampClass) {
      throw new Error("Timestamp não está disponível no Firebase Admin SDK");
    }
    
    const partidaTimestamp = TimestampClass.fromDate(partida);
    const chegadaTimestamp = TimestampClass.fromDate(chegada);

    // Recupera o usuário autenticado (mock ou real)
    const motoristaId = (req as any).user?.uid;
    if (!motoristaId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    // Monta o documento da carona
    const caronaData = {
      veiculo,
      vagas,
      valor,
      dtPartida: partidaTimestamp,
      dtChegada: chegadaTimestamp,
      origem,
      criadoEm: TimestampClass!.now(),
      motoristaId,
      status: "ABERTA",
    };

    // Salva no Firestore
    const docRef = await admin.firestore().collection("caronas").add(caronaData);

    return res.status(201).json({
      message: "Carona criada com sucesso",
      id: docRef.id,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao criar carona", error: err.message });
  }
};
