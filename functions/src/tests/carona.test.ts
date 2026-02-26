import supertest from "supertest";
import { api } from "../index";
import test from "firebase-functions-test";
import { clearFirestoreData } from "firebase-functions-test/lib/providers/firestore";
import * as admin from "firebase-admin";
import { mockCreateUser } from "./test-utils";
import { createCaronaPayload, createUsuarioDoc } from "./test-data";

const request = supertest(api);
const functionsTest = test({ projectId: "conecta-ufop" });

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Controller de Caronas", () => {
  afterEach(async () => {
    await clearFirestoreData({ projectId: "conecta-ufop" });
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  describe("POST /carona - createCarona", () => {
    it("deve retornar 401 sem token", async () => {
      const payload = createCaronaPayload();
      const response = await request.post("/carona").send(payload);
      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Token não fornecido");
    });

    it("deve criar carona com dados válidos e usuário autenticado", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const payload = createCaronaPayload();
      const response = await request
        .post("/carona")
        .set(authHeader(jwt!))
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("message", "Carona criada com sucesso");
      expect(response.body).toHaveProperty("id");

      const doc = await admin.firestore().collection("caronas").doc(response.body.id).get();
      expect(doc.exists).toBe(true);
      const data = doc.data();
      expect(data?.motoristaId).toBe(uid);
      expect(data?.status).toBe("ABERTA");
      expect(data?.vagas).toBe(payload.vagas);
      expect(data?.valor).toBe(payload.valor);
      expect(data?.origem.nomeLocal).toBe(payload.origem.nomeLocal);
      expect(data?.destino.nomeLocal).toBe(payload.destino.nomeLocal);
      expect(data?.passageiros).toEqual([]);
      expect(data?.solicitacoes).toEqual([]);
    });

    it("deve retornar 400 quando dtPartida >= dtChegada", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const partida = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const chegada = new Date(partida.getTime() - 60 * 60 * 1000);
      const payload = createCaronaPayload(partida, chegada);

      const response = await request
        .post("/carona")
        .set(authHeader(jwt!))
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Data de partida deve ser anterior à data de chegada");
    });

    it("deve retornar 422 quando veiculo está ausente", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const payload = createCaronaPayload();
      const { veiculo, ...rest } = payload;
      const response = await request
        .post("/carona")
        .set(authHeader(jwt!))
        .send(rest);

      expect(response.status).toBe(422);
      expect(response.body.message).toContain("veiculo");
    });

    it("deve retornar 422 quando vagas é inválida", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const payload = createCaronaPayload();
      const response = await request
        .post("/carona")
        .set(authHeader(jwt!))
        .send({ ...payload, vagas: 0 });

      expect(response.status).toBe(422);
    });

    it("deve retornar 422 quando origem está incompleta", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const payload = createCaronaPayload();
      const { origem, ...rest } = payload;
      const response = await request
        .post("/carona")
        .set(authHeader(jwt!))
        .send({ ...rest, origem: {} });

      expect(response.status).toBe(422);
    });
  });

  describe("GET /carona/:id - getCaronaById", () => {
    it("deve retornar 404 para carona inexistente", async () => {
      const response = await request.get("/carona/doc-inexistente-id");
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Carona não encontrada");
    });

    it("deve retornar 404 quando motorista não existe", async () => {
      const motoristaId = "motorista-inexistente";
      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "A" },
        destino: { nomeLocal: "B" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request.get(`/carona/${caronaRef.id}`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Motorista não encontrado");
    });

    it("deve retornar carona com detalhes do motorista", async () => {
      const { uid } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: uid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.fromDate(new Date()),
        dtChegada: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 60 * 1000)),
        criadoEm: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [],
        veiculo: { modelo: "Fiat Uno", placa: "ABC-1234" },
      });

      const response = await request.get(`/carona/${caronaRef.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("motorista");
      expect(response.body.motorista.nome).toBe("Motorista Teste");
      expect(response.body).toHaveProperty("origem");
      expect(response.body).toHaveProperty("destino");
      expect(response.body).toHaveProperty("veiculo");
      expect(response.body.veiculo.modelo).toBe("Fiat Uno");
      expect(response.body.vagasDisponiveis).toBe(3);
    });
  });

  describe("GET /caronas - getAllCaronas", () => {
    it("deve retornar lista vazia quando não há caronas abertas", async () => {
      const response = await request.get("/caronas");
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("deve retornar caronas abertas com vagas disponíveis", async () => {
      const { uid } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      await admin.firestore().collection("caronas").add({
        motoristaId: uid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.fromDate(new Date()),
        dtChegada: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 60 * 1000)),
        criadoEm: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [],
        veiculo: { modelo: "Fiat Uno", placa: "ABC-1234" },
      });

      const response = await request.get("/caronas");
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty("motorista");
      expect(response.body[0]).toHaveProperty("origem");
      expect(response.body[0]).toHaveProperty("destino");
      expect(response.body[0]).toHaveProperty("vagasDisponiveis");
    });
  });

  describe("GET /caronas/minhasCaronas - getMinhasCaronas", () => {
    it("deve retornar 401 sem autenticação", async () => {
      const response = await request.get("/caronas/minhasCaronas");
      expect(response.status).toBe(401);
    });

    it("deve retornar comoMotorista e comoPassageiro vazios para usuário sem caronas", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const response = await request
        .get("/caronas/minhasCaronas")
        .set(authHeader(jwt!));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("comoMotorista");
      expect(response.body).toHaveProperty("comoPassageiro");
      expect(response.body.comoMotorista).toEqual([]);
      expect(response.body.comoPassageiro).toEqual([]);
    });

    it("deve listar caronas como motorista", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      await admin.firestore().collection("caronas").add({
        motoristaId: uid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.fromDate(new Date()),
        dtChegada: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 60 * 1000)),
        criadoEm: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [],
        veiculo: { modelo: "Fiat Uno", placa: "ABC-1234" },
      });

      const response = await request
        .get("/caronas/minhasCaronas")
        .set(authHeader(jwt!));

      expect(response.status).toBe(200);
      expect(response.body.comoMotorista.length).toBe(1);
      expect(response.body.comoMotorista[0]).toHaveProperty("eMotorista", true);
    });
  });

  describe("POST /carona/solicitar/:caronaID - solicitarCarona", () => {
    it("deve retornar 401 sem autenticação", async () => {
      const response = await request.post("/carona/solicitar/carona-id-qualquer");
      expect(response.status).toBe(401);
    });

    it("deve retornar 404 para carona inexistente", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const response = await request
        .post("/carona/solicitar/doc-inexistente")
        .set(authHeader(jwt!));

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Carona não encontrada");
    });

    it("deve retornar 400 quando motorista tenta solicitar própria carona", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: uid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .post(`/carona/solicitar/${caronaRef.id}`)
        .set(authHeader(jwt!));

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("O motorista não pode solicitar a própria carona");
    });

    it("deve enviar solicitação com sucesso", async () => {
      const { uid: motoristaUid } = await mockCreateUser();
      const { uid: passageiroUid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(motoristaUid).set(createUsuarioDoc(motoristaUid));
      await admin.firestore().collection("usuarios").doc(passageiroUid).set(createUsuarioDoc(passageiroUid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: motoristaUid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .post(`/carona/solicitar/${caronaRef.id}`)
        .set(authHeader(jwt!));

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Solicitação de carona enviada com sucesso!");

      const doc = await caronaRef.get();
      const data = doc.data();
      expect(data?.solicitacoes).toContain(passageiroUid);
    });

    it("deve retornar 409 ao solicitar novamente (já solicitou)", async () => {
      const { uid: motoristaUid } = await mockCreateUser();
      const { uid: passageiroUid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(motoristaUid).set(createUsuarioDoc(motoristaUid));
      await admin.firestore().collection("usuarios").doc(passageiroUid).set(createUsuarioDoc(passageiroUid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: motoristaUid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [passageiroUid],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .post(`/carona/solicitar/${caronaRef.id}`)
        .set(authHeader(jwt!));

      expect(response.status).toBe(409);
      expect(response.body.message).toContain("já enviou uma solicitação");
    });
  });

  describe("PATCH /carona/:caronaID/status - alterarStatusCarona", () => {
    it("deve retornar 401 sem autenticação", async () => {
      const response = await request
        .patch("/carona/carona-id/status")
        .send({ status: "INICIADA" });
      expect(response.status).toBe(401);
    });

    it("deve retornar 404 para carona inexistente", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const response = await request
        .patch("/carona/doc-inexistente/status")
        .set(authHeader(jwt!))
        .send({ status: "INICIADA" });

      expect(response.status).toBe(404);
    });

    it("deve retornar 403 quando não é o motorista", async () => {
      const { uid: motoristaUid } = await mockCreateUser();
      const { uid: outroUid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(motoristaUid).set(createUsuarioDoc(motoristaUid));
      await admin.firestore().collection("usuarios").doc(outroUid).set(createUsuarioDoc(outroUid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: motoristaUid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .patch(`/carona/${caronaRef.id}/status`)
        .set(authHeader(jwt!))
        .send({ status: "INICIADA" });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Apenas o motorista responsável");
    });

    it("deve alterar status de ABERTA para INICIADA", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: uid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .patch(`/carona/${caronaRef.id}/status`)
        .set(authHeader(jwt!))
        .send({ status: "INICIADA" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("INICIADA");

      const doc = await caronaRef.get();
      expect(doc.data()?.status).toBe("INICIADA");
    });

    it("deve retornar 400 ao tentar INICIADA quando status não é ABERTA", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: uid,
        status: "INICIADA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .patch(`/carona/${caronaRef.id}/status`)
        .set(authHeader(jwt!))
        .send({ status: "INICIADA" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("ABERTA");
    });

    it("deve alterar status de INICIADA para FINALIZADA", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: uid,
        status: "INICIADA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .patch(`/carona/${caronaRef.id}/status`)
        .set(authHeader(jwt!))
        .send({ status: "FINALIZADA" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("FINALIZADA");
    });
  });

  describe("PATCH /carona/:caronaID/solicitacao/:passageiroID - responderSolicitacao", () => {
    it("deve retornar 401 sem autenticação", async () => {
      const response = await request
        .patch("/carona/carona-id/solicitacao/passageiro-id")
        .send({ aceite: true });
      expect(response.status).toBe(401);
    });

    it("deve retornar 404 para carona inexistente", async () => {
      const { uid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(uid).set(createUsuarioDoc(uid));

      const response = await request
        .patch("/carona/doc-inexistente/solicitacao/passageiro-id")
        .set(authHeader(jwt!))
        .send({ aceite: true });

      expect(response.status).toBe(404);
    });

    it("deve retornar 403 quando não é o motorista", async () => {
      const { uid: motoristaUid } = await mockCreateUser();
      const { uid: passageiroUid } = await mockCreateUser();
      const { uid: outroUid, jwt } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(motoristaUid).set(createUsuarioDoc(motoristaUid));
      await admin.firestore().collection("usuarios").doc(passageiroUid).set(createUsuarioDoc(passageiroUid));
      await admin.firestore().collection("usuarios").doc(outroUid).set(createUsuarioDoc(outroUid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: motoristaUid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [passageiroUid],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .patch(`/carona/${caronaRef.id}/solicitacao/${passageiroUid}`)
        .set(authHeader(jwt!))
        .send({ aceite: true });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Apenas o motorista responsável");
    });

    it("deve aceitar solicitação com sucesso", async () => {
      const { uid: motoristaUid, jwt } = await mockCreateUser();
      const { uid: passageiroUid } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(motoristaUid).set(createUsuarioDoc(motoristaUid));
      await admin.firestore().collection("usuarios").doc(passageiroUid).set(createUsuarioDoc(passageiroUid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: motoristaUid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [passageiroUid],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .patch(`/carona/${caronaRef.id}/solicitacao/${passageiroUid}`)
        .set(authHeader(jwt!))
        .send({ aceite: true });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Passageiro confirmado");

      const doc = await caronaRef.get();
      const data = doc.data();
      expect(data?.passageiros).toContain(passageiroUid);
      expect(data?.solicitacoes).not.toContain(passageiroUid);
    });

    it("deve recusar solicitação com sucesso", async () => {
      const { uid: motoristaUid, jwt } = await mockCreateUser();
      const { uid: passageiroUid } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(motoristaUid).set(createUsuarioDoc(motoristaUid));
      await admin.firestore().collection("usuarios").doc(passageiroUid).set(createUsuarioDoc(passageiroUid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: motoristaUid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [passageiroUid],
        recusados: [],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .patch(`/carona/${caronaRef.id}/solicitacao/${passageiroUid}`)
        .set(authHeader(jwt!))
        .send({ aceite: false });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("recusada");

      const doc = await caronaRef.get();
      const data = doc.data();
      expect(data?.solicitacoes).not.toContain(passageiroUid);
      expect(data?.recusados).toContain(passageiroUid);
    });

    it("deve retornar 404 quando solicitação do passageiro não existe", async () => {
      const { uid: motoristaUid, jwt } = await mockCreateUser();
      const { uid: passageiroUid } = await mockCreateUser();
      await admin.firestore().collection("usuarios").doc(motoristaUid).set(createUsuarioDoc(motoristaUid));
      await admin.firestore().collection("usuarios").doc(passageiroUid).set(createUsuarioDoc(passageiroUid));

      const caronaRef = await admin.firestore().collection("caronas").add({
        motoristaId: motoristaUid,
        status: "ABERTA",
        vagas: 3,
        valor: 15,
        origem: { nomeLocal: "UFOP" },
        destino: { nomeLocal: "Rodoviária" },
        dtPartida: admin.firestore.Timestamp.now(),
        dtChegada: admin.firestore.Timestamp.now(),
        passageiros: [],
        solicitacoes: [],
        veiculo: { modelo: "Fiat", placa: "ABC" },
      });

      const response = await request
        .patch(`/carona/${caronaRef.id}/solicitacao/${passageiroUid}`)
        .set(authHeader(jwt!))
        .send({ aceite: true });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Solicitação deste passageiro não encontrada");
    });
  });
});
