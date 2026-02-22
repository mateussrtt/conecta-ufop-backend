import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { FieldValue } from "@google-cloud/firestore";
import * as logger from "firebase-functions/logger";

interface Migration {
  fn: () => Promise<void>;
}

const migrations: Migration[] = [];

const runMigration = async (migration: Migration) => {
  const migrationsCollection = admin
    .firestore()
    .collection("meta")
    .doc("migrations");
  const migrationDoc = await migrationsCollection.get();
  const executedMigrations = migrationDoc.exists
    ? migrationDoc.data()?.executed
    : [];

  if (executedMigrations.includes(migration.fn.name)) {
    console.log(`Migration ${migration.fn.name} has already been executed.`);
    return;
  }

  // Run the migration function
  await migration.fn();

  // Record the migration name in the migrations collection once it completes
  if (!migrationDoc.exists) {
    await migrationsCollection.set({ executed: [migration.fn.name] });
  } else {
    await migrationsCollection.update({
      executed: FieldValue.arrayUnion(migration.fn.name),
    });
  }

  console.log(`Migration ${migration.fn.name} completed!`);
};

export const migrationsUp = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    for (const migration of migrations) {
      await runMigration(migration);
    }
    res.status(200).send({ message: "Migrations completed!" });
  } catch (err) {
    logger.error("Erro ao executar migrations", err);
    res.status(500).send({
      message: "Erro interno ao executar migrations",
    });
  }
};
