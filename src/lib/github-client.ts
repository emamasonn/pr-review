import { Octokit } from "@octokit/rest";

export function createClient(): Octokit {
  const token = process.env.GITHUB_PAT;
  if (!token) {
    throw new Error(
      "GITHUB_PAT no encontrado. Agregalo a .env.local"
    );
  }
  return new Octokit({ auth: token });
}

export function parseRepo(repoOverride?: string): { owner: string; repoName: string } {
  const raw = repoOverride || process.env.GITHUB_REPO || "";
  if (!raw || !raw.includes("/")) {
    throw new Error(
      `Repositorio inválido: "${raw}". Formato: owner/repo`
    );
  }
  const [owner, repoName] = raw.split("/");
  return { owner, repoName };
}
