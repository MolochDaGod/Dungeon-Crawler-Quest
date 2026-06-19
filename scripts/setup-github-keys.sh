#!/usr/bin/env bash
#
# setup-github-keys.sh
# ---------------------------------------------------------------------------
# Generate and register modern SSH + GPG keys for GitHub, and configure git
# commit/tag signing. Designed to be run ON YOUR OWN MACHINE (never in a shared
# or ephemeral CI/sandbox environment).
#
# What it does (idempotently):
#   1. Generates an ed25519 SSH *authentication* key   (~/.ssh/id_ed25519_github)
#   2. Generates an ed25519 SSH *signing* key          (~/.ssh/id_ed25519_github_sign)
#   3. (default) Configures git to sign commits/tags with the SSH signing key,
#      OR (--gpg) generates an ed25519 GPG key and signs with that instead.
#   4. Adds a `github.com` block to ~/.ssh/config and an allowed_signers entry.
#   5. Uploads the *public* keys to GitHub via `gh` when the CLI has the right
#      scopes; otherwise prints exact manual steps and the public keys.
#
# SECURITY:
#   * This script NEVER prints, copies, or transmits private key material.
#   * Only PUBLIC keys are ever displayed or uploaded.
#   * Run it locally. Do not run it in CI, containers you don't control, or any
#     shared sandbox — private keys generated there can leak and don't persist.
#
# Usage:
#   scripts/setup-github-keys.sh [options]
#
# Options:
#   --email <email>     Email/comment baked into the keys (default: git user.email)
#   --name  <name>      Real name for the GPG uid       (default: git user.name)
#   --gpg               Use a GPG key for git signing instead of SSH signing
#   --no-upload         Skip GitHub upload; just generate + configure locally
#   --no-sign-config    Generate/upload keys but do NOT change git signing config
#   --passphrase <str>  Passphrase for new keys (default: prompt interactively;
#                       pass an empty string '' for no passphrase — not advised)
#   -h, --help          Show this help
#
# Exit codes: 0 success, non-zero on hard failure (missing tools, bad input).
# ---------------------------------------------------------------------------
set -euo pipefail

# ----- pretty output -------------------------------------------------------
if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GRN=$'\033[32m'
  YLW=$'\033[33m'; BLU=$'\033[34m'; RST=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GRN=""; YLW=""; BLU=""; RST=""
fi
log()  { printf '%s\n' "${BLU}==>${RST} ${BOLD}$*${RST}"; }
ok()   { printf '%s\n' "${GRN}  ✓${RST} $*"; }
warn() { printf '%s\n' "${YLW}  ! $*${RST}"; }
err()  { printf '%s\n' "${RED}  ✗ $*${RST}" >&2; }
die()  { err "$*"; exit 1; }

# ----- defaults ------------------------------------------------------------
SSH_DIR="${HOME}/.ssh"
GIT_CONF_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/git"
AUTH_KEY="${SSH_DIR}/id_ed25519_github"
SIGN_KEY="${SSH_DIR}/id_ed25519_github_sign"
ALLOWED_SIGNERS="${GIT_CONF_DIR}/allowed_signers"
HOSTNAME_SHORT="$(hostname 2>/dev/null | cut -d. -f1 || echo host)"

USE_GPG=0
DO_UPLOAD=1
DO_SIGN_CONFIG=1
EMAIL=""
FULLNAME=""
PASSPHRASE="__PROMPT__"

usage() { sed -n '2,55p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

# ----- arg parsing ---------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --email)          EMAIL="${2:-}"; shift 2 ;;
    --name)           FULLNAME="${2:-}"; shift 2 ;;
    --gpg)            USE_GPG=1; shift ;;
    --no-upload)      DO_UPLOAD=0; shift ;;
    --no-sign-config) DO_SIGN_CONFIG=0; shift ;;
    --passphrase)     PASSPHRASE="${2:-}"; shift 2 ;;
    -h|--help)        usage ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
done

