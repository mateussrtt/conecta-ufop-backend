import { Request, Response } from "express";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { postUserSchema } from "../schemas/users";

export const createUser = async (
    req: Request,
    res: Response
): Promise<void> => {

    // Primeiro, validamos se os campos são válidos E compatíveis com o schema
    const validatedData = await postUserSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });

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
    const dtAniversarioTimestamp = admin.firestore.Timestamp.fromDate(
        dtAniversario
    );

    // Aqui, montamos o documento do usuário
    const userData = {
        nome,
        email,
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