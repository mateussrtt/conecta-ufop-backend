import * as yup from "yup";

export const criarAvaliacaoSchema = yup.object({
  body: yup.object({
    caronaID: yup.string().required("caronaID é obrigatório"),
    nota: yup
      .number()
      .integer("Nota deve ser um número inteiro")
      .min(1, "Nota mínima é 1")
      .max(5, "Nota máxima é 5")
      .required("Nota é obrigatória"),
    comentario: yup.string().required("Comentário é obrigatório"),
  }),
});
