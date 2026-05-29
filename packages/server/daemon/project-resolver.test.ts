import { test, expect, describe } from "bun:test";
import {
  resolveProjectCore,
  type GitProbe,
  type DeclaredRoot,
} from "./project-resolver";
import type { WorktreeDetection } from "./project-registry";

/**
 * Fake git probe driven by a fixture map. Keys are cwds.
 *  - toplevels[cwd]  → git toplevel (absent = not a git repo)
 *  - worktrees[cwd]  → WorktreeDetection (absent = { isWorktree: false })
 *  - branches[cwd]   → branch
 */
function fakeGit(fixture: {
  toplevels?: Record<string, string>;
  worktrees?: Record<string, WorktreeDetection>;
  branches?: Record<string, string>;
}): GitProbe {
  return {
    toplevel: (cwd) => fixture.toplevels?.[cwd] ?? null,
    worktree: (cwd) => fixture.worktrees?.[cwd] ?? { isWorktree: false },
    branch: (cwd) => fixture.branches?.[cwd],
  };
}

const noDeclared: DeclaredRoot[] = [];

describe("resolveProjectCore — git toplevel normalization (VC8)", () => {
  test("plain repo launched at root → project is the repo root", () => {
    const git = fakeGit({ toplevels: { "/work/a": "/work/a" } });
    const r = resolveProjectCore("/work/a", noDeclared, git);
    expect(r.projectCwd).toBe("/work/a");
    expect(r.projectName).toBe("a");
    expect(r.worktree).toBeUndefined();
  });

  test("plain repo launched in a SUBDIR → project is still the repo root, not the subdir", () => {
    const git = fakeGit({ toplevels: { "/work/a/packages/ui": "/work/a" } });
    const r = resolveProjectCore("/work/a/packages/ui", noDeclared, git);
    expect(r.projectCwd).toBe("/work/a"); // not /work/a/packages/ui
    expect(r.projectName).toBe("a");
  });

  test("trailing slash on cwd is normalized", () => {
    const git = fakeGit({ toplevels: { "/work/a": "/work/a" } });
    const r = resolveProjectCore("/work/a/", noDeclared, git);
    expect(r.projectCwd).toBe("/work/a");
  });
});

describe("resolveProjectCore — worktree rollup (VC2/VC3)", () => {
  test("session in a worktree → owns the MAIN repo, tagged with the worktree", () => {
    const git = fakeGit({
      toplevels: { "/work/a-feature": "/work/a-feature" },
      worktrees: {
        "/work/a-feature": { isWorktree: true, parentCwd: "/work/a", branch: "feat/x" },
      },
    });
    const r = resolveProjectCore("/work/a-feature", noDeclared, git);
    expect(r.projectCwd).toBe("/work/a"); // VC2 — rolls up to root
    expect(r.projectName).toBe("a");
    expect(r.worktree).toEqual({ cwd: "/work/a-feature", branch: "feat/x" }); // VC3 — tagged
  });

  test("detached-HEAD worktree → tagged with no branch", () => {
    const git = fakeGit({
      toplevels: { "/work/a-wt": "/work/a-wt" },
      worktrees: { "/work/a-wt": { isWorktree: true, parentCwd: "/work/a" } },
    });
    const r = resolveProjectCore("/work/a-wt", noDeclared, git);
    expect(r.projectCwd).toBe("/work/a");
    expect(r.worktree).toEqual({ cwd: "/work/a-wt", branch: undefined });
  });
});

describe("resolveProjectCore — non-git fallback", () => {
  test("non-git directory → the directory itself is the project", () => {
    const r = resolveProjectCore("/tmp/scratch", noDeclared, fakeGit({}));
    expect(r.projectCwd).toBe("/tmp/scratch");
    expect(r.projectName).toBe("scratch");
    expect(r.worktree).toBeUndefined();
  });
});

describe("resolveProjectCore — declared roots (workspace of repos, VC for mygroup/)", () => {
  const mygroup: DeclaredRoot[] = [{ cwd: "/work/mygroup", name: "mygroup" }];

  test("session in a sub-repo → owns the declared workspace, sub-repo as the worktree tier", () => {
    const git = fakeGit({ toplevels: { "/work/mygroup/a": "/work/mygroup/a" }, branches: { "/work/mygroup/a": "main" } });
    const r = resolveProjectCore("/work/mygroup/a", mygroup, git);
    expect(r.projectCwd).toBe("/work/mygroup"); // declared root wins over git toplevel /work/mygroup/a
    expect(r.projectName).toBe("mygroup");
    expect(r.worktree).toEqual({ cwd: "/work/mygroup/a", branch: "main" });
  });

  test("session directly in the declared (non-git) workspace → no sub-scope", () => {
    const r = resolveProjectCore("/work/mygroup", mygroup, fakeGit({}));
    expect(r.projectCwd).toBe("/work/mygroup");
    expect(r.worktree).toBeUndefined();
  });

  test("declared root supersedes the git boundary even at the sub-repo root", () => {
    const git = fakeGit({ toplevels: { "/work/mygroup/b": "/work/mygroup/b" } });
    const r = resolveProjectCore("/work/mygroup/b", mygroup, git);
    expect(r.projectCwd).toBe("/work/mygroup"); // NOT /work/mygroup/b
    expect(r.worktree?.cwd).toBe("/work/mygroup/b");
  });

  test("nearest (deepest) declared root wins", () => {
    const declared: DeclaredRoot[] = [
      { cwd: "/work", name: "work" },
      { cwd: "/work/mygroup", name: "mygroup" },
    ];
    const git = fakeGit({ toplevels: { "/work/mygroup/a/src": "/work/mygroup/a" } });
    const r = resolveProjectCore("/work/mygroup/a/src", declared, git);
    expect(r.projectCwd).toBe("/work/mygroup"); // deepest ancestor, not /work
    expect(r.worktree?.cwd).toBe("/work/mygroup/a");
  });

  test("a declared root that is NOT an ancestor is ignored → falls through to git", () => {
    const declared: DeclaredRoot[] = [{ cwd: "/other/space", name: "other" }];
    const git = fakeGit({ toplevels: { "/work/a": "/work/a" } });
    const r = resolveProjectCore("/work/a", declared, git);
    expect(r.projectCwd).toBe("/work/a"); // git toplevel, declared root irrelevant
  });

  test("declared root with no deeper repo (cwd == sub-repo but no git) → no worktree tier", () => {
    const r = resolveProjectCore("/work/mygroup/notes", mygroup, fakeGit({}));
    expect(r.projectCwd).toBe("/work/mygroup");
    expect(r.worktree).toBeUndefined();
  });
});
