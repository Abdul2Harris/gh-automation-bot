import "server-only";

import { InstallationAccountType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { getGitHubApp, getInstallationOctokit } from "@/lib/github/app";

type GitHubUserOctokit = Awaited<
  ReturnType<
    ReturnType<typeof getGitHubApp>["oauth"]["getUserOctokit"]
  >
>;

export async function syncUserInstallations(
  userId: string,
  userOctokit: GitHubUserOctokit,
) {
  const installations = [];
  let page = 1;

  while (true) {
    const response = await userOctokit.request("GET /user/installations", {
      per_page: 100,
      page,
    });
    installations.push(...response.data.installations);

    if (response.data.installations.length < 100) {
      break;
    }

    page += 1;
  }

  for (const installation of installations) {
    const account = installation.account;

    if (!account || typeof account === "string") {
      continue;
    }

    const accountLogin =
      "login" in account ? account.login : account.slug;

    if (!accountLogin) {
      continue;
    }

    const installationOctokit = await getInstallationOctokit(installation.id);
    const repositories = await installationOctokit.paginate(
      "GET /installation/repositories",
      { per_page: 100 },
    );

    await prisma.$transaction(async (transaction) => {
      const savedInstallation = await transaction.gitHubInstallation.upsert({
        where: { githubInstallationId: BigInt(installation.id) },
        create: {
          githubInstallationId: BigInt(installation.id),
          accountId: BigInt(account.id),
          accountLogin,
          accountType:
            installation.target_type === "Organization"
              ? InstallationAccountType.ORGANIZATION
              : InstallationAccountType.USER,
          suspendedAt: installation.suspended_at
            ? new Date(installation.suspended_at)
            : null,
        },
        update: {
          accountId: BigInt(account.id),
          accountLogin,
          accountType:
            installation.target_type === "Organization"
              ? InstallationAccountType.ORGANIZATION
              : InstallationAccountType.USER,
          suspendedAt: installation.suspended_at
            ? new Date(installation.suspended_at)
            : null,
        },
      });

      await transaction.userInstallation.upsert({
        where: {
          userId_installationId: {
            userId,
            installationId: savedInstallation.id,
          },
        },
        create: { userId, installationId: savedInstallation.id },
        update: {},
      });

      await transaction.repository.updateMany({
        where: { installationId: savedInstallation.id },
        data: { isActive: false },
      });

      for (const repository of repositories) {
        await transaction.repository.upsert({
          where: { githubRepositoryId: BigInt(repository.id) },
          create: {
            githubRepositoryId: BigInt(repository.id),
            installationId: savedInstallation.id,
            owner: repository.owner.login,
            name: repository.name,
            fullName: repository.full_name,
            isPrivate: repository.private,
            isActive: true,
          },
          update: {
            installationId: savedInstallation.id,
            owner: repository.owner.login,
            name: repository.name,
            fullName: repository.full_name,
            isPrivate: repository.private,
            isActive: true,
          },
        });
      }
    });
  }

  const verifiedInstallationIds = installations.map((installation) =>
    BigInt(installation.id),
  );

  await prisma.userInstallation.deleteMany({
    where: {
      userId,
      ...(verifiedInstallationIds.length > 0
        ? {
            installation: {
              githubInstallationId: { notIn: verifiedInstallationIds },
            },
          }
        : {}),
    },
  });

  return installations.length;
}

export async function getUserInstallations(userId: string) {
  return prisma.userInstallation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      installation: {
        include: {
          repositories: {
            where: { isActive: true },
            orderBy: { fullName: "asc" },
          },
        },
      },
    },
  });
}
