import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

type SignupBody = {
  name?: string;
  slug?: string;
  userName?: string;
  password?: string;
  email?: string;
};

function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 255);
  return s || "company";
}

export async function POST(request: Request) {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const userName =
    typeof body.userName === "string" ? body.userName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const slugRaw =
    typeof body.slug === "string" && body.slug.trim()
      ? body.slug.trim()
      : slugify(name);
  const slug = slugify(slugRaw);
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : undefined;

  if (!name || !userName || !password) {
    return NextResponse.json(
      { error: "name, userName, and password are required" },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "password must be at least 8 characters" },
      { status: 400 },
    );
  }

  if (
    name.length > 255 ||
    userName.length > 255 ||
    slug.length > 255 ||
    slug.length === 0
  ) {
    return NextResponse.json(
      { error: "name, userName, and slug must be 1–255 characters" },
      { status: 400 },
    );
  }

  if (email !== undefined && email.length > 255) {
    return NextResponse.json({ error: "email is too long" }, { status: 400 });
  }

  if (email) {
    const taken = await prisma.company.findUnique({
      where: { email },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json(
        { error: "Email is already registered" },
        { status: 409 },
      );
    }
  }

  const passwordHashed = await hashPassword(password);

  try {
    const company = await prisma.company.create({
      data: {
        name,
        slug,
        userName,
        password: passwordHashed,
        ...(email ? { email } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        userName: true,
        email: true,
        subscriptionStatus: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target as string[] | undefined;
      const field = target?.includes("userName")
        ? "userName"
        : target?.includes("slug")
          ? "slug"
          : target?.includes("email")
            ? "email"
            : "field";
      return NextResponse.json(
        {
          error:
            field === "userName"
              ? "This company username is already taken"
              : field === "slug"
                ? "This slug is already taken; try another or omit slug"
                : "Unique constraint violated",
        },
        { status: 409 },
      );
    }
    throw e;
  }
}