# ----- prerequisites -------------------------------------------------------
command -v git           >/dev/null 2>&1 || die "git is required but not installed."
command -v ssh-keygen    >/dev/null 2>&1 || die "ssh-keygen (OpenSSH) is required but not installed."

EMAIL="${EMAIL:-$(git config --global user.email 2>/dev/null || true)}"
FULLNAME="${FULLNAME:-$(git config --global user.name 2>/dev/null || true)}"
[ -n "$EMAIL" ]    || die "No email. Set one with: git config --global user.email you@example.com  (or pass --email)."
[ -n "$FULLNAME" ] || FULLNAME="$EMAIL"

# OpenSSH >= 8.0 is required for ssh-based git signing.
SSH_VER="$(ssh -V 2>&1 | sed -n 's/^OpenSSH_\([0-9]*\.[0-9]*\).*/\1/p')"
if [ "$USE_GPG" -eq 0 ]; then
  awk -v v="${SSH_VER:-0}" 'BEGIN{ if (v+0 < 8.0) exit 1 }' \
    || warn "OpenSSH ${SSH_VER:-?} detected; SSH commit signing needs >= 8.0. Use --gpg if signing fails."
fi

umask 077
mkdir -p "$SSH_DIR" "$GIT_CONF_DIR"
chmod 700 "$SSH_DIR"

KEY_COMMENT="${EMAIL} (github@${HOSTNAME_SHORT} $(date +%Y-%m-%d))"

# ----- passphrase handling -------------------------------------------------
# We resolve a single passphrase once and reuse it for both SSH keys so the
# user is not prompted repeatedly. It is held only in a shell variable.
resolve_passphrase() {
  if [ "$PASSPHRASE" = "__PROMPT__" ]; then
    if [ -t 0 ]; then
      printf '%s' "${BOLD}Enter a passphrase for the new SSH keys (leave empty for none): ${RST}"
      read -rs PASSPHRASE; printf '\n'
    else
      warn "Non-interactive shell and no --passphrase given; creating keys WITHOUT a passphrase."
      PASSPHRASE=""
    fi
  fi
}

# ----- SSH key generation (idempotent) -------------------------------------
gen_ssh_key() {
  local path="$1" comment="$2"
  if [ -f "$path" ]; then
    ok "SSH key already exists: ${path} (reusing, not overwriting)"
    return 0
  fi
  log "Generating ed25519 SSH key: ${path}"
  ssh-keygen -t ed25519 -a 100 -C "$comment" -f "$path" -N "$PASSPHRASE" >/dev/null
  chmod 600 "$path"; chmod 644 "${path}.pub"
  ok "Created ${path} and ${path}.pub"
}

# ----- SSH agent (best effort) ---------------------------------------------
add_to_agent() {
  local path="$1"
  if [ -z "${SSH_AUTH_SOCK:-}" ]; then
    eval "$(ssh-agent -s)" >/dev/null 2>&1 || true
  fi
  if [ -n "${SSH_AUTH_SOCK:-}" ]; then
    # macOS keychain integration when available; harmless elsewhere.
    if ssh-add --apple-use-keychain "$path" >/dev/null 2>&1; then :; else
      ssh-add "$path" >/dev/null 2>&1 || warn "Could not add ${path} to ssh-agent (you may be prompted later)."
    fi
  fi
}

# ----- ~/.ssh/config (idempotent) ------------------------------------------
configure_ssh_config() {
  local cfg="${SSH_DIR}/config"
  touch "$cfg"; chmod 600 "$cfg"
  if grep -qE '^[[:space:]]*Host[[:space:]]+github\.com([[:space:]]|$)' "$cfg"; then
    ok "~/.ssh/config already has a github.com Host block (left unchanged)."
    return 0
  fi
  log "Adding github.com block to ~/.ssh/config"
  {
    echo ""
    echo "# Added by setup-github-keys.sh on $(date +%Y-%m-%d)"
    echo "Host github.com"
    echo "    HostName github.com"
    echo "    User git"
    echo "    IdentityFile ${AUTH_KEY}"
    echo "    IdentitiesOnly yes"
    echo "    AddKeysToAgent yes"
  } >> "$cfg"
  ok "Updated ~/.ssh/config"
}

