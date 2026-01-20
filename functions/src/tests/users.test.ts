import supertest from "supertest";
import { api } from "../index";
import test from "firebase-functions-test";
import { clearFirestoreData } from "firebase-functions-test/lib/providers/firestore";
import * as admin from "firebase-admin";

const request = supertest(api);
const functionsTest = test({ projectId: "conecta-ufop" });

describe("POST /users", () => {
    it("should create a user with valid data", async () => {
        const userData = {
            nome: "Maria Silva",
            email: "maria.silva@test.com",
            curso_ocupacao: "Engenharia de Computação",
            dtAniversario: "2000-05-15T00:00:00.000Z",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty("message", "Usuário criado com sucesso");
        expect(response.body).toHaveProperty("id");

        // Verificar se o usuário foi salvo no Firestore
        const doc = await admin.firestore().collection("users").doc(response.body.id).get();
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
            curso_ocupacao: "Engenharia",
            dtAniversario: "data-invalida",
        };

        const response = await request.post("/users").send(userData);

        expect(response.status).toBe(422);
        expect(response.body.message).toContain("Data de aniversário deve ser uma data válida");
    });


    it("should return 409 when email already exists", async () => {
        const userData = {
            nome: "Primeiro Usuário",
            email: "duplicado@test.com",
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

afterAll(() => {
    functionsTest.cleanup();
});
