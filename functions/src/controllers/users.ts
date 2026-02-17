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
  // Primeiro, validamos se os campos são válidos E compatíveis com o schema
  const validatedData = await postUserSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  // eslint-disable-next-line camelcase
  const { nome, email, curso_ocupacao, dtAniversario } = validatedData;

  // Aqui, verificamos se o email já existe
  const usersRef = admin.firestore().collection("users");
  const existingUser = await usersRef
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!existingUser.empty) {
    res.status(409).send({ message: "Email já cadastrado" });
    return;
  }

  // Aqui, convertemos a data de aniversário para timestamp do Firestore
  const dtAniversarioTimestamp =
    admin.firestore.Timestamp.fromDate(dtAniversario);

  // Aqui, montamos o documento do usuário
  const userData = {
    nome,
    email,
    // eslint-disable-next-line camelcase
    curso_ocupacao,
    dtAniversario: dtAniversarioTimestamp,
    criadoEm: admin.firestore.Timestamp.now(),
    caronasOfericidasCont: 0,
  };

  // Aqui, criamos o documento do usuário
  const docRef = await usersRef.add(userData);

  // Logo para testes
  logger.info(`Usuário criado com ID: ${docRef.id}`);

  // Retorno da função
  res.status(201).send({
    message: "Usuário criado com sucesso",
    id: docRef.id,
  });
};

export const uploadUserProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id: uid } = req.user!;
  const validatedData = await uploadProfileImageSchema.validate(req.body, {
    abortEarly: false,
  });
  const { fotoBase64, descricao } = validatedData;
  const matches = fotoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

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

  try {
    await file.save(buffer, {
      metadata: { contentType: mimeType },
      public: true,
    });

    const fotoUrl = "https://storage.googleapis.com/${bucket.name}/$filePath}";

    await admin.firestore().collection("users").doc(uid).update({
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
    res.status(500).send({ message: "Erro interno ao salvar imagem" });
  }
};

export const updateUserData = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id: uid } = req.user!;

  const validatedData = await updateUserSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  const updateData = {
    nome: validatedData.nome,
    curso_ocupacao: validatedData.curso_ocupacao,
    dtAniversario: admin.firestore.Timestamp.fromDate(
      validatedData.dtAniversario
    ),
    descricao: validatedData.descricao,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  };

  await admin.firestore().collection("users").doc(uid).update(updateData);

  res.status(200).send({
    message: "Dados atualizados com sucesso",
  });
};

export const getAuthenticatedUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = (req as any).user?.uid;

  const userDoc = await admin.firestore().collection("users").doc(id).get();
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
};