# ----- GPG key generation (idempotent) -------------------------------------
GPG_KEYID=""
gen_gpg_key() {
  command -v gpg >/dev/null 2>&1 || die "--gpg requested but gpg is not installed (install GnuPG first)."
  # Reuse an existing non-expired secret signing key for this email if present.
  local existing
  existing="$(gpg --list-secret-keys --keyid-format=long --with-colons "$EMAIL" 2>/dev/null \
              | awk -F: '/^sec:/ && $2 !~ /[er]/ {print $5; exit}')" || true
  if [ -n "$existing" ]; then
    GPG_KEYID="$existing"
    ok "Reusing existing GPG signing key: ${GPG_KEYID}"
    return 0
  fi
  log "Generating ed25519 GPG signing key for ${FULLNAME} <${EMAIL}>"
  # --quick-generate-key avoids the interactive menu; passphrase via loopback.
  local args=(--batch --quick-generate-key "${FULLNAME} <${EMAIL}>" ed25519 sign 2y)
  if [ -n "$PASSPHRASE" ]; then
    gpg --pinentry-mode loopback --passphrase "$PASSPHRASE" "${args[@]}"
  else
    gpg --pinentry-mode loopback --passphrase "" "${args[@]}"
  fi
  GPG_KEYID="$(gpg --list-secret-keys --keyid-format=long --with-colons "$EMAIL" \
               | awk -F: '/^sec:/ {print $5; exit}')"
  [ -n "$GPG_KEYID" ] || die "GPG key generation appeared to succeed but no key id was found."
  ok "Created GPG key ${GPG_KEYID}"
}

# ----- git signing configuration -------------------------------------------
configure_git_signing_ssh() {
  log "Configuring git to sign with the SSH signing key"
  git config --global gpg.format ssh
  git config --global user.signingkey "${SIGN_KEY}.pub"
  git config --global commit.gpgsign true
  git config --global tag.gpgsign true
  git config --global gpg.ssh.allowedSignersFile "${ALLOWED_SIGNERS}"
  touch "$ALLOWED_SIGNERS"
  local pub; pub="$(cat "${SIGN_KEY}.pub")"
  if ! grep -qF "$pub" "$ALLOWED_SIGNERS" 2>/dev/null; then
    printf '%s %s\n' "$EMAIL" "$pub" >> "$ALLOWED_SIGNERS"
    ok "Added signing key to ${ALLOWED_SIGNERS}"
  else
    ok "Signing key already present in allowed_signers"
  fi
  ok "git will now sign commits/tags with your SSH signing key."
}

configure_git_signing_gpg() {
  log "Configuring git to sign with the GPG key"
  git config --global gpg.format openpgp
  git config --global user.signingkey "$GPG_KEYID"
  git config --global commit.gpgsign true
  git config --global tag.gpgsign true
  # Helps gpg find the right tty for the pinentry prompt in most shells.
  if ! grep -qs 'GPG_TTY' "${HOME}/.bashrc" "${HOME}/.zshrc" 2>/dev/null; then
    warn "Tip: add 'export GPG_TTY=\$(tty)' to your shell rc so signing prompts work."
  fi
  ok "git will now sign commits/tags with GPG key ${GPG_KEYID}."
}

# ----- GitHub upload (public keys only) ------------------------------------
gh_can_manage_keys() {
  command -v gh >/dev/null 2>&1 || return 1
  gh auth status >/dev/null 2>&1 || return 1
  # Probe the keys endpoint; 403 (integration/insufficient scope) => cannot manage.
  gh api user/keys >/dev/null 2>&1
}

