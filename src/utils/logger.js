// Simple logging utility for development
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
    log: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },
    
    warn: (...args) => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },
    
    error: (...args) => {
        console.error(...args);
    },
    
    debug: (...args) => {
        if (isDevelopment) {
            console.debug(...args);
        }
    }
};

export default logger;