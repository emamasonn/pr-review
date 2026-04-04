import { Octokit } from "@octokit/rest";

export async function fetchRawDiff(
  octokit: Octokit,
  owner: string,
  repoName: string,
  prNumber: number
): Promise<string> {
  const response = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner,
    repo: repoName,
    pull_number: prNumber,
    headers: { accept: "application/vnd.github.v3.diff" },
  });

  const raw = response.data as unknown as string;
  if (!raw || typeof raw !== "string") {
    throw new Error(`No se pudo obtener el diff del PR #${prNumber}`);
  }
  return raw;
}
