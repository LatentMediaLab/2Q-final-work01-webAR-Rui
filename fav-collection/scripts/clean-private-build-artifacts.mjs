import { rm } from "node:fs/promises";

const excludedBuildArtifacts = [
  new URL("../dist/data/posts.custom.json", import.meta.url),
  new URL("../dist/assets/posts/custom/", import.meta.url),
  new URL("../dist/.DS_Store", import.meta.url),
  new URL("../dist/assets/.DS_Store", import.meta.url),
  new URL("../dist/assets/posts/.DS_Store", import.meta.url),
];

await Promise.all(
  excludedBuildArtifacts.map((artifactUrl) =>
    rm(artifactUrl, { force: true, recursive: true }),
  ),
);
