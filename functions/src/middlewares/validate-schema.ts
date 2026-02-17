import { Request, Response, NextFunction } from "express";
import { AnyObjectSchema } from "yup";

export const validateSchema =
  (schema: AnyObjectSchema) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.validate(
        {
          body: req.body,
          params: req.params,
          query: req.query,
        },
        {
          abortEarly: false,
        }
      );

      return next();
    } catch (err: any) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: err.errors,
      });
    }
  };
