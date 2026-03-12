import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from '../api/axios';

const CompanyContext = createContext();

export const CompanyProvider = ({ children }) => {
    const [activeCompany, setActiveCompany] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load active company from localStorage on mount
        const savedCompany = localStorage.getItem('activeCompany');
        if (savedCompany && savedCompany !== "undefined") {
            try {
                setActiveCompany(JSON.parse(savedCompany));
            } catch (e) {
                console.error("Error parsing saved company", e);
            }
        }
        setLoading(false);
    }, []);

    const selectCompany = (company) => {
        setActiveCompany(company);
        if (company) {
            localStorage.setItem('activeCompany', JSON.stringify(company));
        } else {
            localStorage.removeItem('activeCompany');
        }
    };

    const fetchCompanies = async () => {
        try {
            const { data } = await axios.get('/api/companies');
            // If active company exists, update it with fresh data
            if (activeCompany) {
                const fresh = data.find(c => c.id === activeCompany.id);
                if (fresh) selectCompany(fresh);
            }
            return data;
        } catch (e) {
            console.error("Error fetching companies", e);
        }
    };

    return (
        <CompanyContext.Provider value={{ 
            activeCompany, 
            selectCompany, 
            fetchCompanies,
            loading, 
            companyType: activeCompany?.company_type || 'GENERAL' 
        }}>
            {children}
        </CompanyContext.Provider>
    );
};

export const useCompany = () => {
    const context = useContext(CompanyContext);
    if (!context) {
        throw new Error("useCompany must be used within a CompanyProvider");
    }
    return context;
};
