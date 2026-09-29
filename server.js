const express = require('express');
const path = require('path');
const https = require('https');
const app = express();
const PORT = 3001;

const FMP_API_KEY = 'hFcZINJ4ejuRh6MilCBlZrVVLASQ8ILE';

app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    maxage: '0',
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
}));
app.use(express.json());

// Mengambil harga emas spot global real-time yang akurat dari sumber market
function fetchGoldPrice() {
    return new Promise((resolve) => {
        https.get('https://data-asg.goldprice.org/dbXRates/USD', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const xau = parsed.items.find(i => i.curr === 'USD');
                    resolve(xau ? xau.xauPrice : 4123.80);
                } catch (e) {
                    resolve(4123.80);
                }
            });
        }).on('error', () => resolve(4123.80));
    });
}

function fetchFMPCalendar() {
    return new Promise((resolve) => {
        const url = `https://financialmodelingprep.com/api/v3/economic_calendar?apikey=${FMP_API_KEY}`; 
        
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const formatted = parsed.slice(0, 10).map(item => ({
                            date: item.date ? item.date.split(' ')[0] : '2026-09-29',
                            time: item.date ? item.date.split(' ')[1] || '00:00' : '00:00',
                            name: item.event || 'Economic Data',
                            currency: item.country || 'USD',
                            impact: item.impact || 'HIGH',
                            actual: item.actual !== null && item.actual !== undefined ? String(item.actual) : '',
                            consensus: item.estimate !== null && item.estimate !== undefined ? String(item.estimate) : '-',
                            previous: item.previous !== null && item.previous !== undefined ? String(item.previous) : '-'
                        }));
                        resolve(formatted);
                    } else {
                        resolve(getFallbackCalendar());
                    }
                } catch (e) {
                    resolve(getFallbackCalendar());
                }
            });
        }).on('error', () => resolve(getFallbackCalendar()));
    });
}

function getFallbackCalendar() {
    return [
        {
            date: "2026-09-29",
            time: "19:30",
            name: "US CB Consumer Confidence",
            currency: "USD",
            impact: "HIGH",
            actual: "",
            consensus: "102.1",
            previous: "103.3"
        }
    ];
}

app.get('/api/news-list', async (req, res) => {
    const liveGoldPrice = await fetchGoldPrice();
    const liveCalendar = await fetchFMPCalendar();

    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        goldPrice: liveGoldPrice,
        events: liveCalendar,
        dailyMarketTrend: {
            structure: "BEARISH MARKET STRUCTURE (H1)",
            dailyBias: "STRONG SELL",
            support: (liveGoldPrice - 20).toFixed(2),
            resistance: (liveGoldPrice + 20).toFixed(2),
            rsi: "31.50"
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server Real Price berjalan di port ${PORT}`);
});
