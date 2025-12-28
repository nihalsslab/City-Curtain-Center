export class ApiService {
    constructor() {
        // USER MUST UPDATE THIS AFTER DEPLOYMENT
        this.baseUrl = "https://script.google.com/macros/s/AKfycby5vEsEZbbqFoLjyhHEXZHpoavBL_SPMcZ2PM7Nsxldw3atbQjL6Y2KZ2y9K5Vnd05D/exec";
    }

    setBaseUrl(url) {
        this.baseUrl = url;
        localStorage.setItem('gas_api_url', url);
    }

    async get(action) {
        // Ensure URL is set
        if (!this.baseUrl || this.baseUrl.includes("REPLACE")) {
            const stored = localStorage.getItem('gas_api_url');
            if (stored) this.baseUrl = stored;
            else throw new Error("API URL not configured. Please set it in the settings.");
        }

        try {
            // Add timestamp to prevent browser/network caching
            const response = await fetch(`${this.baseUrl}?action=${action}&_t=${new Date().getTime()}`);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Server Error: ${response.status} - ${text.substring(0, 100)}`);
            }
            return await response.json();
        } catch (error) {
            console.error("API Fetch Error:", error);
            throw error; // Re-throw so UI can show the error card
        }
    }

    async post(action, data) {
        if (!this.baseUrl || this.baseUrl.includes("REPLACE")) {
            const stored = localStorage.getItem('gas_api_url');
            if (stored) this.baseUrl = stored;
            else throw new Error("API URL not configured");
        }

        try {
            // GAS often requires no-cors for simpler post requests or specific content types
            // But text/plain is standard for GAS `postData.contents` parsing
            const response = await fetch(`${this.baseUrl}?action=${action}`, {
                method: "POST",
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error("API Post Error:", error);
            return { error: error.message };
        }
    }

    // Specific Methods
    async getProducts() { return this.get("getProducts"); }
    async getSales() { return this.get("getSales"); }
    async getAccounting() { return this.get("getAccounting"); }
    async getStats() { return this.get("getStats"); }

    async addProduct(product) { return this.post("addProduct", product); }
    async addSale(sale) { return this.post("addSale", sale); }
    async addTransaction(tx) { return this.post("addTransaction", tx); }
}

export const api = new ApiService();