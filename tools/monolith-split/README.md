# monolith-split (reference tool)

One-off scripts used to split the original single-file `index.html` (one ~6,300-line `<script type="module">`)
into the modules under `src/`. Kept so the same split can be re-run on the **other project's** old `index.html`
if merging the branch is not practical (see `docs/PORTING.md`, "How to port").

- `table.cjs` – lists every top-level statement with its line range (use it to pick module boundaries).
- `split.cjs` – Babel-based splitter: assigns each top-level statement to a module by line number (`MAP` at the
  top), turns shared mutable `let`s into a `state` object, and generates the `import`/`export` lines and `main.ts`.

Limits: `MAP` is keyed on line numbers of the ORIGINAL file (commit `5ba9691`). A clone that diverged
will have shifted lines, so re-derive `MAP` with `table.cjs` first. Needs `@babel/parser` and `@babel/traverse`
(`npm i --no-save @babel/parser @babel/traverse`). Input path is `work/module.js` (the script body, without
the `<script>` tags); output goes to `out/`.
