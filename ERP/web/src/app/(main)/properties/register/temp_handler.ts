
const handleMaintenanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setPriceData(prev => ({ ...prev, maintenance: value }));

    // Recalculate rentMaintenance with new parsing logic
    const monthlyRent = priceData.monthlyRent || 0;
    const match = value.match(/^\s*([\d,]+)/); // Extract leading number
    const maintValue = match ? parseFloat(match[1].replace(/,/g, '')) : 0;

    setFinancialData(prev => ({ ...prev, rentMaintenance: monthlyRent + maintValue }));
};
