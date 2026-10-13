# SJB Fact Find — running it on your own server

This folder is the whole system: the adviser portal, the client form, and the
server that sits between them. No cloud services, no databases to install, no
third parties. Records are plain JSON files on the server's disk.

## What you need

| | |
|---|---|
| A server | Any Linux VPS with 1 GB RAM. Ubuntu 22.04 or 24.04. Hetzner (~€5/mo), DigitalOcean (~$6/mo), or a UK host such as Fasthosts. You create the account; you hold the root password. |
| A domain name | A subdomain you control, e.g. `factfind.sjb-global.com`. Add an **A record** pointing at the server's IP. Whoever manages the sjb-global.com website DNS can do this in two minutes. |
| 15 minutes | The installer does the rest. |

## Install (once)

On your computer, copy the folder to the server:

```bash
scp -r sjb-factfind-server root@YOUR.SERVER.IP:/opt/
```

On the server:

```bash
ssh root@YOUR.SERVER.IP
cd /opt/sjb-factfind-server
sudo bash install.sh factfind.sjb-global.com dion.angove@sjb-global.com 'choose-a-strong-password'
```

That installs Node and Caddy, starts the app as a locked-down service, obtains
an HTTPS certificate for the domain, creates your login, and schedules nightly
backups. Then open `https://factfind.sjb-global.com` and sign in.

## Day to day

- **Add a colleague:** `sudo -u sjbff env DATA_DIR=/var/lib/sjb-factfind node /opt/sjb-factfind/server.js adduser their@sjb-global.com 'password'`
- **Logs:** `journalctl -u sjb-factfind -f`
- **Restart:** `systemctl restart sjb-factfind`
- **Backups:** nightly in `/var/backups/sjb-factfind/` (30 days kept). Copy those off the server periodically — to SharePoint is fine. Export → backup in the portal downloads the same thing on demand.
- **Update the software:** copy the new folder over `/opt/sjb-factfind` and `systemctl restart sjb-factfind`. Data is elsewhere, so updates never touch it.

## Email notifications (optional)

Returned Fact Finds always appear in the portal. To *also* get an email, fill in
the `SMTP_*` lines in `/etc/sjb-factfind.env`, run `cd /opt/sjb-factfind && npm install nodemailer`,
and `systemctl restart sjb-factfind`. For a Microsoft 365 mailbox use
`smtp.office365.com`, port 587, your address and password — note that your
M365 admin may need to enable "SMTP AUTH" for that mailbox (it is often off by default).

## How the pieces fit

```
client's browser ──► https://factfind.sjb-global.com/f/<token>  (form.html)
                          │  POST /api/form/<token>/submit
                          ▼
                     server.js + app.js  ──► /var/lib/sjb-factfind/*.json
                          ▲
adviser's browser ──► https://factfind.sjb-global.com/  (app.html, sign-in required)
```

- Links are random 24-byte tokens, valid 45 days, one live link per client.
- Adviser sessions are signed cookies (14 days), passwords hashed with PBKDF2.
- The app runs as an unprivileged user that can write only to the data folder.
- Everything is served over HTTPS; HTTP is redirected.

## Security notes for compliance

- Data location: the server you chose — pick a UK or EU region.
- Encryption in transit: TLS via Caddy. At rest: enable disk encryption at your host, or
  use a host that encrypts volumes by default (most do).
- Access: named adviser logins; remove leavers with `node server.js users` / edit the user file.
- Retention: delete a client in the portal and the file is removed; backups age out after 30 days.
- No analytics, no external scripts, no calls to any other service.
