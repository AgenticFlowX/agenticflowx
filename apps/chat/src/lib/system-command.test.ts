/**
 * system-command — unit tests for prefix detection and dangerous-pattern guard.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-9] [NFR-6]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-SYSTEM-COMMAND] [DES-ERR]
 */
import { describe, expect, it } from "vitest";

import { analyzeDanger, isDangerousCommand, stripCommandPrefix } from "./system-command";

describe("stripCommandPrefix", () => {
  it("detects system command prefix and strips `!`", () => {
    const result = stripCommandPrefix("!ls -alth");
    expect(result.isSystemCommand).toBe(true);
    expect(result.command).toBe("ls -alth");
  });

  it("strips leading whitespace before checking `!`", () => {
    const result = stripCommandPrefix("  !echo hello  ");
    expect(result.isSystemCommand).toBe(true);
    expect(result.command).toBe("echo hello");
  });

  it("returns empty command for `!` alone", () => {
    const result = stripCommandPrefix("!");
    expect(result.isSystemCommand).toBe(true);
    expect(result.command).toBe("");
  });

  it("returns empty command for whitespace-only after `!`", () => {
    const result = stripCommandPrefix("!   ");
    expect(result.isSystemCommand).toBe(true);
    expect(result.command).toBe("");
  });

  it("returns isSystemCommand false for normal chat text", () => {
    const result = stripCommandPrefix("hello world");
    expect(result.isSystemCommand).toBe(false);
    expect(result.command).toBe("");
  });

  it("returns isSystemCommand false for empty string", () => {
    const result = stripCommandPrefix("");
    expect(result.isSystemCommand).toBe(false);
    expect(result.command).toBe("");
  });

  it("returns isSystemCommand false for text with `!` mid-string", () => {
    const result = stripCommandPrefix("hello!world");
    expect(result.isSystemCommand).toBe(false);
    expect(result.command).toBe("");
  });
});

