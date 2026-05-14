// ==========================================
// SISTEMA DE IMPRESIÓN MEJORADO v2
// SIN POPUPS - SILENCIOSO Y CONFIABLE
// ==========================================

window.printerConfig = {
    // Configuración de impresoras LAN
    lan_printers: {
        cocina: {
            ip: '192.168.1.101',
            port: 9100,
            name: 'Impresora Cocina'
        },
        caja: {
            ip: '192.168.1.102',
            port: 9100,
            name: 'Impresora Caja'
        }
    },

    // Cola de impresión
    printQueue: [],
    isPrinting: false,
    printMode: sessionStorage.getItem('pos_printMode') || 'manual',
    printHistory: [], // Guardar historial de intentos

    // Detectar si es dispositivo móvil
    isMobileDevice: function() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // Enviar a impresora LAN (sin abrir pestaña)
    sendToLANPrinter: async function(ticketHTML, printerType) {
        if (this.printMode !== 'lan') return false;
        
        try {
            const printer = this.lan_printers[printerType];
            if (!printer) {
                console.warn(`Impresora ${printerType} no configurada`);
                return false;
            }

            const timeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 3000)
            );

            const request = fetch(`http://${printer.ip}:${printer.port}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    html: ticketHTML, 
                    printerType: printerType,
                    timestamp: new Date().toISOString()
                })
            });

            await Promise.race([request, timeout]);
            console.log(`✅ Enviado a impresora ${printerType}`);
            this.logPrintAttempt(printerType, true);
            return true;

        } catch (error) {
            console.warn(`❌ Impresora LAN no disponible: ${error.message}`);
            this.logPrintAttempt(printerType, false, error.message);
            return false;
        }
    },

    // Registrar intentos de impresión (para debugging)
    logPrintAttempt: function(printerType, success, errorMsg = '') {
        this.printHistory.push({
            timestamp: new Date().toISOString(),
            printer: printerType,
            success: success,
            error: errorMsg
        });
        // Guardar últimos 50 intentos
        if (this.printHistory.length > 50) {
            this.printHistory.shift();
        }
    },

    // Impresión vía iframe OCULTO (silenciosa, sin popup)
    printViaHiddenFrame: function(ticketHTML, onComplete) {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.style.position = 'absolute';
            iframe.style.width = '0';
            iframe.style.height = '0';
            
            iframe.onload = function() {
                try {
                    iframe.contentWindow.document.write(ticketHTML);
                    iframe.contentWindow.document.close();
                    iframe.contentWindow.focus();
                    
                    setTimeout(() => {
                        try {
                            iframe.contentWindow.print();
                            console.log('✅ Impresión enviada al navegador');
                        } catch (e) {
                            console.error('Error al imprimir:', e);
                        }
                        
                        setTimeout(() => {
                            try {
                                document.body.removeChild(iframe);
                            } catch (e) {}
                            onComplete();
                        }, 800);
                    }, 300);
                } catch (e) {
                    console.error('Error en iframe:', e);
                    onComplete();
                }
            };
            
            iframe.onerror = function() {
                console.error('Error cargando iframe');
                onComplete();
            };
            
            document.body.appendChild(iframe);
        } catch (e) {
            console.error('Error creando iframe:', e);
            onComplete();
        }
    },

    // Procesar cola de impresión
    processPrintQueue: async function() {
        if (this.printQueue.length === 0) {
            this.isPrinting = false;
            return;
        }

        this.isPrinting = true;
        const job = this.printQueue.shift();

        if (this.printMode === 'lan') {
            // Intentar impresora LAN, si falla usa frame oculto
            const sent = await this.sendToLANPrinter(job.html, job.type);
            if (!sent) {
                console.log('🔄 Fallback: Usando impresión local (iframe)');
                this.printViaHiddenFrame(job.html, () => this.processPrintQueue());
            } else {
                setTimeout(() => this.processPrintQueue(), 200);
            }
        } else {
            // Modo manual: usar frame oculto silenciosamente
            this.printViaHiddenFrame(job.html, () => this.processPrintQueue());
        }
    },

    // Agregar trabajo a la cola
    queuePrint: function(html, type = 'cocina') {
        this.printQueue.push({ html, type, timestamp: new Date() });
        console.log(`📋 Trabajo de impresión encolado (${type}). Cola: ${this.printQueue.length}`);
        if (!this.isPrinting) {
            this.processPrintQueue();
        }
    },

    // Cambiar modo de impresión
    setMode: function(mode) {
        this.printMode = mode;
        sessionStorage.setItem('pos_printMode', mode);
        console.log(`🖨️ Modo de impresión: ${mode}`);
    },

    // Obtener historial de impresión (para debugging)
    getPrintHistory: function() {
        return this.printHistory;
    }
};

// Alias global para compatibilidad
window.printTicket = function(type, id = null) {
    // Implementación compatible con el sistema existente
    const dataList = [];
    
    if (type === 'caja') {
        const order = window.state.cashierOrders?.find(o => o.orderId == id) || 
                     window.state.historyOrders?.find(o => o.orderId == id);
        if (order) dataList.push({ format: 'caja', data: order });
    } else if (type === 'cocina') {
        const ticket = window.state.kitchenTickets?.find(t => t.ticketId === id);
        if (ticket) dataList.push({ format: 'cocina', data: ticket });
    } else if (type === 'last-caja') {
        if (window.state.lastSubmittedOrder?.cashier) {
            dataList.push({ format: 'caja', data: window.state.lastSubmittedOrder.cashier });
        }
    } else if (type === 'last-cocina') {
        if (window.state.lastSubmittedOrder?.kitchen) {
            window.state.lastSubmittedOrder.kitchen.forEach(t => 
                dataList.push({ format: 'cocina', data: t })
            );
        }
    }

    if (dataList.length === 0) {
        window.showToast("No hay información para imprimir", "error");
        return;
    }

    // Generar HTML para cada ticket
    dataList.forEach(({ format, data }) => {
        let html = window.generateTicketHTML(format, data);
        window.printerConfig.queuePrint(html, format === 'cocina' ? 'cocina' : 'caja');
    });

    // NO mostrar notificación de éxito aquí - dejar silencioso
};

// Generar HTML del ticket
window.generateTicketHTML = function(format, data) {
    const styles = `
        <style>
            @page { margin: 0; size: auto; }
            body {
                font-family: 'Courier New', Courier, monospace;
                width: 280px;
                margin: 0;
                padding: 10px;
                font-size: 13px;
                color: #000;
                line-height: 1.2;
            }
            h1, h2, h3, p { margin: 0; padding: 2px 0; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .item-qty { font-weight: bold; min-width: 35px; }
            .item-name { flex: 1; text-align: left; padding: 0 5px; }
            .item-price { font-weight: bold; text-align: right; min-width: 60px; }
            .note { font-size: 11px; font-style: italic; padding-left: 20px; color: #333; margin: 3px 0; }
            .totals { margin-top: 10px; font-weight: bold; font-size: 16px; text-align: right; }
            .header-title { font-size: 20px; font-weight: bold; text-align: center; }
            .station-title { font-size: 18px; font-weight: bold; border: 2px solid #000; padding: 5px; margin-bottom: 8px; text-align: center; text-transform: uppercase; }
            .info-text { text-align: left; font-size: 12px; margin-bottom: 2px; }
            .ticket-container { padding-bottom: 10px; }
        </style>
    `;

    if (format === 'caja') {
        return `
            <html>
            <head>${styles}</head>
            <body>
                <div class="ticket-container">
                    <div class="header-title">PERROS LA 30</div>
                    <p style="text-align: center;">Los Originales</p>
                    ${window.state.fiscalData?.nit ? `<p style="font-size:11px; text-align: center;">NIT: ${window.state.fiscalData.nit}</p>` : ''}
                    ${window.state.fiscalData?.regimenIva ? `<p style="font-size:11px; text-align: center;">${window.state.fiscalData.regimenIva}</p>` : ''}
                    <div class="divider"></div>
                    
                    <p style="font-size:13px; font-weight:bold; text-align: center;">COMPROBANTE DE VENTA</p>
                    <div class="info-text"><b>Orden #:</b> ${data.orderId}</div>
                    ${data.type === 'domicilio' ? `
                        <div style="border: 1px solid #000; padding: 3px; margin: 3px 0; text-align: center; font-weight: bold; color: #d32f2f;">
                            🚚 DOMICILIO
                        </div>
                        <div class="info-text"><b>Dir:</b> ${data.address}</div>
                        ${data.phone ? `<div class="info-text"><b>Tel:</b> ${data.phone}</div>` : ''}
                    ` : `
                        <div class="info-text"><b>Mesa:</b> ${data.table}</div>
                        <div class="info-text"><b>Mesero:</b> ${data.waiter}</div>
                    `}
                    <div class="info-text"><b>Fecha:</b> ${data.timestamp}</div>
                    <div class="divider"></div>
                    
                    ${data.items.map(item => `
                        <div class="item-row">
                            <span class="item-qty">${item.quantity}x</span>
                            <span class="item-name">${item.name}</span>
                            <span class="item-price">${window.formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    `).join('')}
                    
                    ${data.type === 'domicilio' && data.domiFee > 0 ? `
                        <div class="divider"></div>
                        <div class="item-row">
                            <span class="item-name" style="font-weight: bold;">Costo Envío</span>
                            <span class="item-price">${window.formatCurrency(data.domiFee)}</span>
                        </div>
                    ` : ''}
                    
                    <div class="divider"></div>
                    <div class="totals">TOTAL: ${window.formatCurrency(data.total)}</div>
                    <div class="divider"></div>
                    
                    ${data.payment ? `
                        <p style="text-align:right; font-size:11px;">
                            Efectivo: ${window.formatCurrency(data.payment.cashAmount)}<br>
                            Transf: ${window.formatCurrency(data.payment.transferAmount)}
                        </p>
                    ` : ''}
                    
                    <p style="margin-top:12px; text-align: center; font-size:11px;">¡Gracias por su compra!</p>
                </div>
            </body>
            </html>
        `;
    } else {
        return `
            <html>
            <head>${styles}</head>
            <body>
                <div class="ticket-container">
                    <div class="station-title">${data.station.toUpperCase()}</div>
                    
                    ${data.type === 'domicilio' ? `
                        <div style="border: 2px solid #000; padding: 4px; margin-bottom: 5px; text-align: center; font-weight: bold; font-size: 14px;">
                            🚚 DOMICILIO
                        </div>
                        <div class="info-text" style="font-size: 14px; font-weight: bold;">📍 ${data.address}</div>
                    ` : `
                        <div class="info-text" style="font-size: 14px; font-weight: bold;">Mesa: ${data.table}</div>
                    `}
                    
                    <div class="info-text"><b>Orden #:</b> ${data.orderId}</div>
                    <div class="info-text"><b>Hora:</b> ${data.timestamp}</div>
                    <div class="divider" style="border-top: 2px solid #000;"></div>
                    
                    ${data.items.map(item => `
                        <div style="font-weight: bold; font-size: 15px; margin-top: 5px;">
                            ${item.quantity}x ${item.name}
                        </div>
                        ${item.note ? `
                            <div class="note">
                                ✏️ ${item.note}
                            </div>
                        ` : ''}
                        <div class="divider"></div>
                    `).join('')}
                    
                    ${data.generalNote ? `
                        <div style="border: 1px solid #000; padding: 4px; margin-top: 8px;">
                            <b>📝 NOTA:</b> ${data.generalNote}
                        </div>
                    ` : ''}
                    
                    <p style="margin-top: 15px; text-align: center; font-weight: bold;">--- FIN DE COMANDA ---</p>
                </div>
            </body>
            </html>
        `;
    }
};
