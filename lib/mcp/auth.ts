import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

export async function resolveCompanyByUserNamePassword(input: {
  userName: string;
  password: string;
}): Promise<{ id: string; slug: string; userName: string }> {
  const userName = input.userName.trim();
  const password = input.password;

  if (!userName || !password) {
    throw new Error("userName and password are required");
  }
  if (userName.length > 255 || password.length > 1024) {
    throw new Error("Invalid credentials");
  }

  const company = await prisma.company.findUnique({
    where: { userName },
    select: { id: true, slug: true, userName: true, password: true },
  });

  const passwordHash = company?.password ?? null;
  if (!company || !passwordHash) {
    throw new Error("Invalid username or password");
  }

  const ok = await verifyPassword(password, passwordHash);
  if (!ok) {
    throw new Error("Invalid username or password");
  }

  return { id: company.id, slug: company.slug, userName: company.userName ?? userName };
}

