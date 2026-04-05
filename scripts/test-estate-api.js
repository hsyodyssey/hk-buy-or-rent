const https = require('https');

const url = 'https://hk.centanet.com/estate/%E7%8E%96%E7%93%8F%E5%B1%B1/2-DBEPWPPHPA';
const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'zh-HK,zh;q=0.9'
  }
};

https.get(url, options, (res) => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    const text = buf.toString('utf8');
    
    // Search for developer and managementCompany
    const devMatch = text.match(/developer:"([^"]*?)"/);
    const mgmtMatch = text.match(/managementCompany:"([^"]*?)"/);
    
    console.log('Developer:', devMatch ? devMatch[1] : 'NOT FOUND');
    console.log('Management:', mgmtMatch ? mgmtMatch[1] : 'NOT FOUND');
    console.log('Content-Encoding:', res.headers['content-encoding']);
    
    // Check if gzipped
    if (res.headers['content-encoding'] === 'gzip') {
      console.log('(Content was gzipped, Node should auto-decode)');
    }
    
    // Find hex/escaped sequences
    if (devMatch) {
      const raw = devMatch[1];
      console.log('Developer raw chars:', Buffer.from(raw).toString('hex'));
    }
  });
}).on('error', (e) => {
  console.error('Error:', e.message);
});
