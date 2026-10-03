import { Prisma } from "@fitlens/db";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../infra/prisma/prisma.service.js";
import type { UsersService } from "../users/users.service.js";
import { IdentityRejected, IdentityService } from "./identity.service.js";

const identity = {
  subject: "sub-1",
  email: "asha@example.com",
  emailVerified: true,
  name: "Asha",
  picture: null,
  nonce: "n",
};
const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

function setup() {
  const prisma = {
    authIdentity: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const users = {
    findIdByEmail: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue("user-new"),
    fillMissing: vi.fn().mockResolvedValue(undefined),
  };
  const service = new IdentityService(
    prisma as unknown as PrismaService,
    users as unknown as UsersService,
  );
  return { prisma, users, service };
}

describe("IdentityService", () => {
  it("returns the known user for a known subject and records the sign-in", async () => {
    const { prisma, users, service } = setup();
    prisma.authIdentity.findUnique.mockResolvedValue({ id: "ident-1", userId: "user-1" });
    await expect(service.resolveUser("GOOGLE", identity)).resolves.toBe("user-1");
    expect(prisma.authIdentity.update).toHaveBeenCalledWith({
      where: { id: "ident-1" },
      data: { lastSignInAt: expect.any(Date), email: "asha@example.com" },
    });
    expect(users.create).not.toHaveBeenCalled();
  });

  it("creates a user and identity for a first sign-in", async () => {
    const { prisma, users, service } = setup();
    await expect(service.resolveUser("GOOGLE", identity)).resolves.toBe("user-new");
    expect(users.create).toHaveBeenCalledWith({
      email: "asha@example.com",
      name: "Asha",
      image: null,
      emailVerified: expect.any(Date),
    });
    expect(prisma.authIdentity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-new", provider: "GOOGLE", subject: "sub-1" }),
    });
  });

  it("refuses a missing or unverified email for a new identity", async () => {
    const { service } = setup();
    await expect(service.resolveUser("GOOGLE", { ...identity, email: null })).rejects.toEqual(
      new IdentityRejected("email_missing"),
    );
    await expect(
      service.resolveUser("GOOGLE", { ...identity, emailVerified: false }),
    ).rejects.toEqual(new IdentityRejected("email_unverified"));
  });

  it("refuses to attach a second identity from the same provider by email", async () => {
    const { prisma, users, service } = setup();
    users.findIdByEmail.mockResolvedValue("user-1");
    prisma.authIdentity.findFirst.mockResolvedValue({ id: "other" });
    await expect(service.resolveUser("GOOGLE", identity)).rejects.toEqual(
      new IdentityRejected("email_taken"),
    );
    expect(prisma.authIdentity.create).not.toHaveBeenCalled();
  });

  it("retries when a concurrent first sign-in wins the race", async () => {
    const { prisma, users, service } = setup();
    users.create.mockRejectedValueOnce(p2002());
    // Second attempt: the other request has finished; its identity now exists.
    prisma.authIdentity.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "ident-1", userId: "user-1" });
    await expect(service.resolveUser("GOOGLE", identity)).resolves.toBe("user-1");
  });

  it("gives up after repeated conflicts and rethrows other errors", async () => {
    const { users, service } = setup();
    users.create.mockRejectedValue(p2002());
    await expect(service.resolveUser("GOOGLE", identity)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    expect(users.create).toHaveBeenCalledTimes(3);

    const boom = setup();
    boom.users.create.mockRejectedValue(new Error("db down"));
    await expect(boom.service.resolveUser("GOOGLE", identity)).rejects.toThrow("db down");
    expect(boom.users.create).toHaveBeenCalledTimes(1);
  });
});
