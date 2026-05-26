# Bike Speedo

Bike Speedo is a React + TypeScript + Vite app configured to deploy to GitHub Pages.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to GitHub Pages

This project is set up to publish the `dist` folder to the `gh-pages` branch.

```bash
npm run deploy
```

## One-time GitHub setup

1. Push your `main` branch to GitHub.
2. Run `npm run deploy` once to create/update the `gh-pages` branch.
3. In GitHub: Repository Settings -> Pages.
4. Set Source to `Deploy from a branch`.
5. Select branch `gh-pages` and folder `/ (root)`.
6. Save.

After publishing, the app will be available at:

https://mrdiamonddirt.github.io/bike-speedo/
