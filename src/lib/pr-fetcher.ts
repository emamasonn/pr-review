import { Octokit } from "@octokit/rest";
import { PRDetails, PRFile } from "./types";

export async function fetchPR(
  octokit: Octokit,
  owner: string,
  repoName: string,
  prNumber: number
): Promise<PRDetails> {
  const { data: pr } = await octokit.pulls.get({
    owner,
    repo: repoName,
    pull_number: prNumber,
  });

  const { data: filesRaw } = await octokit.pulls.listFiles({
    owner,
    repo: repoName,
    pull_number: prNumber,
    per_page: 100,
  });

  const files: PRFile[] = filesRaw.map((f) => ({
    filename: f.filename,
    status: f.status as PRFile["status"],
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));

  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    author: pr.user?.login ?? "unknown",
    base: pr.base.ref,
    head: pr.head.ref,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    files,
    commits: pr.commits,
    additions: pr.additions,
    deletions: pr.deletions,
  };
}
