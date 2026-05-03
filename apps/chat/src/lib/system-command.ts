/**
 * Pure utility functions for system command parsing and validation.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-9] [NFR-6]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-SYSTEM-COMMAND]
 */

/** Result of stripping the `!` prefix from a composer draft. */
export interface CommandParseResult {
  /** Whether the draft started with `!`. */
  isSystemCommand: boolean;
  /** The command string with `!` stripped and trimmed. */
  command: string;
}

/**
 * Detects and strips the system-command `!` prefix.
 *
 * @param draft — raw composer draft text
 * @returns `{ isSystemCommand: true, command: "..." }` when `!` prefix present,
 *          `{ isSystemCommand: false, command: "" }` otherwise
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-9]
 */
export function stripCommandPrefix(draft: string): CommandParseResult {
  const trimmed = draft.trim();
  if (trimmed.startsWith("!")) {
    return { isSystemCommand: true, command: trimmed.slice(1).trimStart() };
  }
  return { isSystemCommand: false, command: "" };
}

// ── dangerous-pattern guard ────────────────────────────────────────────────

/** Categories of dangerous commands for user-facing messages. */
export type DangerCategory =
  | "mass-deletion"
  | "disk-destruction"
  | "permission-destruction"
  | "pipe-to-shell"
  | "overwrite-system"
  | "git-destructive"
  | "docker-destructive"
  | "database-destructive"
  | "escalated-destruction"
  | "shell-meta"
  | "known-destructive";

/** Result of analyzing a command for destructive patterns. */
export interface DangerAnalysis {
  /** Whether any dangerous pattern was detected. */
  isDangerous: boolean;
  /** Human-readable category for the confirmation dialog. */
  category?: DangerCategory;
  /** Specific reason shown to the user. */
  reason?: string;
}

/** Commands that destroy files or directories. */
const DELETION_BINARIES = new Set([
  "rm",
  "unlink",
  "rmdir",
  "shred",
  "wipe",
  "srm",
  "secure-delete",
]);

/** Commands that destroy disk structures or data. */
const DISK_DESTRUCTION_BINARIES = new Set([
  "format",
  "mkfs",
  "mkswap",
  "dd",
  "fdisk",
  "parted",
  "wipefs",
  "sgdisk",
  "partprobe",
]);

/** Commands that are destructive in a database context. */
const DB_DESTRUCTION_BINARIES = new Set([
  "dropdb",
  "dropuser",
  "mysqladmin",
  "mongosh",
  "redis-cli",
]);

/** Paths that are dangerous targets for destructive operations. */
const DANGEROUS_PATH_PATTERNS = [
  /^\/$/,
  /^\/\//,
  /^\/.+/, // any absolute path
  /^~$/,
  /^~\/.+/,
  /^\.$/,
  /^\.\.$/,
  /^\.\/.*$/,
  /^\.\.\/.*$/,
  /\*/, // any glob
];

function isDangerousPath(token: string): boolean {
  return DANGEROUS_PATH_PATTERNS.some((p) => p.test(token));
}

