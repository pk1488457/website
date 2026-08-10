# Hirely Frontend

This frontend is designed to sit directly inside the existing Express `public/` directory of `pk1488457/website`.

## Install

Copy the contents of this `public` folder into the repository's `public/` folder.

The existing server already exposes static files with:

```js
app.use(express.static(path.join(__dirname, 'public')));
```

The frontend calls the existing API under `/api/v1`.

## Important backend compatibility

The existing backend currently exposes:

- `/api/v1/auth`
- `/api/v1/jobs`
- `/api/v1/companies`
- `/api/v1/applications`
- `/api/v1/saved-jobs`
- `/api/v1/resumes`

The profile page references `/api/v1/users/me`, but the current server has the users route commented out. Enable that backend route before expecting profile updates to work.

## Run

From the backend project:

```bash
npm install
npm run dev
```

Open:

http://localhost:3333/

## Frontend principles

- Vanilla JavaScript ES modules
- No React/Vue/Angular
- Responsive CSS
- API-first integration
- Reusable layout and UI utilities
- Live resume preview
- Resume CRUD integration
- Dark-mode-ready CSS variables
- Production-oriented validation/error states
