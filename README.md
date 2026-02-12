# Risk Calculator

A small MkDocs site with interactive calculators for cybersecurity economic decisions. It uses client-side JS for calculations and PDF export, and deploys to GitHub Pages via GitHub Actions for free on public repos.

Quick start (macOS / zsh)

1. Create and activate a venv

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

2. Preview locally

```bash
mkdocs serve
```

3. Build

```bash
mkdocs build
```

4. Deploy with GitHub Actions (automatic)

- Create a new repository on GitHub and push this project to the `main` branch.
- The workflow `.github/workflows/deploy.yml` will run on pushes to `main`, build the site, and publish the `site/` directory to the `gh-pages` branch using `GITHUB_TOKEN`.
- GitHub Pages is free for public repositories and will host the site at `https://<your-org-or-user>.github.io/<repo>/`.

Manual deployment (alternative)

```bash
mkdocs build
cd site
git init
git remote add origin git@github.com:<your-org-or-user>/<repo>.git
git checkout -b gh-pages
git add -A
git commit -m "Publish site"
git push -u origin gh-pages --force
```

Notes
- The site performs client-side calculations and generates PDFs in the browser; no server is required. This makes GitHub Pages a perfect free host.
- If you want the repository set up and pushed, provide access or push the changes yourself. I can provide a clean sequence of commands to create the repo and push the current code.
# Risk-Calculator
