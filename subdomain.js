const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001; // Port beda biar gak bentrok
const BOT_TOKEN = "8419027805:AAFwqpHo_m8OCQO2xxJRcxNuWb42ZgPi0iQ";

app.use(express.json());

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==========================================
// ENDPOINT SUBDOMAIN (LANGSUNG KIRIM KE USER)
// ==========================================
app.get('/subdomain', async (req, res) => {
  const domain = req.query.finder;
  const userId = req.query.userid;
  const groupId = req.query.grupid;
  
  if (!domain) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Parameter finder diperlukan. Contoh: /subdomain?finder=komdigi.go.id&userid=123' 
    });
  }
  
  if (!userId && !groupId) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Parameter userid atau grupid diperlukan' 
    });
  }
  
  console.log(`🔍 Menerima permintaan subdomain untuk: ${domain}`);
  console.log(`👤 Target: ${groupId ? 'Grup ' + groupId : 'User ' + userId}`);
  
  // Langsung response biar ga timeout
  res.json({ 
    status: 'processing', 
    message: 'Mencari subdomain di background',
    domain: domain,
    target: groupId || userId
  });
  
  // Proses di background
  (async () => {
    await cariSubdomainDanKirim(domain, userId, groupId);
  })();
});

// ==========================================
// ENDPOINT STATUS
// ==========================================
app.get('/status', (req, res) => {
  res.json({ 
    status: 'online', 
    message: 'Server Subdomain Railway siap digunakan',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send('🚀 Server Subdomain Railway siap!');
});

// ==========================================
// FUNGSI UTAMA
// ==========================================
async function cariSubdomainDanKirim(domain, userId, groupId) {
  console.log(`🚀 Mencari subdomain untuk ${domain}...`);
  
  try {
    const apiUrl = `https://api.danzy.web.id/api/search/subdomain?url=${encodeURIComponent(domain)}`;
    console.log(`📡 Memanggil API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.status || !data.result || data.result.length === 0) {
      throw new Error('Tidak ada subdomain ditemukan');
    }
    
    const subdomains = data.result;
    const total = data.count || subdomains.length;
    
    console.log(`✅ Ditemukan ${total} subdomain untuk ${domain}`);
    
    // Tentukan target chat
    const chatId = groupId || userId;
    
    // Siapkan pesan
    let message = `🔍 *SUBDOMAIN FINDER*\n\n`;
    message += `🌐 Domain: \`${domain}\`\n`;
    message += `📊 Total: ${total} subdomain\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;
    
    const maxShow = 30;
    const showSubs = subdomains.slice(0, maxShow);
    
    showSubs.forEach((sub, index) => {
      message += `${index + 1}. \`${sub}\`\n`;
    });
    
    if (subdomains.length > maxShow) {
      message += `\n... dan ${subdomains.length - maxShow} subdomain lainnya.\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━\n`;
    message += `🔍 by Yanshs`;
    
    // Kirim ke Telegram
    await kirimKeTelegram(message, chatId);
    
    // Kirim file kalo terlalu panjang
    if (message.length > 4000) {
      await kirimFileKeTelegram(subdomains, domain, chatId);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    const chatId = groupId || userId;
    if (chatId) {
      await kirimKeTelegram(`❌ Gagal mencari subdomain untuk ${domain}: ${error.message}`, chatId);
    }
  }
}

// Fungsi kirim pesan
async function kirimKeTelegram(teks, chatId) {
  if (!chatId) return;
  
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: teks,
        parse_mode: 'Markdown'
      })
    });
    console.log(`✅ Pesan terkirim ke ${chatId}`);
  } catch (e) {
    console.log(`❌ Gagal kirim pesan: ${e.message}`);
  }
}

// Fungsi kirim file
async function kirimFileKeTelegram(subdomains, domain, chatId) {
  if (!chatId) return;
  
  try {
    const content = subdomains.join('\n');
    const fileName = `subdomains_${domain.replace(/\./g, '_')}_${Date.now()}.txt`;
    
    // Pake form-data (perlu install)
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', Buffer.from(content), { filename: fileName });
    formData.append('caption', `🔍 Subdomain untuk ${domain} (${subdomains.length})`);
    
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    
    console.log(`✅ File terkirim ke ${chatId}`);
  } catch (e) {
    console.log(`❌ Gagal kirim file: ${e.message}`);
  }
}

app.listen(PORT, () => {
  console.log(`✅ Server Subdomain berjalan di port ${PORT}`);
});
