import * as path from "path";
import * as fs from "fs/promises";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import { CloseVectorNode } from "@langchain/community/vectorstores/closevector/node";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";

import parseGitignore from "gitignore-globs";
import { glob } from "glob";

const htmlTextSplitter = RecursiveCharacterTextSplitter.fromLanguage("html", {
  chunkSize: 175,
  chunkOverlap: 20,
});

const markdownTextSplitter = RecursiveCharacterTextSplitter.fromLanguage(
  "markdown",
  {
    chunkSize: 500,
    chunkOverlap: 0,
  }
);

const jsTextSplitter = RecursiveCharacterTextSplitter.fromLanguage("js", {
  chunkSize: 32,
  chunkOverlap: 0,
});

const defaultIgnores = ["*-lock.json"];
const textSplitters = {
  ".js": jsTextSplitter,
  ".mjs": jsTextSplitter,
  ".jsx": jsTextSplitter,
  ".ts": jsTextSplitter,
  ".tsx": jsTextSplitter,
  ".md": markdownTextSplitter,
  ".mdx": markdownTextSplitter,
  ".html": htmlTextSplitter,
};
const codeExtensions = [".js", ".mjs", ".jsx", ".ts", ".tsx"];

const directory = path.join(process.cwd(), ".embedding");
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: "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",
  modelName: "text-embedding-3-small",
});

export async function getVectorStore() {
  let vectorStore;

  try {
    console.log("Loading embedding...");
    vectorStore = await CloseVectorNode.load(directory, embeddings);
  } catch (error) {
    console.log("Creating embedding...");
    const gitignoreGlobs = parseGitignore(".gitignore");
    const files = await glob("**/*.*", {
      ignore: defaultIgnores.concat(gitignoreGlobs),
    });

    const docs = await Promise.all(
      files.flatMap(async (filepath) => {
        const extension = path.extname(filepath);
        const pageContent = (await fs.readFile(filepath)).toString();
        const splitter = textSplitters[extension];
        const type = codeExtensions.includes(extension) ? "code" : "doc";

        if (splitter) {
          return splitter.createDocuments(
            [pageContent],
            [
              {
                type,
                filepath,
              },
            ]
          );
        }

        return [new Document({ pageContent, metadata: { filepath, type } })];
      })
    );
    const flattenedDocs = docs.flat();

    vectorStore = await CloseVectorNode.fromDocuments(
      flattenedDocs,
      embeddings
    );

    await vectorStore.save(directory);
  }

  return vectorStore;
}