function getBinary(command: string): string {
  return command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function matchesBinary(binary: string, knownSet: Set<string>): boolean {
  if (knownSet.has(binary)) return true;
  // Handle variants like mkfs.ext4, mkfs.xfs, mysqladmin.drop, etc.
  for (const known of knownSet) {
    if (binary.startsWith(known + ".") || binary.startsWith(known + "-")) return true;
  }
  return false;
}

function parseTokens(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

function hasFlags(tokens: string[], shortFlags: string[], longFlags: string[]): boolean {
  for (const token of tokens) {
    // Unix-style short flags (-r, -rf, --recursive)
    if ((token.startsWith("-") && !token.startsWith("--")) || token.startsWith("/")) {
      for (const flag of shortFlags) {
        if (token.toLowerCase().includes(flag.toLowerCase())) return true;
      }
    }
    // Long flags (--recursive)
    for (const flag of longFlags) {
      if (token.toLowerCase() === flag.toLowerCase()) return true;
    }
  }
  return false;
}

/**
 * Analyzes a command for destructive patterns.
 * Analyzes a command for destructive patterns.
 * Returns detailed classification for confirmation dialogs.
 *
 * @param command — command string (already stripped of `!`)
 *
 * @see docs/specs/211-app-chat-composer/spec.md [NFR-6]
 * @see docs/specs/211-app-chat-composer/design.md [DES-ERR]
 */
export function analyzeDanger(command: string): DangerAnalysis {
  const lower = command.toLowerCase().trim();
  if (lower.length === 0) return { isDangerous: false };

  // ── pipe-to-shell: curl | bash, wget | sh, etc. (check before generic shell-meta) ──
  if (/\|\s*(sh|bash|zsh|fish|csh|tcsh|ksh|dash|python|perl|ruby|node)(\s|$)/.test(lower)) {
    return {
      isDangerous: true,
      category: "pipe-to-shell",
      reason: "Piping network output directly to a shell or interpreter is a security risk",
    };
  }

  // ── shell metacharacters: compound commands hide destructive operations ──
  if (/[;|&`]/.test(lower) || /\$\(/.test(lower)) {
    return {
      isDangerous: true,
      category: "shell-meta",
      reason: "Command contains shell operators that may hide destructive operations",
    };
  }

  const tokens = parseTokens(lower);
  const binary = getBinary(lower);

  // ── sudo / doas escalation + any known destructive binary ──
  if (binary === "sudo" || binary === "doas") {
    const rest = tokens.slice(1).join(" ");
    const subBinary = getBinary(rest);
    if (
      matchesBinary(subBinary, DELETION_BINARIES) ||
      matchesBinary(subBinary, DISK_DESTRUCTION_BINARIES) ||
      matchesBinary(subBinary, DB_DESTRUCTION_BINARIES) ||
      subBinary === "chmod" ||
      subBinary === "chown"
    ) {
      return {
        isDangerous: true,
        category: "escalated-destruction",
        reason: `Elevated privilege command may cause irreversible damage`,
      };
    }
  }

  // ── overwrite redirects to system paths or dotfiles ──
  if (
    />\s*(\/etc\/|\/usr\/|\/bin\/|\/sbin\/|\/lib\/|\/var\/|\/boot\/|\/sys\/|\/proc\/|~\/\.|~\/\.bash|~\/\.zsh|~\/\.profile|~\/\.ssh)/.test(
      lower,
    )
  ) {
    return {
      isDangerous: true,
      category: "overwrite-system",
      reason: "Redirect may overwrite system files or shell configuration",
    };
  }

  // ── deletion family: rm, unlink, rmdir, shred, wipe ──
  if (matchesBinary(binary, DELETION_BINARIES)) {
    const hasRecursive = hasFlags(tokens, ["r"], ["--recursive"]);
    const hasForce = hasFlags(tokens, ["f"], ["--force"]);
    const hasInteractive = hasFlags(tokens, ["i"], ["--interactive"]);

    // rm -rf / rm -fr (or long flags)
    if (hasRecursive && hasForce) {
      return {
        isDangerous: true,
        category: "mass-deletion",
        reason: "Recursive force deletion is irreversible",
      };
    }

    // rm -r <dangerous-path> (without -i safeguard)
    if (hasRecursive && !hasInteractive) {
      const pathTokens = tokens.filter((t) => !t.startsWith("-") && t !== binary);
      for (const token of pathTokens) {
        if (isDangerousPath(token)) {
          return {
            isDangerous: true,
            category: "mass-deletion",
            reason: `Recursive deletion targeting "${token}" is dangerous`,
          };
        }
      }
    }

    // shred without flags is still destructive
    if (binary === "shred") {
      return {
        isDangerous: true,
        category: "mass-deletion",
        reason: "shred securely overwrites files making recovery impossible",
      };
    }

    // rm -f <dangerous-path> (force without recursive)
    if (hasForce && !hasRecursive) {
      const pathTokens = tokens.filter((t) => !t.startsWith("-") && t !== binary);
      for (const token of pathTokens) {
        if (isDangerousPath(token)) {
          return {
            isDangerous: true,
            category: "mass-deletion",
            reason: `Force deletion targeting "${token}" is irreversible`,
          };
        }
      }
    }
  }

  // ── disk destruction: format, mkfs, dd, fdisk, parted, wipefs ──
  if (matchesBinary(binary, DISK_DESTRUCTION_BINARIES)) {
    return {
      isDangerous: true,
      category: "disk-destruction",
      reason: `${binary} modifies disk structures or overwrites raw data`,
    };
  }

  // ── permission destruction: chmod -R / chown -R on system paths ──
  if ((binary === "chmod" || binary === "chown") && hasFlags(tokens, ["R"], ["--recursive"])) {
    const pathTokens = tokens.filter((t) => !t.startsWith("-") && t !== binary && t !== "sudo");
    for (const token of pathTokens) {
      if (isDangerousPath(token)) {
        return {
          isDangerous: true,
          category: "permission-destruction",
          reason: `Recursive ${binary} on "${token}" may lock you out of your system`,
        };
      }
    }
  }

  // ── git destructive ──
  if (binary === "git" && tokens.length > 1) {
    const sub = tokens[1];
    if (sub === "reset" && hasFlags(tokens.slice(2), ["h"], ["--hard"])) {
      return {
        isDangerous: true,
        category: "git-destructive",
        reason: "git reset --hard discards uncommitted changes permanently",
      };
    }
    if (sub === "clean" && hasFlags(tokens.slice(2), ["f", "d", "x"], ["--force"])) {
      return {
        isDangerous: true,
        category: "git-destructive",
        reason: "git clean removes untracked files permanently",
      };
    }
    if (sub === "push" && hasFlags(tokens.slice(2), ["f"], ["--force"])) {
      return {
        isDangerous: true,
        category: "git-destructive",
        reason: "Force push overwrites remote history and may affect collaborators",
      };
    }
  }

  // ── docker destructive ──
  if (binary === "docker" && tokens.length > 1) {
    const sub = tokens[1];
    if (sub === "prune" || sub === "system") {
      return {
        isDangerous: true,
        category: "docker-destructive",
        reason: `docker ${sub} removes containers, images, or volumes permanently`,
      };
    }
    if (sub === "volume" && tokens[2] === "rm") {
      return {
        isDangerous: true,
        category: "docker-destructive",
        reason: "Docker volume removal deletes persistent data",
      };
    }
    if (sub === "rmi" || (sub === "image" && tokens[2] === "rm")) {
      return {
        isDangerous: true,
        category: "docker-destructive",
        reason: "Docker image removal is irreversible",
      };
    }
  }

  // ── database destructive ──
  if (matchesBinary(binary, DB_DESTRUCTION_BINARIES)) {
    if (binary === "mysqladmin" && tokens.includes("drop")) {
      return {
        isDangerous: true,
        category: "database-destructive",
        reason: "mysqladmin drop deletes an entire database",
      };
    }
    if (binary === "mongosh" && /dropdatabase|dropdatabase\(\)/.test(lower)) {
      return {
        isDangerous: true,
        category: "database-destructive",
        reason: "dropDatabase() removes an entire MongoDB database",
      };
    }
    if (binary === "redis-cli" && /flushall|flushdb/.test(lower)) {
      return {
        isDangerous: true,
        category: "database-destructive",
        reason: "Redis FLUSHALL/FLUSHDB deletes all data permanently",
      };
    }
  }

  // ── Windows del with /f + (/s or /q) ──
  if (binary === "del") {
    const hasForce = hasFlags(tokens, ["f"], []);
    const hasSubdirs = hasFlags(tokens, ["s"], []);
    const hasQuiet = hasFlags(tokens, ["q"], []);
    if (hasForce && (hasSubdirs || hasQuiet)) {
      return {
        isDangerous: true,
        category: "mass-deletion",
        reason: "Windows del with force + recursive is irreversible",
      };
    }
  }

  // ── Windows rmdir / rd /s ──
  if ((binary === "rmdir" || binary === "rd") && hasFlags(tokens, ["s"], [])) {
    return {
      isDangerous: true,
      category: "mass-deletion",
      reason: "Windows rmdir /s removes directories and their contents permanently",
    };
  }

  return { isDangerous: false };
}

/**
 * Legacy boolean wrapper for backward compatibility.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [NFR-6]
 */
export function isDangerousCommand(command: string): boolean {
  return analyzeDanger(command).isDangerous;
}
