import supertest from "supertest";
import { app } from "../index";
import test from "firebase-functions-test";
import { clearFirestoreData } from "firebase-functions-test/lib/providers/firestore";
import * as admin from "firebase-admin";

const request = supertest(app);
const functionsTest = test({ projectId: "conecta-ufop" });

describe("POST /users", () => {
    it("should create a user with valid data", async () => {
        const uniqueEmail = `maria.silva.${Date.now()}@test.com`;
        const userData = {
            nome: "Maria Silva",
            email: uniqueEmail,
            senha: "Senha@123",
            curso_ocupacao: "Engenharia de Computação",
            dtAniversario: "2000-05-15T00:00:00.000Z",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty("message", "Usuário criado com sucesso");
        expect(response.body).toHaveProperty("id");

        // Verificar se o usuário foi salvo no Firestore
        const doc = await admin.firestore().collection("usuarios").doc(response.body.id).get();
        expect(doc.exists).toBe(true);

        const userDoc = doc.data();
        expect(userDoc?.nome).toBe(userData.nome);
        expect(userDoc?.email).toBe(userData.email);
        expect(userDoc?.curso_ocupacao).toBe(userData.curso_ocupacao);
        expect(userDoc?.criadoEm).toBeDefined();
        expect(userDoc?.dtAniversario).toBeInstanceOf(admin.firestore.Timestamp);
        expect(userDoc?.caronasOfericidasCont).toBe(0);
        expect(userDoc?.dtAniversario).toBeDefined();
        expect(userDoc?.dtAniversario).toBeInstanceOf(admin.firestore.Timestamp);
    });


    it("should return 422 when nome is missing", async () => {
        const userData = {
            email: "test@test.com",
            senha: "Senha@123",
            curso_ocupacao: "Engenharia",
            dtAniversario: "2000-05-15T00:00:00.000Z",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(422);
        expect(response.body.message).toContain("Nome é obrigatório");
    });

    it("should return 422 when email is missing", async () => {
        const userData = {
            nome: "Test User",
            senha: "Senha@123",
            curso_ocupacao: "Engenharia",
            dtAniversario: "2000-05-15T00:00:00.000Z",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(422);
        expect(response.body.message).toContain("Email é obrigatório");
    });

    it("should return 422 when curso_ocupacao is missing", async () => {
        const userData = {
            nome: "Test User",
            email: "test@test.com",
            senha: "Senha@123",
            dtAniversario: "2000-05-15T00:00:00.000Z",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(422);
        expect(response.body.message).toContain("Curso/ocupação é obrigatório");
    });

    it("should return 422 when dtAniversario is missing", async () => {
        const userData = {
            nome: "Test User",
            email: "test@test.com",
            senha: "Senha@123",
            curso_ocupacao: "Engenharia",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(422);
        expect(response.body.message).toContain("Data de aniversário é obrigatória");
    });

    it("should return 422 when email is invalid", async () => {
        const userData = {
            nome: "Test User",
            email: "email-invalido",
            senha: "Senha@123",
            curso_ocupacao: "Engenharia",
            dtAniversario: "2000-05-15T00:00:00.000Z",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(422);
        expect(response.body.message).toContain("Email deve ser um email válido");
    });


    it("should return 422 when dtAniversario is invalid", async () => {
        const userData = {
            nome: "Test User",
            email: "test@test.com",
            senha: "Senha@123",
            curso_ocupacao: "Engenharia",
            dtAniversario: "data-invalida",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(422);
        expect(response.body.message).toContain("Data de aniversário deve ser uma data válida");
    });

    it("should return 422 when senha is missing", async () => {
        const userData = {
            nome: "Test User",
            email: "test@test.com",
            curso_ocupacao: "Engenharia",
            dtAniversario: "2000-05-15T00:00:00.000Z",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(422);
        expect(response.body.message).toContain("Senha é obrigatória");
    });

    it("should return 422 when senha is too short", async () => {
        const userData = {
            nome: "Test User",
            email: "test@test.com",
            senha: "Ab1@",
            curso_ocupacao: "Engenharia",
            dtAniversario: "2000-05-15T00:00:00.000Z",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(422);
        expect(response.body.message).toContain("A senha deve ter no mínimo 8 caracteres");
    });

    it("should return 409 when email already exists", async () => {
        const uniqueEmail = `duplicado.${Date.now()}@test.com`;
        const userData = {
            nome: "Primeiro Usuário",
            email: uniqueEmail,
            senha: "Senha@123",
            curso_ocupacao: "Engenharia",
            dtAniversario: "2000-05-15T00:00:00.000Z",
        };

        // Criar primeiro usuário
        await request.post("/users").send(userData);

        // Tentar criar segundo usuário com mesmo email
        const response = await request.post("/users").send({
            ...userData,
            nome: "Segundo Usuário",
        });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe("Email já cadastrado");
    });


});

afterEach(async () => {
    await clearFirestoreData({ projectId: "conecta-ufop" });
});

afterAll(async () => {
    await clearFirestoreData({ projectId: "conecta-ufop" });
    await admin.app().delete();
    functionsTest.cleanup();
});