# GitHub Keys & Commit Signing

Set up modern **SSH** (authentication + signing) and **GPG** keys for your GitHub
account, enable verified commit/tag signing, and wire keys for AI/CI integrations
and automated deployments.

Everything here is driven by [`scripts/setup-github-keys.sh`](../scripts/setup-github-keys.sh).

> **Security first**
> Private keys must be generated **on your own machine**. Never generate them in a
> shared CI runner, a container you don't control, or an ephemeral agent sandbox —
> the private key can leak and won't persist. The script **never** prints, copies,
> or uploads private key material; only **public** keys are ever shown or uploaded.

## Prerequisites
- **OpenSSH >= 8.0** (`ssh -V`) — required for SSH-based commit signing.
- **git >= 2.34** (`git --version`) — required for `gpg.format=ssh` signing.
- **GitHub CLI** (`gh`) — optional but recommended for automatic upload.
- **GnuPG** (`gpg`) — only needed if you choose `--gpg` signing.

### Give `gh` permission to manage keys
The default `gh` login (and any GitHub App / integration token) usually **cannot**
manage account keys — you'll see `HTTP 403: Resource not accessible by integration`.
Grant the key-management scopes once:
```bash
gh auth refresh -h github.com -s admin:public_key,admin:gpg_key,write:ssh_signing_key
```
Or log in with a **classic Personal Access Token** that has `admin:public_key`,
`admin:gpg_key`, and `write:ssh_signing_key`. If you skip this, the script still
generates and configures everything locally and prints the exact public keys plus
manual upload links.

## Quick start
```bash
# SSH auth key + SSH signing key, git configured to sign with SSH, public keys
# uploaded to GitHub if gh has the scopes above:
scripts/setup-github-keys.sh

# Prefer GPG signing instead of SSH signing:
scripts/setup-github-keys.sh --gpg

# Generate + configure locally but don't upload (print public keys instead):
scripts/setup-github-keys.sh --no-upload
```
Useful flags: `--email <addr>`, `--name <name>`, `--passphrase <str>` (use `''` for
no passphrase — not recommended), `--no-sign-config`. See `--help` for the full list.

## What it creates
| Artifact | Path | Purpose |
| --- | --- | --- |
| SSH authentication key | `~/.ssh/id_ed25519_github` | `git@github.com` over SSH |
| SSH signing key | `~/.ssh/id_ed25519_github_sign` | Signing commits/tags |
| GPG signing key (`--gpg`) | local keyring | Signing commits/tags |
| SSH client config | `~/.ssh/config` (github.com block) | Uses the auth key for GitHub |
| Allowed signers | `~/.config/git/allowed_signers` | Lets `git log --show-signature` verify SSH signatures |

It also sets these git globals (SSH mode): `gpg.format=ssh`,
`user.signingkey=~/.ssh/id_ed25519_github_sign.pub`, `commit.gpgsign=true`,
`tag.gpgsign=true`, `gpg.ssh.allowedSignersFile=~/.config/git/allowed_signers`.

## SSH signing vs GPG signing
- **SSH signing (default)** — simplest: one key type, no keyring/passphrase agent
  to manage, supported by GitHub's "Verified" badge. Recommended for most users.
- **GPG signing (`--gpg`)** — choose this if you already publish a GPG identity or
  need GPG for other tooling. Add `export GPG_TTY=$(tty)` to your shell rc so the
  passphrase prompt works.

## Verify it worked
```bash
ssh -T git@github.com        # greeting + exit code 1 == success
git commit --allow-empty -m "signing test"
git log --show-signature -1  # should say "Good signature"
git push                     # commits show a green "Verified" badge on GitHub
```
Switch a repo to SSH remotes when you want SSH auth:
```bash
git remote set-url origin git@github.com:OWNER/REPO.git
```

## Keys for AI / CI "connections" and deployments
For **automation** (AI agents, CI/CD, bots) prefer scoped credentials over your
personal keys:

- **Deploy keys (per-repo SSH).** Generate a dedicated key and add its public half
  under *Repo → Settings → Deploy keys* (enable write only if the automation pushes).
  This is the least-privilege way to give one repo's pipeline git access.
  ```bash
  ssh-keygen -t ed25519 -C "deploy:OWNER/REPO" -f ~/.ssh/deploy_owner_repo -N ''
  gh repo deploy-key add ~/.ssh/deploy_owner_repo.pub --title "ci-deploy" --allow-write
  ```
- **Server / VPS deploys.** This org's `grudge-backend` deploy workflow already
  authenticates to a VPS using a `VPS_SSH_KEY` Actions secret (see
  `grudge-backend/.github/workflows/deploy.yml`). Generate a dedicated deploy
  keypair, put the **private** half in the relevant repo's Actions secret, and add
  the **public** half to the server's `~/.ssh/authorized_keys`.
- **API access for AI services.** Use **fine-grained PATs** (scoped to specific
  repos and permissions) or a GitHub App rather than account-wide classic tokens.
- **Verified automation commits.** Give CI its own SSH **signing** key and register
  it as a *Signing* key so bot commits also show as Verified.

> Store every private key as a secret (Actions secret, secret manager, or
> Warp/Cloudflare secret) — never commit private keys to the repo.

## Troubleshooting
- `Resource not accessible by integration` → run the `gh auth refresh … -s …`
  command above, or upload public keys manually at <https://github.com/settings/keys>.
- `ssh -T` shows `Permission denied (publickey)` → ensure the auth public key is
  added to GitHub and `~/.ssh/config` points `IdentityFile` at the private key.
- Commits show **Unverified** → the matching public key isn't registered as a
  *Signing* key, or your committer email doesn't match a verified account email.
- GPG `Inappropriate ioctl for device` → add `export GPG_TTY=$(tty)` to your shell rc.