upload_ssh_key() {
  local pub="$1" type="$2" title="$3"  # type: authentication | signing
  if gh ssh-key add "$pub" --type "$type" --title "$title" >/dev/null 2>&1; then
    ok "Uploaded ${type} SSH key to GitHub (\"${title}\")."
  else
    warn "Could not upload ${type} SSH key automatically."
    MANUAL=1
  fi
}

upload_gpg_key() {
  local keyid="$1"
  if gpg --armor --export "$keyid" | gh gpg-key add - >/dev/null 2>&1; then
    ok "Uploaded GPG public key ${keyid} to GitHub."
  else
    warn "Could not upload GPG key automatically."
    MANUAL=1
  fi
}

print_manual_instructions() {
  cat <<EOF

${BOLD}Manual upload (public keys are safe to share):${RST}
  GitHub UI:        https://github.com/settings/keys
  Or grant scopes:  ${DIM}gh auth refresh -h github.com -s admin:public_key,admin:gpg_key,write:ssh_signing_key${RST}
                    ${DIM}(or 'gh auth login' with a classic PAT that has those scopes)${RST}

${BOLD}Authentication SSH public key${RST} (add as type "Authentication"):
$(cat "${AUTH_KEY}.pub")

${BOLD}Signing SSH public key${RST} (add as type "Signing"):
$(cat "${SIGN_KEY}.pub")
EOF
  if [ "$USE_GPG" -eq 1 ] && [ -n "$GPG_KEYID" ]; then
    cat <<EOF

${BOLD}GPG public key${RST} (paste at https://github.com/settings/gpg/new):
$(gpg --armor --export "$GPG_KEYID")
EOF
  fi
}

# ===========================================================================
# Main
# ===========================================================================
log "GitHub key + signing setup for ${BOLD}${FULLNAME} <${EMAIL}>${RST}"
warn "Run this on your OWN machine. Private keys are never displayed or uploaded."

resolve_passphrase

# 1. SSH keys (always — used for git auth and, by default, signing)
gen_ssh_key "$AUTH_KEY" "auth ${KEY_COMMENT}"
gen_ssh_key "$SIGN_KEY" "sign ${KEY_COMMENT}"
add_to_agent "$AUTH_KEY"
configure_ssh_config

# 2. Signing method
if [ "$USE_GPG" -eq 1 ]; then
  gen_gpg_key
fi

if [ "$DO_SIGN_CONFIG" -eq 1 ]; then
  if [ "$USE_GPG" -eq 1 ]; then configure_git_signing_gpg; else configure_git_signing_ssh; fi
else
  warn "Skipping git signing configuration (--no-sign-config)."
fi

# 3. Upload public keys
MANUAL=0
if [ "$DO_UPLOAD" -eq 1 ]; then
  if gh_can_manage_keys; then
    log "Uploading PUBLIC keys to GitHub via gh"
    upload_ssh_key "${AUTH_KEY}.pub" authentication "auth-${HOSTNAME_SHORT}-$(date +%Y%m%d)"
    upload_ssh_key "${SIGN_KEY}.pub" signing        "sign-${HOSTNAME_SHORT}-$(date +%Y%m%d)"
    [ "$USE_GPG" -eq 1 ] && upload_gpg_key "$GPG_KEYID"
  else
    warn "gh cannot manage account keys here (missing/!installed, not logged in, or insufficient token scope)."
    MANUAL=1
  fi
else
  warn "Skipping GitHub upload (--no-upload)."
  MANUAL=1
fi

[ "$MANUAL" -eq 1 ] && print_manual_instructions

# 4. Verify
cat <<EOF

${GRN}${BOLD}Done.${RST}
Next steps:
  • Test SSH auth:      ${DIM}ssh -T git@github.com${RST}  (a greeting + exit 1 means success)
  • Use SSH remotes:    ${DIM}git remote set-url origin git@github.com:OWNER/REPO.git${RST}
  • Verify signing:     ${DIM}git commit --allow-empty -m "test" && git log --show-signature -1${RST}
  • On github.com your verified commits show a green "Verified" badge.
EOF
