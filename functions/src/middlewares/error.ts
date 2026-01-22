import { Request, Response, NextFunction } from "express";
import { ValidationError } from "yup";
import * as logger from "firebase-functions/logger";

export const onError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(err);

  if (err instanceof ValidationError) {
    return res.status(422).send({ message: err.message });
  }

  return res.status(500).send({
    message: "Erro interno do servidor",
  });
};
