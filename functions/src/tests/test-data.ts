// Dados de teste genéricos para o projeto Conecta UFOP
import * as admin from "firebase-admin";

// Dados de teste genéricos para o projeto Conecta UFOP

export const enderecoPadrao = {
  nomeLocal: "UFOP - Campus",
  cep: "35400-000",
  rua: "Rua Trinta e Seis",
  numero: 115,
  bairro: "Centro",
  cidade: "Ouro Preto",
  estado: "MG",
};

export const createCaronaPayload = (dtPartida?: Date, dtChegada?: Date) => {
  const partida = dtPartida  new Date(Date.now() + 24 * 60 * 60 * 1000);
  const chegada = dtChegada  new Date(partida.getTime() + 2 * 60 * 60 * 1000);
  return {
    veiculo: { modelo: "Fiat Uno", placa: "ABC-1234" },
    vagas: 3,
    valor: 15,
    dtPartida: partida.toISOString(),
    dtChegada: chegada.toISOString(),
    origem: enderecoPadrao,
    destino: { ...enderecoPadrao, nomeLocal: "Rodoviária Ouro Preto" },
  };
};

export const createUsuarioDoc = (uid: string, overrides: Record<string, unknown> = {}) => ({
  nome: "Motorista Teste",
  email: ${uid}@test.com,
  curso_ocupacao: "Engenharia",
  dtAniversario: admin.firestore.Timestamp.fromDate(new Date("2000-01-15")),
  criadoEm: admin.firestore.Timestamp.now(),
  caronasOfericidasCont: 0,
  ...overrides,
});