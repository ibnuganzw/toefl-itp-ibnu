# Deployment and Update Flow

This app should be deployed from the source repository, not by manually uploading `dist/` as the long-term workflow.

## Recommended Flow

1. Keep the app source and validated bank files in GitHub.
2. Import the GitHub repository into Vercel or Netlify.
3. Use `npm run build` as the build command.
4. Use `dist` as the production output directory.
5. Use the free platform domain first, such as `toefl-itp-ibnu.vercel.app`.
6. Add a custom `.com`, `.xyz`, or `.app` domain later from the deployment platform dashboard.

## Future Bank Updates

Every future question-bank update should follow this sequence:

1. Add or import the reviewed bank data.
2. Keep malformed or uncertain items inactive until reviewed.
3. Run `npm run validate:bank`.
4. Run `npm run build`.
5. Commit and push to GitHub.
6. Let Vercel or Netlify redeploy automatically from the latest GitHub commit.

The GitHub Actions workflow in `.github/workflows/ci.yml` repeats the integrity checks and production build on every push and pull request to `main`.

## Local Git Setup

This workspace currently needs Git available in PATH before it can be pushed directly from the local machine.

```bash
git init -b main
git add .
git commit -m "Initial TOEFL ITP practice app"
git remote add origin https://github.com/<owner>/toefl-itp-ibnu.git
git push -u origin main
```

After the repository is connected to Vercel or Netlify, normal updates are just commit and push.