describe("analyzeDanger", () => {
  describe("mass-deletion: rm variants", () => {
    it("catches rm -rf and flag-order variants", () => {
      expect(analyzeDanger("rm -rf /tmp").isDangerous).toBe(true);
      expect(analyzeDanger("rm -fr /tmp").isDangerous).toBe(true);
      expect(analyzeDanger("rm -r -f /tmp").isDangerous).toBe(true);
      expect(analyzeDanger("rm -f -r /tmp").isDangerous).toBe(true);
      expect(analyzeDanger("rm --recursive --force /tmp").isDangerous).toBe(true);
    });

    it("catches rm -r targeting dangerous paths", () => {
      expect(analyzeDanger("rm -r /").isDangerous).toBe(true);
      expect(analyzeDanger("rm -r ~").isDangerous).toBe(true);
      expect(analyzeDanger("rm -r ~/Documents").isDangerous).toBe(true);
      expect(analyzeDanger("rm -r /*").isDangerous).toBe(true);
      expect(analyzeDanger("rm -r .").isDangerous).toBe(true);
      expect(analyzeDanger("rm -r ..").isDangerous).toBe(true);
      expect(analyzeDanger("rm -r ./build").isDangerous).toBe(true);
      expect(analyzeDanger("rm -r ../sibling").isDangerous).toBe(true);
      expect(analyzeDanger("rm -r *.log").isDangerous).toBe(true);
    });

    it("catches rm -f targeting dangerous paths", () => {
      expect(analyzeDanger("rm -f /etc/passwd").isDangerous).toBe(true);
      expect(analyzeDanger("rm -f ~/.bashrc").isDangerous).toBe(true);
    });

    it("allows safe rm usage", () => {
      expect(analyzeDanger("rm file.txt").isDangerous).toBe(false);
      expect(analyzeDanger("rm -f file.txt").isDangerous).toBe(false);
      expect(analyzeDanger("rm -i file.txt").isDangerous).toBe(false);
    });

    it("allows rm -r with interactive flag", () => {
      expect(analyzeDanger("rm -r -i ~/temp").isDangerous).toBe(false);
    });

    it("catches shred unconditionally", () => {
      expect(analyzeDanger("shred -u file.txt").isDangerous).toBe(true);
      expect(analyzeDanger("shred file.txt").isDangerous).toBe(true);
    });
  });

  describe("disk-destruction", () => {
    it("catches format, mkfs, dd, fdisk", () => {
      expect(analyzeDanger("format C:").isDangerous).toBe(true);
      expect(analyzeDanger("mkfs.ext4 /dev/sda1").isDangerous).toBe(true);
      expect(analyzeDanger("dd if=/dev/zero of=/dev/sda").isDangerous).toBe(true);
      expect(analyzeDanger("fdisk /dev/sdb").isDangerous).toBe(true);
      expect(analyzeDanger("wipefs /dev/sda1").isDangerous).toBe(true);
    });
  });

  describe("permission-destruction", () => {
    it("catches chmod -R on system paths", () => {
      expect(analyzeDanger("chmod -R 777 /").isDangerous).toBe(true);
      expect(analyzeDanger("chmod --recursive 600 ~").isDangerous).toBe(true);
    });

    it("catches chown -R on system paths", () => {
      expect(analyzeDanger("chown -R root:root /etc").isDangerous).toBe(true);
    });

    it("allows chmod on single safe files", () => {
      expect(analyzeDanger("chmod 755 script.sh").isDangerous).toBe(false);
    });
  });

  describe("pipe-to-shell", () => {
    it("catches curl | bash and wget | sh", () => {
      expect(analyzeDanger("curl -sSL https://example.com | bash").isDangerous).toBe(true);
      expect(analyzeDanger("wget -qO- https://example.com | sh").isDangerous).toBe(true);
      expect(analyzeDanger("curl | python").isDangerous).toBe(true);
    });
  });

  describe("overwrite-system", () => {
    it("catches redirects to system files", () => {
      expect(analyzeDanger("echo foo > /etc/passwd").isDangerous).toBe(true);
      expect(analyzeDanger("cat file > ~/.bashrc").isDangerous).toBe(true);
      expect(analyzeDanger("echo bar > ~/.ssh/authorized_keys").isDangerous).toBe(true);
    });

    it("allows redirects to safe paths", () => {
      expect(analyzeDanger("echo foo > output.txt").isDangerous).toBe(false);
    });
  });

  describe("shell-metacharacters", () => {
    it("catches semicolon compound commands", () => {
      expect(analyzeDanger("ls; rm -rf /").isDangerous).toBe(true);
    });

    it("catches pipe operators", () => {
      expect(analyzeDanger("ls | grep foo").isDangerous).toBe(true);
    });

    it("catches command substitution", () => {
      expect(analyzeDanger("echo $(whoami)").isDangerous).toBe(true);
    });

    it("catches backticks", () => {
      expect(analyzeDanger("echo `date`").isDangerous).toBe(true);
    });

    it("catches && and || chains", () => {
      expect(analyzeDanger("cd foo && rm file").isDangerous).toBe(true);
      expect(analyzeDanger("cd foo || exit 1").isDangerous).toBe(true);
    });
  });

  describe("git-destructive", () => {
    it("catches git reset --hard", () => {
      expect(analyzeDanger("git reset --hard HEAD~1").isDangerous).toBe(true);
    });

    it("catches git clean -fd", () => {
      expect(analyzeDanger("git clean -fd").isDangerous).toBe(true);
      expect(analyzeDanger("git clean -fdx").isDangerous).toBe(true);
    });

    it("catches git push --force", () => {
      expect(analyzeDanger("git push --force origin main").isDangerous).toBe(true);
    });

    it("allows safe git commands", () => {
      expect(analyzeDanger("git status").isDangerous).toBe(false);
      expect(analyzeDanger("git log --oneline").isDangerous).toBe(false);
      expect(analyzeDanger("git add file.txt").isDangerous).toBe(false);
    });
  });

  describe("docker-destructive", () => {
    it("catches docker prune", () => {
      expect(analyzeDanger("docker system prune -f").isDangerous).toBe(true);
    });

    it("catches docker volume rm", () => {
      expect(analyzeDanger("docker volume rm myvol").isDangerous).toBe(true);
    });

    it("catches docker image rm", () => {
      expect(analyzeDanger("docker image rm myimage").isDangerous).toBe(true);
      expect(analyzeDanger("docker rmi myimage").isDangerous).toBe(true);
    });

    it("allows safe docker commands", () => {
      expect(analyzeDanger("docker ps").isDangerous).toBe(false);
      expect(analyzeDanger("docker build -t app .").isDangerous).toBe(false);
    });
  });

  describe("database-destructive", () => {
    it("catches mysqladmin drop", () => {
      expect(analyzeDanger("mysqladmin drop mydb").isDangerous).toBe(true);
    });

    it("catches mongo dropDatabase", () => {
      expect(analyzeDanger("mongosh --eval 'db.dropDatabase()'").isDangerous).toBe(true);
    });

    it("catches redis flush", () => {
      expect(analyzeDanger("redis-cli FLUSHALL").isDangerous).toBe(true);
      expect(analyzeDanger("redis-cli FLUSHDB").isDangerous).toBe(true);
    });
  });

  describe("escalated-destruction", () => {
    it("catches sudo + rm", () => {
      expect(analyzeDanger("sudo rm -rf /tmp").isDangerous).toBe(true);
    });

    it("catches sudo + chmod", () => {
      expect(analyzeDanger("sudo chmod -R 777 /").isDangerous).toBe(true);
    });

    it("catches sudo + dd", () => {
      expect(analyzeDanger("sudo dd if=/dev/zero of=/dev/sda").isDangerous).toBe(true);
    });

    it("allows safe sudo commands", () => {
      expect(analyzeDanger("sudo ls /root").isDangerous).toBe(false);
      expect(analyzeDanger("sudo systemctl status sshd").isDangerous).toBe(false);
    });
  });

  describe("windows-destructive", () => {
    it("catches del /f /s", () => {
      expect(analyzeDanger("del /f /s /q C:\\temp").isDangerous).toBe(true);
      expect(analyzeDanger("del /s /f C:\\temp").isDangerous).toBe(true);
    });

    it("catches rmdir /s", () => {
      expect(analyzeDanger("rmdir /s /q C:\\temp").isDangerous).toBe(true);
      expect(analyzeDanger("rd /s C:\\temp").isDangerous).toBe(true);
    });

    it("allows safe del and rmdir", () => {
      expect(analyzeDanger("del file.txt").isDangerous).toBe(false);
      expect(analyzeDanger("rmdir emptydir").isDangerous).toBe(false);
    });
  });

  describe("provides reasons", () => {
    it("returns a reason for mass-deletion", () => {
      const result = analyzeDanger("rm -rf /tmp");
      expect(result.isDangerous).toBe(true);
      expect(result.reason).toContain("Recursive force deletion");
    });

    it("returns a reason for pipe-to-shell", () => {
      const result = analyzeDanger("curl | bash");
      expect(result.isDangerous).toBe(true);
      expect(result.reason).toContain("security risk");
    });

    it("returns a reason for disk-destruction", () => {
      const result = analyzeDanger("dd if=/dev/zero of=/dev/sda");
      expect(result.isDangerous).toBe(true);
      expect(result.reason).toContain("dd");
    });
  });

  describe("empty and safe commands", () => {
    it("returns not dangerous for empty string", () => {
      expect(analyzeDanger("").isDangerous).toBe(false);
    });

    it("returns not dangerous for safe commands", () => {
      expect(analyzeDanger("ls -la").isDangerous).toBe(false);
      expect(analyzeDanger("mkdir newdir").isDangerous).toBe(false);
      expect(analyzeDanger("cp file.txt backup.txt").isDangerous).toBe(false);
      expect(analyzeDanger("cat README.md").isDangerous).toBe(false);
      expect(analyzeDanger("echo hello").isDangerous).toBe(false);
      expect(analyzeDanger("touch file.txt").isDangerous).toBe(false);
    });
  });
});

describe("isDangerousCommand (legacy boolean wrapper)", () => {
  it("delegates to analyzeDanger", () => {
    expect(isDangerousCommand("rm -rf /")).toBe(true);
    expect(isDangerousCommand("ls -la")).toBe(false);
  });
});
