# SJB Fact Find — zero-cost setup guide

Everything below is free. Budget about 45 minutes, mostly waiting for things to create themselves.
You will need: a Windows PC, a credit or debit card (for identity verification only — see Part A), and the `sjb-factfind-server.zip` file.

**The plan:** a free server from Oracle, a free web address, then one command that installs everything.

---

## Part A — A free server (Oracle Cloud, ~15 min)

Oracle gives away small servers permanently under its "Always Free" tier. It asks for a card to prove you are a real person; **Always Free resources never bill** so long as you do *not* upgrade the account.

1. Go to **cloud.oracle.com/free** → **Start for free**.
2. Country **United Kingdom**, your name and SJB email. Verify the email.
3. **Home region: UK South (London)** — this decides where the data lives. It cannot be changed later.
4. Card verification — a temporary hold of about £1 that is reversed. Do **not** tick anything offering to upgrade to "Pay As You Go".
5. Wait for the "your account is ready" email (usually minutes, occasionally a few hours).

### Create the server

6. Sign in → menu (☰) → **Compute → Instances → Create instance**.
7. Name: `sjb-factfind`.
8. **Image and shape → Edit**: Image **Canonical Ubuntu 22.04** (or 24.04). Shape: choose one marked **Always Free-eligible** — `VM.Standard.E2.1.Micro` is always available; `VM.Standard.A1.Flex` (1 OCPU, 6 GB) is better if it lets you.
9. **Networking**: leave "Create new virtual cloud network" and "Assign a public IPv4 address" ticked.
10. **Add SSH keys → Generate a key pair for me → Save private key**. It downloads a file like `ssh-key-2026-08-21.key`. **Keep it safe — it is the only way into the server.** Move it to `C:\Users\DionAngove\sjb-server.key`.
11. **Create**. In a minute the status turns **Running**. Copy the **Public IP address** (e.g. `141.147.x.x`) — you will use it repeatedly.

### Let the world reach it (Oracle blocks web traffic by default)

12. On the instance page click the **subnet** link → **Security Lists → Default Security List → Add Ingress Rules**.
13. Add two rules, both: Source CIDR `0.0.0.0/0`, IP Protocol **TCP**, Destination port **80**; then again with port **443**. Save.

---

## Part B — A free web address (~5 min)

**Option 1 — your own domain (best):** ask whoever manages the sjb-global.com website to add a DNS **A record**: name `factfind`, value = the Public IP from step 11. Takes them two minutes; allow up to an hour to spread.

**Option 2 — instant and free, no IT needed:** go to **duckdns.org**, sign in with a Google or GitHub account, type a subdomain such as `sjbfactfind`, put the Public IP in the box, **add domain**. Your address is `sjbfactfind.duckdns.org`. Works immediately. (Looks less polished than sjb-global.com; you can switch to Option 1 later by re-running the install command with the new name.)

---

## Part C — Install (~15 min)

Everything here happens in **PowerShell** on your PC (Start → type *PowerShell*). Replace `IP` with the Public IP, `KEY` with your key file path, and `DOMAIN` with the address from Part B.

1. Unzip `sjb-factfind-server.zip` to your Desktop so you have a folder `Desktop\sjb-factfind-server`.

2. Windows insists the key file is private to you — fix its permissions once:
   ```powershell
   icacls "C:\Users\DionAngove\sjb-server.key" /inheritance:r /grant:r "$env:USERNAME:R"
   ```

3. Copy the software to the server:
   ```powershell
   scp -i "C:\Users\DionAngove\sjb-server.key" -r "$env:USERPROFILE\Desktop\sjb-factfind-server" ubuntu@IP:~/
   ```
   First time it asks "Are you sure you want to continue connecting?" — type `yes`.

4. Connect to the server:
   ```powershell
   ssh -i "C:\Users\DionAngove\sjb-server.key" ubuntu@IP
   ```
   The prompt changes to `ubuntu@sjb-factfind:~$` — you are now typing on the server.

5. Run the installer (one line; choose a strong password — it is your portal login):
   ```bash
   sudo bash ~/sjb-factfind-server/install.sh DOMAIN dion.angove@sjb-global.com 'Your-Strong-Password-Here'
   ```
   It installs Node and Caddy, starts the service, gets an HTTPS certificate for your address, creates your login and sets up nightly backups. Three to five minutes. It ends with `Done. Open https://DOMAIN`.

6. Type `exit` to leave the server.

---

## Part D — First use (~5 min)

1. Open **https://DOMAIN** in your browser. Sign in with your email and the password from step C5.
2. **Settings**: your name, phone, the admin work-request inbox. These go into every email and every MADS.
3. **Clients → Send to a new client**: name and email → the client record is created, their personal link is made, and a draft opens in Outlook with it. Press send.
4. When they finish, a green **"Fact Find returned"** banner appears on the Clients screen and the record is already filled in. Press **Open**.
5. **Create the MADS** and every other button works exactly as on the desktop file — and downloads work, because this is your own site.

---

## Keeping it healthy

- **Backups** are taken every night on the server (`/var/backups/sjb-factfind/`, 30 days kept). Once a month, copy one to SharePoint:
  ```powershell
  scp -i "C:\Users\DionAngove\sjb-server.key" ubuntu@IP:/var/backups/sjb-factfind/data-*.tar.gz "$env:USERPROFILE\Desktop\"
  ```
  Or simply use **Export → Download a full backup** in the portal whenever you like.
- **Add a colleague:** connect with `ssh` as in C4, then
  `sudo -u sjbff env DATA_DIR=/var/lib/sjb-factfind node /opt/sjb-factfind/server.js adduser their@sjb-global.com 'their-password'`
- **Update the software later:** repeat C3 and C5 with the new zip. Records are kept separately and are never touched by an update.
- **Something wrong?** `ssh` in and run `journalctl -u sjb-factfind -n 50` — send me what it says.
- **Oracle idle rule:** Oracle may reclaim an Always Free server that sits almost completely idle for a week. Normal use keeps it active; the nightly backup helps too. If you ever get an "idle instance" email from Oracle, just sign in to the portal — that is enough activity. Keep a backup copy off the server regardless.

## Optional: email notifications

Returned Fact Finds always appear in the portal. If you also want an email, edit the config on the server:
```bash
sudo nano /etc/sjb-factfind.env       # fill in the SMTP_ lines, Ctrl+O, Enter, Ctrl+X
cd /opt/sjb-factfind && sudo npm install nodemailer && sudo systemctl restart sjb-factfind
```
For your M365 mailbox the host is `smtp.office365.com`, port `587`. Your M365 admin may need to enable **SMTP AUTH** for the mailbox.

## What this costs

| | |
|---|---|
| Oracle Always Free server | £0 |
| DuckDNS address, or a subdomain of sjb-global.com | £0 |
| HTTPS certificate (Let's Encrypt via Caddy) | £0 |
| The software | £0 — no licences, no subscriptions |
