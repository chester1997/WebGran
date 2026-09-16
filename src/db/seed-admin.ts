import { db } from "./index";
import { users } from "./schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seedAdmin() {
  const email = "lf49127@gmail.com";
  const password = "Supa#9841";

  try {
    console.log("Verificando se o usuário admin já existe...");
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (existingAdmin) {
      console.log("O usuário admin já existe!");
      console.log(`Login: ${email}`);
      console.log(`Senha: ${password}`);
      process.exit(0);
    }

    console.log("Criando usuário admin...");
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.insert(users).values({
      name: "Administrador Supremo",
      email: email,
      password: hashedPassword,
      role: "admin"
    });

    console.log("✅ Usuário admin criado com sucesso!");
    console.log(`Login: ${email}`);
    console.log(`Senha: ${password}`);
    process.exit(0);
  } catch (error) {
    console.error("Erro ao criar admin:", error);
    process.exit(1);
  }
}

seedAdmin();
