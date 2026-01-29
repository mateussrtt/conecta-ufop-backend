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

export const uploadProfileImageSchema = object({
    fotoBase64: string().required('A string Base64 da foto é obrigatória'),
    descricao: string().required('A descrição é obrigatória'),
});

export const updateUserSchema = object({
    nome: string().required("Nome é obrigatório"),
    curso_ocupacao: string().required("Cruso/Ocupação é obrigatório"),
    dtAniversario: date().required("Data de aniversário é obrigatória").typeError("Data inválida"),
    descricao: string().required("Descrição é obrigatória"),
});