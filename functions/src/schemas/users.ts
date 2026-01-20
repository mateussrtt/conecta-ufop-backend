import { date, object, string } from "yup";

export const postUserSchema = object({
    nome: string().required("Nome é obrigatório"),
    email: string()
        .email("Email deve ser um email válido")
        .required("Email é obrigatório"),
    curso_ocupacao: string().required("Curso/ocupação é obrigatório"),
    dtAniversario: date()
        .required("Data de aniversário é obrigatória")
        .typeError("Data de aniversário deve ser uma data válida"),
});