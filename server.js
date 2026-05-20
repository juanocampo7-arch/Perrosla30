// Servidor de impresión + App — Perros La 30
const http = require('http');
const net  = require('net');
const fs   = require('fs');
const path = require('path');

const IMPRESORA_IP   = '192.168.1.200';
const IMPRESORA_PORT = 9100;
const PUERTO         = 3000;

// Comandos ESC/POS
const ESC = 0x1B;
const GS  = 0x1D;
const INIT       = Buffer.from([ESC, 0x40]);
const CORTAR     = Buffer.from([GS, 0x56, 0x42, 0x00]);
const NEGRITA_ON = Buffer.from([ESC, 0x45, 0x01]);
const NEGRITA_OFF= Buffer.from([ESC, 0x45, 0x00]);
const CENTRAR    = Buffer.from([ESC, 0x61, 0x01]);
const IZQUIERDA  = Buffer.from([ESC, 0x61, 0x00]);
const DOBLE_ON   = Buffer.from([GS, 0x21, 0x11]);
const DOBLE_OFF  = Buffer.from([GS, 0x21, 0x00]);
const SEPARADOR  = Buffer.from('--------------------------------\n');

function txt(str) { return Buffer.from(str + '\n', 'latin1'); }

function construirComanda(data) {
    const p = [];
    p.push(INIT);
    p.push(CENTRAR);
    p.push(DOBLE_ON); p.push(NEGRITA_ON);
    p.push(txt('COCINA'));
    p.push(NEGRITA_OFF); p.push(DOBLE_OFF);
    p.push(SEPARADOR);
    p.push(IZQUIERDA);
    p.push(DOBLE_ON);
    if (data.orderId) p.push(txt(`Orden #${data.orderId}`));
    if (data.station) p.push(txt(`Mesa: ${data.station}`));
    if (data.table)   p.push(txt(`Mesa: ${data.table}`));
    if (data.waiter)  p.push(txt(`Mesero: ${data.waiter}`));
    if (data.time || data.timestamp) p.push(txt(`Hora: ${data.time || data.timestamp}`));
    p.push(DOBLE_OFF);
    p.push(SEPARADOR);
    const items = data.items || [];
    items.forEach(item => {
        const qty = item.quantity || item.qty || 1;
        p.push(DOBLE_ON); p.push(NEGRITA_ON);
        p.push(txt(`${qty}x ${item.name}`));
        p.push(NEGRITA_OFF);
        if (item.note) { p.push(txt(`  * ${item.note}`)); }
        p.push(DOBLE_OFF);
    });
    p.push(SEPARADOR);
    if (data.generalNote) {
        p.push(DOBLE_ON); p.push(NEGRITA_ON);
        p.push(txt('NOTA:'));
        p.push(NEGRITA_OFF);
        p.push(txt(data.generalNote));
        p.push(DOBLE_OFF);
        p.push(SEPARADOR);
    }
    p.push(Buffer.from('\n\n\n'));
    p.push(CORTAR);
    return Buffer.concat(p);
}

function enviarAImpresora(buffer, callback) {
    const socket = new net.Socket();
    let respondido = false;
    socket.setTimeout(5000);
    socket.connect(IMPRESORA_PORT, IMPRESORA_IP, () => {
        socket.write(buffer, () => { respondido = true; socket.destroy(); callback(true); });
    });
    socket.on('error', (err) => {
        console.log('Error impresora:', err.message);
        if (!respondido) { respondido = true; callback(false); }
    });
    socket.on('timeout', () => {
        console.log('Timeout: impresora no responde');
        socket.destroy();
        if (!respondido) { respondido = true; callback(false); }
    });
}

http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Ruta de impresión
    if (req.method === 'POST' && req.url === '/print') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try {
                const { data } = JSON.parse(body);
                const buffer = construirComanda(data || {});
                enviarAImpresora(buffer, (exito) => {
                    console.log(exito ? '✅ Comanda enviada' : '❌ Error al imprimir');
                    if (!res.headersSent) res.writeHead(exito ? 200 : 500).end(exito ? 'ok' : 'error');
                });
            } catch(e) {
                console.log('Error:', e.message);
                if (!res.headersSent) res.writeHead(400).end('error');
            }
        });
        return;
    }

    // Servir archivos estáticos
    if (req.method === 'GET') {
        let filePath, contentType;
        if (req.url === '/' || req.url === '/index.html') {
            filePath = path.join(__dirname, 'index.html');
            contentType = 'text/html; charset=utf-8';
        } else if (req.url === '/logo.png' || req.url === '/image_d9025a.png') {
            filePath = path.join(__dirname, 'logo.png');
            contentType = 'image/png';
        } else if (req.url === '/manifest.json') {
            filePath = path.join(__dirname, 'manifest.json');
            contentType = 'application/json';
        } else if (req.url === '/sw.js') {
            filePath = path.join(__dirname, 'sw.js');
            contentType = 'application/javascript';
        }
        if (filePath && fs.existsSync(filePath)) {
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
            return;
        }
    }

    res.writeHead(200).end('Servidor activo OK');

}).listen(PUERTO, '0.0.0.0', () => {
    console.log('=================================');
    console.log(' Servidor activo - Perros La 30  ');
    console.log(' Puerto : ' + PUERTO);
    console.log(' Impresora: ' + IMPRESORA_IP);
    console.log('');
    console.log(' Abre la app en cualquier celular:');
    console.log(' http://192.168.1.39:3000');
    console.log('=================================');
});
