// Vercel Serverless Function: ซ่อน API Key ไว้ฝั่งเซิร์ฟเวอร์
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const SCHEMA = {type:'OBJECT',properties:{
  bias:{type:'STRING',enum:['BUY','SELL','WAIT']},confidence:{type:'INTEGER'},
  technical:{type:'ARRAY',items:{type:'STRING'}},macro:{type:'ARRAY',items:{type:'STRING'}},
  entry:{type:'NUMBER'},stop_loss:{type:'NUMBER'},take_profit:{type:'NUMBER'},summary:{type:'STRING'}},
  required:['bias','confidence','technical','macro','stop_loss','take_profit','summary']};

const hits = new Map(); // จำกัดอัตราเบื้องต้น: 10 ครั้ง/นาที/IP
function limited(ip){
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr); return arr.length > 10;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'POST only'});
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({error:'GEMINI_API_KEY not set'});
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  if (limited(ip)) return res.status(429).json({error:'rate limited'});
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.slice(0, 3000) : '';
  if (!prompt) return res.status(400).json({error:'prompt required'});
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],
      generationConfig:{temperature:0.2,responseMimeType:'application/json',responseSchema:SCHEMA}})
  });
  res.status(r.status).setHeader('Content-Type','application/json').send(await r.text());
}
