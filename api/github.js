// api/github.js
import { Octokit } from "@octokit/rest";
import child_process from "child_process";
import util from "util";
const exec = util.promisify(child_process.exec);

export async function createGithubRepoAndPush({ ownerOrUser, repoName, filesMap }) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN missing");
  const octokit = new Octokit({ auth: token });
  // create repo for authenticated user
  const resp = await octokit.repos.createForAuthenticatedUser({ name: repoName, private: false, auto_init: false, license_template: "mit" });
  const owner = resp.data.owner.login;
  const name = resp.data.name;

  // create files via contents API
  let latestSha = null;
  for (const [pathName, content] of Object.entries(filesMap)) {
    const r = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: name,
      path: pathName,
      message: `Add ${pathName}`,
      content: Buffer.from(content, "utf8").toString("base64"),
    });
    latestSha = r.data.commit.sha;
  }

  // Try to enable pages - call the API. Some accounts default to main branch; try createPagesSite
  try {
    await octokit.repos.createPagesSite({ owner, repo: name, source: { branch: "main", path: "/" } });
  } catch (err) {
    // Some repos may default to "master" branch; ignore if fails
    console.warn("createPagesSite failed:", err.message);
  }

  const pagesUrl = `https://${owner}.github.io/${name}/`;
  return { repoUrl: `https://github.com/${owner}/${name}`, commitSha: latestSha, pagesUrl };
}

export async function enablePagesWithGh(repoName, owner) {
  // attempt to enable pages using gh CLI (must be installed and authenticated)
  try {
    // creates repo pages site from main
    await exec(`gh repo view ${owner}/${repoName} --json url`);
    await exec(`gh api -X POST /repos/${owner}/${repoName}/pages -f source='{"branch":"main","path":"/"}'`);
  } catch (err) {
    console.warn("enablePagesWithGh failed:", err.message);
  }
}
