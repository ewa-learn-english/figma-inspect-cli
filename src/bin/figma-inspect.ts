#!/usr/bin/env node

import { CliError, runCli } from "../cli.js";

runCli(process.argv.slice(2), {
  env: process.env,
  stdout: process.stdout,
  stderr: process.stderr,
}).catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`);
  } else if (error instanceof Error) {
    process.stderr.write(`Unexpected error: ${error.message}\n`);
  } else {
    process.stderr.write("Unexpected error: unknown error\n");
  }

  process.exitCode = 1;
});
