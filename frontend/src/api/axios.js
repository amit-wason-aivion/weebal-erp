import axios from 'axios';

const instance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
});

// Interceptor to add JWT token to every request
instance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Automatically attach X-Company-ID if available in localStorage
        const savedCompany = localStorage.getItem('activeCompany');
        if (savedCompany && savedCompany !== "undefined") {
            try {
                const company = JSON.parse(savedCompany);
                if (company && company.id) {
                    config.headers['X-Company-ID'] = company.id;
                }
            } catch (e) {
                console.error("Error parsing activeCompany for header", e);
            }
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle 401 Unauthorized errors (token expired)
instance.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            console.log("Token expired or unauthorized. Redirecting to login...");
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('username');
            // We can't use navigate() here directly as this is outside a component
            // But we can trigger a page reload which will be caught by ProtectedRoute
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default instance;
