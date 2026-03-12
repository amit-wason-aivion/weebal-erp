# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

## 🚀 How to Run the Tally ERP Clone

To make this application functional, you need to run both the **Python FastAPI Backend** and the **React Vite Frontend** simultaneously.

### 1. Start the Backend (Database & Accounting Engine)
Open a terminal, navigate to the `backend` folder, activate the virtual environment, and start the server:
```bash
cd backend
source venv/Scripts/activate  # On Windows Git Bash/PowerShell. Use `venv\Scripts\activate` in CMD.
uvicorn main:app --reload
uvicorn backend.main:app --reload
```
*The backend API will run on `http://localhost:8000`.*

### 2. Start the Frontend (React UI)
Open a **second, separate terminal**, navigate to the `frontend` folder, and start the development server:
```bash
cd frontend
npm install   # (If you haven't installed dependencies yet)
npm run dev
```
*The web interface will typically run on `http://localhost:5173`. Open this URL in your browser to use the ERP.*
