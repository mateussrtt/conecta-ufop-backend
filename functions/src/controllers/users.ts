import { Request, Response } from "express";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {
  postUserSchema,
  uploadProfileImageSchema,
  updateUserSchema,
} from "../schemas/users";

export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const validatedData = await postUserSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  // eslint-disable-next-line camelcase
  const { nome, email, senha, curso_ocupacao, dtAniversario } = validatedData;

  try {
    const usersRef = admin.firestore().collection("usuarios");
    const existingUser = await usersRef
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      res.status(409).send({ message: "Email já cadastrado" });
      return;
    }

    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password: senha,
        displayName: nome,
      });
    } catch (err: unknown) {
      logger.error("Erro ao criar usuário no Auth", err);
      res.status(500).send({ message: "Erro interno ao criar usuário", error: err });
      return;
    }

    const uid = userRecord.uid;

    const dtAniversarioTimestamp =
      admin.firestore.Timestamp.fromDate(dtAniversario);

    const userData = {
      nome,
      email,
      // eslint-disable-next-line camelcase
      curso_ocupacao,
      dtAniversario: dtAniversarioTimestamp,
      criadoEm: admin.firestore.Timestamp.now(),
      caronasOfericidasCont: 0,
    };

    try {
      await usersRef.doc(uid).set(userData);
    } catch (err) {
      await admin.auth().deleteUser(uid);
      logger.error("Erro ao criar documento do usuário no Firestore", err);
      res.status(500).send({ message: "Erro interno ao salvar usuário" });
      return;
    }

    logger.info(`Usuário criado com ID: ${uid}`);

    res.status(201).send({
      message: "Usuário criado com sucesso",
      id: uid,
    });
  } catch (err) {
    logger.error("Erro ao criar usuário", err);
    if (!res.headersSent) {
      res.status(500).send({ message: "Erro interno ao criar usuário" });
    }
  }
};

export const uploadUserProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { uid } = req.user!;
  const validatedData = await uploadProfileImageSchema.validate(req.body, {
    abortEarly: false,
  });
  const { fotoBase64, descricao } = validatedData;

  try {
    const matches = fotoBase64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);

    if (!matches || matches.length !== 3) {
      res
        .status(400)
        .send({
          message:
            "Formato de imagem inválido. Use Base64 com cabeçalho data URI.",
        });
      return;
    }

    const mimeType = matches[1];
    const extension = mimeType.split("/")[1];
    const buffer = Buffer.from(matches[2], "base64");

    const bucket = admin.storage().bucket();
    const filePath = `uploads/users/${uid}/foto-de-perfil.${extension}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: { contentType: mimeType },
    });
    await file.makePublic();

    const fotoUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    await admin.firestore().collection("usuarios").doc(uid).update({
      fotoUrl: fotoUrl,
      descricao: descricao,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send({
      message: "Perfil atualizado com sucesso",
      fotoUrl: fotoUrl,
    });
  } catch (error) {
    logger.error("Erro no upload de imagem", error);
    if (!res.headersSent) {
      res.status(500).send({ message: "Erro interno ao salvar imagem" });
    }
  }
};

export const updateUserData = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { uid } = req.user!;

  const validatedData = await updateUserSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  try {
    const updateData = {
      nome: validatedData.nome,
      curso_ocupacao: validatedData.curso_ocupacao,
      dtAniversario: admin.firestore.Timestamp.fromDate(
        validatedData.dtAniversario
      ),
      descricao: validatedData.descricao,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    await admin.firestore().collection("usuarios").doc(uid).update(updateData);

    res.status(200).send({
      message: "Dados atualizados com sucesso",
    });
  } catch (err) {
    logger.error("Erro ao atualizar dados do usuário", err);
    res.status(500).send({
      message: "Erro interno ao atualizar dados do usuário",
    });
  }
};

export const getAuthenticatedUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = (req as any).user?.uid;

    const userDoc = await admin.firestore().collection("usuarios").doc(id).get();
    if (!userDoc.exists) {
      res.status(404).send({ message: "Usuário não encontrado" });
      return;
    }

    const data = userDoc.data()!;
    res.status(200).json({
      fotoUrl: data.fotoUrl ?? null,
      nome: data.nome,
      descricao: data.descricao,
      email: data.email,
      genero: data.genero,
    });
  } catch (err) {
    logger.error("Erro ao buscar usuário autenticado", err);
    res.status(500).send({
      message: "Erro interno ao buscar usuário",
    });
  }
};
