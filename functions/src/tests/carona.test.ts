import supertest from "supertest";
import { app } from "../index";
import * as admin from "firebase-admin";

const request = supertest(app);

describe("POST /caronas", () => {

afterAll(async () => {

await admin.app().delete();

});



it("should create carona", async () => {

const carona = {

motoristaId: "user123",

origem: "UFOP",

destino: "BH",

dataHoraSaida: "2026-03-10T10:00:00.000Z",

vagas: 3,

valor: 20

};


const res = await request
.post("/caronas")
.send(carona);


console.log(res.body);


expect(res.status).toBe(201);

expect(res.body).toHaveProperty("id");

});



it("should fail if origem missing", async () => {

const res = await request
.post("/caronas")
.send({

motoristaId: "123",

destino: "BH",

dataHoraSaida: "2026-03-10T10:00:00.000Z",

vagas: 3,

valor: 20

});


expect(res.status).toBe(422);

});


});