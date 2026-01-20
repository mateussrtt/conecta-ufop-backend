# Conecta UFOP Backend

Backend do sistema Conecta UFOP, desenvolvido com Firebase Functions, Express e TypeScript.

## Pré-requisitos

- Node.js 20 ou superior
- npm 
- Firebase CLI instalado globalmente (`npm install -g firebase-tools`)
- Conta Firebase configurada

## Como rodar o projeto localmente

### 1. Instalar dependências

Na raiz do projeto:

```bash
npm install
```

Na pasta `functions`:

```bash
cd functions
npm install
```

### 2. Configurar Firebase

Certifique-se de estar autenticado no Firebase:

```bash
firebase login
```

### 3. Iniciar os emuladores

Para iniciar todos os emuladores (Firestore, Auth, Functions, Storage):

```bash
npm run emulator
```

Ou apenas as functions:

```bash
cd functions
npm run serve
```

Os emuladores estarão disponíveis em:
- **Functions**: http://localhost:5001
- **Firestore**: http://localhost:8080
- **Auth**: http://localhost:9099
- **UI**: http://localhost:4000

### 4. Acessar a documentação da API

Com os emuladores rodando, acesse:

```
http://localhost:5001/conecta-ufop/southamerica-east1/api/docs/
```

## Como rodar os testes

### Rodar todos os testes

Na raiz do projeto:

```bash
npm test
```

Ou na pasta `functions`:

```bash
cd functions
npm test
```

### Rodar testes em modo watch

```bash
cd functions
npm test -- --watch
```

### Rodar um arquivo de teste específico

```bash
cd functions
npm test -- users.test.ts
```

**Importante**: Os testes utilizam os emuladores do Firebase. Certifique-se de que os emuladores estão rodando antes de executar os testes.

## Estrutura de Pastas e Arquivos

```
conecta-ufop-backend/
├── functions/                    # Código das Cloud Functions
│   ├── src/                      # Código fonte TypeScript
│   │   ├── controllers/         # Controllers (lógica de negócio)
│   │   │   ├── migrations-controller.ts
│   │   │   └── users.ts
│   │   ├── middlewares/          # Middlewares do Express
│   │   │   ├── authenticate.ts   # Middleware de autenticação
│   │   │   ├── catch-async-errors.ts
│   │   │   └── error.ts          # Tratamento de erros
│   │   ├── schemas/              # Schemas de validação
│   │   │   └── swagger.json      # Documentação Swagger
│   │   ├── tests/                # Testes e utilitários de teste
│   │   │   ├── test-data.ts
│   │   │   ├── test-utils.ts
│   │   │   └── users.test.ts     # Testes do controller de usuários
│   │   ├── types/                # Definições de tipos TypeScript
│   │   │   └── types.d.ts        # Extensões de tipos
│   │   └── index.ts              # Arquivo principal (configuração Express)
│   ├── lib/                      # Código compilado (gerado automaticamente)
│   ├── package.json
│   └── tsconfig.json
├── firestore.rules               # Regras de segurança do Firestore
├── firestore.indexes.json        # Índices do Firestore
├── storage.rules                 # Regras de segurança do Storage
├── firebase.json                 # Configuração do Firebase
└── README.md                     # Este arquivo
```

## Explicação dos Componentes

### Controllers (`functions/src/controllers/`)

Os **controllers** contêm a lógica de negócio e processamento das requisições HTTP. Cada controller é responsável por um recurso específico da API.

**Exemplo**: `users.ts` contém a função `createUser`, que:
- Valida os dados recebidos
- Verifica regras de negócio (ex: email único)
- Interage com o Firestore
- Retorna a resposta HTTP apropriada

**Padrão de uso**:
```typescript
export const createUser = async (req: Request, res: Response): Promise<void> => {
  // Lógica do endpoint
};
```

### Index (`functions/src/index.ts`)

O arquivo **index.ts** é o ponto de entrada da aplicação. Ele:
- Configura o Express
- Inicializa o Firebase Admin
- Registra os middlewares globais
- Define as rotas da API
- Exporta a função Cloud Function

**Principais responsabilidades**:
- Configuração do ambiente (test vs produção)
- Setup do Express (CORS, JSON parser, etc.)
- Registro de rotas
- Tratamento global de erros
- Exportação da função `api` para o Firebase

### Schemas (`functions/src/schemas/`)

Os **schemas** definem a validação dos dados de entrada usando a biblioteca `yup`. Eles garantem que os dados recebidos nas requisições estão no formato correto antes de serem processados.

**Exemplo**: `users.ts` define o schema `postUserSchema` que valida:
- `nome`: string obrigatória
- `email`: string obrigatória com formato de email válido
- `curso_ocupacao`: string obrigatória
- `dtAniversario`: data obrigatória

### Types (`functions/src/types/`)

A pasta **types** contém definições de tipos TypeScript que estendem tipos de bibliotecas externas ou definem tipos globais do projeto.

**Exemplo**: `types.d.ts` estende a interface `Request` do Express para incluir a propriedade `user`, permitindo que os controllers acessem informações do usuário autenticado:

```typescript
declare module "express" {
  export interface Request {
    user?: User;
  }
}
```

**Uso**: Permite type-safety ao acessar `req.user` nos controllers após autenticação.

### Tests (`functions/src/tests/`)

Os **testes** garantem que o código funciona corretamente e previnem regressões. Eles são escritos usando Jest e Supertest.

**Estrutura dos testes**:
- Todos os testes ficam na pasta `tests/`
- Arquivos de teste seguem o padrão `*.test.ts` (ex: `users.test.ts`)
- Testes seguem o padrão "should..." nas descrições
- Utilizam os emuladores do Firebase para testes de integração
- Limpam dados após cada teste (`afterEach`)

**Exemplo de teste**:
```typescript
it("should create a user with valid data", async () => {
  const userData = { /* ... */ };
  const response = await request.post("/users").send(userData);
  expect(response.status).toBe(201);
});
```

**Utilitários de teste** (`functions/src/tests/`):
- `test-utils.ts`: Funções auxiliares para criar dados de teste
- `test-data.ts`: Dados mock reutilizáveis

## Scripts Disponíveis

### Na raiz do projeto:

- `npm test` - Executa todos os testes
- `npm run emulator` - Inicia todos os emuladores do Firebase
- `npm run deploy` - Faz deploy de tudo
- `npm run deploy:functions` - Faz deploy apenas das functions
- `npm run deploy:rules` - Faz deploy apenas das regras do Firestore

### Na pasta `functions/`:

- `npm run build` - Compila o TypeScript
- `npm run build:watch` - Compila em modo watch
- `npm run serve` - Inicia apenas o emulador de functions
- `npm run lint` - Executa o linter
- `npm test` - Executa os testes

## Autenticação

Alguns endpoints requerem autenticação. Use o middleware `authenticate()` do arquivo `middlewares/authenticate.ts`:

```typescript
app.post("/protected-route", authenticate(), controllerFunction);
```

O token JWT deve ser enviado no header:
```
Authorization: Bearer <token>
```

## Documentação da API

A documentação Swagger está disponível em `/docs` quando o servidor está rodando.

## Contribuindo

1. Crie uma branch para sua feature
2. Escreva testes para suas mudanças
3. Certifique-se de que todos os testes passam
4. Adicione seu endpoint no swagger
4. Faça um pull request

