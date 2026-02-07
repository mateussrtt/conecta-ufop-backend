import * as yup from "yup";

export const postCaronaSchema = yup.object().shape({
  veiculo: yup.string().required("O campo 'veiculo' é obrigatório"),

  vagas: yup
    .number()
    .required("O campo 'vagas' é obrigatório")
    .min(1, "O número de vagas deve ser pelo menos 1"),

  valor: yup
    .number()
    .required("O campo 'valor' é obrigatório")
    .min(0, "O valor não pode ser negativo"),

  dtPartida: yup
    .date()
    .required("O campo 'dtPartida' é obrigatório"),

  dtChegada: yup
    .date()
    .required("O campo 'dtChegada' é obrigatório"),

  origem: yup
    .object({
      nomeLocal: yup.string().required("O campo 'nomeLocal' é obrigatório"),
      cep: yup.string().required("O campo 'cep' é obrigatório"),
      rua: yup.string().required("O campo 'rua' é obrigatório"),
      numero: yup.number().required("O campo 'numero' é obrigatório"),
      bairro: yup.string().required("O campo 'bairro' é obrigatório"),
      cidade: yup.string().required("O campo 'cidade' é obrigatório"),
      estado: yup.string().required("O campo 'estado' é obrigatório"),
    })
    .required("O campo 'origem' é obrigatório"),

    destino: yup
    .object({
      nomeLocal: yup.string().required("O campo 'nomeLocal' é obrigatório"),
      cep: yup.string().required("O campo 'cep' é obrigatório"),
      rua: yup.string().required("O campo 'rua' é obrigatório"),
      numero: yup.number().required("O campo 'numero' é obrigatório"),
      bairro: yup.string().required("O campo 'bairro' é obrigatório"),
      cidade: yup.string().required("O campo 'cidade' é obrigatório"),
      estado: yup.string().required("O campo 'estado' é obrigatório"),
    })
    .required("O campo 'destino' é obrigatório"),
});
