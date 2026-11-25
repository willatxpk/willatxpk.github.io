# Games site

A website for my games, hosted for free on GitHub Pages.

## Update the website after changing a game

Open PowerShell in this folder and run:

```powershell
.\publish.ps1
```

It checks every game. Any game whose files changed gets a new version number and date, its browser copy and download zip are rebuilt, and everything is uploaded. The site updates within a minute or two. Games you didn't touch are left alone.

- Just one game: `.\publish.ps1 hearthlands` (use the `id` from `games.json`)
- Build without uploading: `.\publish.ps1 -NoPush`

Never edit the files in `play/` or `downloads/` by hand. They're rebuilt from the game folders each time.

## Add a new game (e.g. Gloamreach)

Add an entry to the `games` list in `games.json`. Copy an existing entry and change `id`, `title`, `tagline`, `description`, `tags`, `icon`, `accent` and `source` (the game's folder, relative to this one). Set `"version": 0` and `"hash": null`, then run `.\publish.ps1`.

`type` decides which homepage section the card goes in: `"game"`, `"learning"` or `"app"`. Each type has its own page in the top menu (`games.html`, `learning.html`, `apps.html`). The homepage (`index.html`) picks up new projects automatically: they appear in the right section list and in "Recent updates". To add a whole new section, copy `apps.html`, change its `data-type`, and add it to the `NAV` list at the top of `shelf.js`.

To show a screenshot instead of the emoji on a game's card, put the image in this folder (for example `img/hearthlands.png`) and add `"image": "img/hearthlands.png"` to that game's entry.

Change the site's name with `siteTitle` at the top of `games.json`. The header, footer and links to GitHub/LinkedIn are set at the top of `shelf.js`.

## What never gets published

- Anything listed under a game's `excludeDirs` / `excludeFiles`
- `playtest`, `.claude`, `__pycache__` and `.git` folders
- A safety check stops the publish entirely if it finds `config.json`, databases, `data`/`backups`/`logs` folders, log files, or a file that mentions your Windows user folder.

## First-time GitHub setup

1. Make a free account at https://github.com/signup.
2. Click **+ → New repository**. Name it `<your-username>.github.io` so the site lives at `https://<your-username>.github.io`. Any other name also works; the site is then at `https://<your-username>.github.io/<name>`. Make it **Public** (free Pages needs a public repo), and don't add a README.
3. In PowerShell in this folder:
   ```powershell
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
   A browser window asks you to sign in to GitHub the first time.
4. On GitHub, open the repository's **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.

After that, `.\publish.ps1` uploads by itself.
