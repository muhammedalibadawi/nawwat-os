import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';

export default function POSScreen() {
    const { user } = useAuth();
    
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<string[]>(['All']);
    const [loadingProducts, setLoadingProducts] = useState(true);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');

    useEffect(() => {
        const fetchItemsAndCategories = async () => {
            if (!user?.tenant_id) return;
            
            try {
                // Mock Fetching Categories
                setCategories(['All', 'Coffee', 'Pastry', 'Food']);
                
                // Mock Fetching Items
                setProducts([
                    { id: '1', name: 'Espresso', price: 12, category: 'Coffee', sku: 'COF-01' },
                    { id: '2', name: 'Latte', price: 16, category: 'Coffee', sku: 'COF-02' },
                    { id: '3', name: 'Croissant', price: 14, category: 'Pastry', sku: 'PAS-01' },
                    { id: '4', name: 'Sandwich', price: 22, category: 'Food', sku: 'FOD-01' },
                ]);
            } catch (err: any) {
                console.error('Failed to fetch items:', err.message);
            } finally {
                setLoadingProducts(false);
            }
        };
        
        fetchItemsAndCategories();
    }, [user?.tenant_id]);

    // UseMemo accurately caches the array without the || true logic bug!
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCat = activeCategory === 'All' || p.category === activeCategory; 
            
            return matchesSearch && matchesCat;
        });
    }, [searchQuery, activeCategory, products]);

    if (loadingProducts) return <div>Loading POS Catalog...</div>;

    return (
        <div style={{ padding: '2rem' }}>
            <h2>Point of Sale</h2>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <input 
                    type="text" 
                    placeholder="Search standard items..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    style={{ padding: '0.5rem', width: '250px' }}
                />
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {categories.map(cat => (
                        <button 
                            key={cat} 
                            onClick={() => setActiveCategory(cat)}
                            style={{ 
                                padding: '0.5rem 1rem', 
                                background: activeCategory === cat ? '#000' : '#eee',
                                color: activeCategory === cat ? '#fff' : '#000',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {filteredProducts.map(p => (
                    <div key={p.id} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
                        <h3>{p.name}</h3>
                        <p>{p.sku}</p>
                        <strong>AED {p.price}</strong>
                    </div>
                ))}
                {filteredProducts.length === 0 && <p>No products found in this category.</p>}
            </div>
        </div>
    );
}
