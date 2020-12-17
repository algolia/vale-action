import * as core from '@actions/core';
import * as github from '@actions/github';
import * as tmp from 'tmp';
import * as fs from 'fs';

import {CheckRunner} from './check';
import * as input from './input';

const execa = require('execa');

/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const {GITHUB_TOKEN, GITHUB_WORKSPACE} = process.env;

export async function run(actionInput: input.Input): Promise<void> {
  const startedAt = new Date().toISOString();

  const command = fs.existsSync('./scripts/lint-content') ? './scripts/lint-content' : 'vale';
  core.info(`Using command: ${command}`)
  const alertResp = await execa(command, actionInput.args);

  let runner = new CheckRunner();

  let sha = github.context.sha;
  if (github.context.payload.pull_request?.head?.sha) {
    sha = github.context.payload.pull_request.head.sha;
  }

  runner.makeAnnotations(alertResp.stdout);
  await runner.executeCheck({
    token: actionInput.token,
    name: 'Vale',
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    head_sha: sha,
    started_at: startedAt,
    context: {vale: actionInput.version}
  });
}

async function main(): Promise<void> {
  try {
    const userToken = GITHUB_TOKEN as string;
    const workspace = GITHUB_WORKSPACE as string;

    const tmpobj = tmp.fileSync({postfix: '.ini', dir: workspace});
    const actionInput = await input.get(tmpobj, userToken, workspace);

    await run(actionInput);

    tmpobj.removeCallback();
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
