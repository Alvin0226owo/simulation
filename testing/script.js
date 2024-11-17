document.addEventListener('DOMContentLoaded', () => {
    const stockInput = document.querySelector('.stock-input');
    const periodButtons = document.querySelectorAll('.period-buttons .btn');
    
    // Handle period button clicks
    periodButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            periodButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');
            
            // Here you would fetch new stock data based on the period
            // fetchStockData(stockInput.value, button.textContent);
        });
    });
    
    // Handle stock symbol input
    stockInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const symbol = stockInput.value.toUpperCase();
            // Here you would fetch stock data for the entered symbol
            // fetchStockData(symbol, getActivePeriod());
        }
    });
}); 