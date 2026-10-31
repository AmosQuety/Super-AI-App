import "./support/testEnvironment";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { parse, specifiedRules, validate } from "graphql";
import { typeDefs } from "../src/schema/schema";

// Every query, mutation and subscription written in the web and mobile code must be valid
// against the schema this server publishes. A mismatch (a wrong variable type, a field that no
// longer exists) makes the server refuse the request every time, and the feature behind it
// silently never works; this check catches it before a release instead of in the logs.
const repo = path.resolve(__dirname, "../..");
const CLIENT_FOLDERS = ["web/src", "web/App.tsx", "web/index.tsx", "mobile/App/app", "mobile/App/services", "mobile/App/hooks", "mobile/App/libs"];

function sourceFiles(entry: string): string[] {
  const full = path.join(repo, entry);
  let info;
  try {
    info = statSync(full);
  } catch {
    return [];
  }
  if (info.isFile()) return /\.(ts|tsx)$/.test(full) ? [full] : [];
  return readdirSync(full).flatMap((name) =>
    name === "node_modules" ? [] : sourceFiles(path.join(entry, name)),
  );
}

interface ClientDocument {
  file: string;
  text: string;
}

function documentsIn(file: string): ClientDocument[] {
  const source = readFileSync(file, "utf8");
  const templates = [...source.matchAll(/gql`([\s\S]*?)`/g)].map((match) => match[1]);
  // Fragments used through ${FRAGMENT} interpolation are defined in the same file; make them
  // available to every document of that file.
  const fragments = templates.filter((text) => /^\s*fragment\s/.test(text));
  return templates
    .filter((text) => !/^\s*fragment\s/.test(text))
    .map((text) => {
      const body = text.replace(/\$\{[^}]*\}/g, "");
      return { file: path.relative(repo, file), text: [body, ...fragments.map((f) => f.replace(/\$\{[^}]*\}/g, ""))].join("\n") };
    });
}

let documentsChecked = 0;

function clientProblems(): string[] {
  const schema = makeExecutableSchema({
    typeDefs,
    resolverValidationOptions: { requireResolversToMatchSchema: "ignore" },
  });
  // Fragments are shared by every document of a file, so an unused one is not a mistake.
  const rules = specifiedRules.filter((rule) => rule.name !== "NoUnusedFragmentsRule");

  const problems: string[] = [];
  for (const file of CLIENT_FOLDERS.flatMap(sourceFiles)) {
    for (const doc of documentsIn(file)) {
      documentsChecked++;
      let parsed;
      try {
        parsed = parse(doc.text);
      } catch (error: any) {
        problems.push(`${doc.file}: cannot be read as GraphQL (${error.message})`);
        continue;
      }
      const operationName = parsed.definitions.find((d: any) => d.kind === "OperationDefinition") as any;
      for (const error of validate(schema, parsed, rules)) {
        problems.push(`${doc.file} ${operationName?.name?.value ?? "(unnamed)"}: ${error.message}`);
      }
    }
  }
  return problems;
}

const problems = clientProblems();
// A search that finds almost nothing would pass for the wrong reason (moved folders, a changed
// way of writing queries); both clients have dozens of documents.
assert.ok(documentsChecked >= 40, `only ${documentsChecked} client documents were found; the check is not looking in the right place`);
assert.deepEqual(problems, [], `\n${problems.join("\n")}\n`);
console.log(`clientQueriesMatchSchema tests passed (${documentsChecked} client documents checked)`);
